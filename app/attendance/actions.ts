'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { sendServerBroadcast } from '@/utils/supabase/broadcast'
import { revalidatePath } from 'next/cache'
import { Database } from '@/types/supabase'
import { z } from 'zod'
import { ActionResult, ErrorCodes } from '@/types/actions'
import { requireUserProfile, requireUserRole, withErrorHandling } from '@/utils/actions_common'
import { calculateWorkMinutes } from '@/utils/attendance-engine'
import { getTaipeiDateString, getTaipeiTimeString } from '@/utils/timezone'

type AttendanceRow = Database['public']['Tables']['attendance']['Row']
type UserRow = Database['public']['Tables']['users']['Row']

const ClockInSchema = z.object({
    userId: z.string().uuid(),
    customTime: z.date().optional(),
})

const ClockOutSchema = z.object({
    userId: z.string().uuid(),
    customTime: z.date().optional(),
    breakDuration: z.number().min(0).max(24).optional(),
})

const CancelClockOutSchema = z.object({
    userId: z.string().uuid(),
})

const AddAttendanceSchema = z.object({
    workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    clockInTime: z.string().nullable(),
    clockOutTime: z.string().nullable(),
    reason: z.string().min(1, '請填寫補登/修改原因'),
    breakDuration: z.number().min(0).max(24).optional(),
})

const UpdateAttendanceSchema = z.object({
    attendanceId: z.number(),
    newClockIn: z.string().nullable(),
    newClockOut: z.string().nullable(),
    reason: z.string().min(1, '請填寫修改原因'),
    breakDuration: z.number().min(0).max(24).optional(),
})


/**
 * 核心計算引擎：處理出勤狀態與工時 (回傳結果)
 */
async function calculateAttendanceFields(
    supabase: any,
    userId: string,
    clockInTime: string | null, // ISO
    clockOutTime: string | null, // ISO
    manualBreakDuration?: number
) {
    const { data: userSettings, error } = await supabase
        .from('users')
        .select('work_start_time, work_end_time, salary_type, break_hours')
        .eq('id', userId)
        .single()

    if (error || !userSettings) throw { code: ErrorCodes.NOT_FOUND, message: '找不到使用者設定' }

    const workStartTime = userSettings.work_start_time || '09:00:00'
    const workEndTime = userSettings.work_end_time || '18:00:00'
    const isHourly = userSettings.salary_type === 'hourly'

    // 優先順序：手動傳入 (修改時) > 使用者設定中的 break_hours > 程式預設 (月薪 1.0, 鐘點 0)
    let breakHours = 0
    if (manualBreakDuration !== undefined) {
        breakHours = manualBreakDuration
    } else if (userSettings.break_hours !== null && userSettings.break_hours !== undefined) {
        breakHours = userSettings.break_hours
    } else {
        breakHours = isHourly ? 0 : 1.0
    }

    const inTimeStr = clockInTime ? getTaipeiTimeString(clockInTime) : null;
    const outTimeStr = clockOutTime ? getTaipeiTimeString(clockOutTime) : null;

    const status = clockInTime ? 'normal' : 'absent';

    let workHours: number | null = null;
    if (clockInTime && clockOutTime) {
        workHours = calculateWorkMinutes(clockInTime, clockOutTime, breakHours);
    }

    const res = {
        status,
        workHours,
        breakDuration: Math.round(breakHours * 60) // 轉為分鐘儲存於資料庫
    }
    console.log('[DEBUG] calculateAttendanceFields results:', res);
    return res;
}


/**
 * 上班打卡
 */
export async function clockIn(userId: string, customTime?: Date): Promise<ActionResult<AttendanceRow>> {
    return withErrorHandling(async () => {
        const input = ClockInSchema.parse({ userId, customTime })
        const profile = await requireUserProfile()
        const supabase = await createClient()

        if (profile.id !== input.userId && !['manager', 'super_admin'].includes(profile.role)) {
            throw { code: ErrorCodes.FORBIDDEN, message: '權限不足，無法替他人打卡' }
        }

        const now = input.customTime || new Date()
        const workDate = getTaipeiDateString(now)

        // 檢查是否重複打卡
        const { data: existing } = await supabase
            .from('attendance')
            .select('id')
            .eq('user_id', input.userId)
            .eq('work_date', workDate)
            .single()

        if (existing) throw { code: ErrorCodes.BUSINESS_CONFLICT, message: '今日已完成上班打卡' }

        const { status } = await calculateAttendanceFields(supabase, input.userId, now.toISOString(), null)

        const { data: newRecord, error } = await supabase.from('attendance').insert({
            user_id: input.userId,
            work_date: workDate,
            clock_in_time: now.toISOString(),
            status: status
        }).select().single()

        if (error) throw new Error(error.message)

        // 穩定的伺服器端廣播
        await sendServerBroadcast('public:attendance_sync', 'sync', { action: 'clockIn' })

        revalidatePath('/')
        return newRecord
    })
}

/**
 * 下班打卡
 */
export async function clockOut(userId: string, customTime?: Date, breakDuration?: number): Promise<ActionResult<AttendanceRow>> {
    return withErrorHandling(async () => {
        const input = ClockOutSchema.parse({ userId, customTime, breakDuration })
        const profile = await requireUserProfile()
        const supabase = await createClient()

        if (profile.id !== input.userId && !['manager', 'super_admin'].includes(profile.role)) {
            throw { code: ErrorCodes.FORBIDDEN, message: '權限不足' }
        }

        const now = input.customTime || new Date()
        const workDate = getTaipeiDateString(now)

        const { data: record, error: fetchError } = await supabase
            .from('attendance')
            .select('id, clock_in_time')
            .eq('user_id', input.userId)
            .eq('work_date', workDate)
            .single()

        if (fetchError || !record || !record.clock_in_time) {
            throw { code: ErrorCodes.BUSINESS_CONFLICT, message: '尚未上班打卡，無法下班' }
        }

        const { status, workHours, breakDuration: finalBreak } = await calculateAttendanceFields(
            supabase,
            input.userId,
            record.clock_in_time,
            now.toISOString(),
            input.breakDuration
        )

        const updatePayload: any = {
            clock_out_time: now.toISOString(),
            work_hours: workHours,
            status: status,
            break_duration: finalBreak
        };

        const { data: updatedRecord, error } = await supabase.from('attendance')
            .update(updatePayload)
            .eq('id', record.id)
            .select().single()

        if (error) throw new Error(error.message)

        // 穩定的伺服器端廣播
        await sendServerBroadcast('public:attendance_sync', 'sync', { action: 'clockOut' })

        revalidatePath('/')
        return updatedRecord
    })
}

/**
 * 取消下班打卡
 */
export async function cancelClockOut(userId: string): Promise<ActionResult<AttendanceRow>> {
    return withErrorHandling(async () => {
        const input = CancelClockOutSchema.parse({ userId })
        const profile = await requireUserProfile()
        const supabase = await createClient()

        if (profile.id !== input.userId && !['manager', 'super_admin'].includes(profile.role)) {
            throw { code: ErrorCodes.FORBIDDEN, message: '權限不足' }
        }

        const workDate = getTaipeiDateString(new Date())

        const { data: record, error: fetchError } = await supabase
            .from('attendance')
            .select('id, clock_in_time, clock_out_time')
            .eq('user_id', input.userId)
            .eq('work_date', workDate)
            .single()

        if (fetchError || !record) throw { code: ErrorCodes.BUSINESS_CONFLICT, message: '今日尚未打卡' }
        if (!record.clock_out_time) throw { code: ErrorCodes.BUSINESS_CONFLICT, message: '尚未下班打卡，無需取消' }

        const { status } = await calculateAttendanceFields(supabase, input.userId, record.clock_in_time, null)

        const { data: updatedRecord, error } = await supabase.from('attendance')
            .update({
                clock_out_time: null,
                work_hours: null,
                status: status,
                break_duration: null
            })
            .eq('id', record.id)
            .select().single()

        if (error) throw new Error(error.message)

        // 穩定的伺服器端廣播
        await sendServerBroadcast('public:attendance_sync', 'sync', { action: 'cancelClockOut' })

        revalidatePath('/')
        return updatedRecord
    })
}

/**
 * 補登打卡記錄
 */
export async function addAttendanceRecord(
    workDate: string,
    clockInTime: string | null,
    clockOutTime: string | null,
    reason: string,
    breakDuration?: number
): Promise<ActionResult<void>> {
    return withErrorHandling(async () => {
        const input = AddAttendanceSchema.parse({ workDate, clockInTime, clockOutTime, reason, breakDuration })
        const profile = await requireUserProfile()
        const supabase = await createClient()

        const { data: existing } = await supabase
            .from('attendance')
            .select('id')
            .eq('user_id', profile.id)
            .eq('work_date', input.workDate)
            .single()

        if (existing) {
            throw { code: ErrorCodes.BUSINESS_CONFLICT, message: '該日期已有打卡記錄，請使用修改功能' }
        }

        const { status, workHours, breakDuration: finalBreak } = await calculateAttendanceFields(
            supabase,
            profile.id,
            input.clockInTime,
            input.clockOutTime,
            input.breakDuration
        )

        const { data: newRecord, error: insertError } = await supabase.from('attendance').insert({
            user_id: profile.id,
            work_date: input.workDate,
            clock_in_time: input.clockInTime,
            clock_out_time: input.clockOutTime,
            work_hours: workHours,
            status: status,
            is_edited: true,
            break_duration: finalBreak
        }).select().single()

        if (insertError) throw new Error(`補登失敗: ${insertError.message}`)

        await supabase.from('attendance_edit_logs').insert({
            attendance_id: newRecord.id,
            editor_id: profile.id,
            old_clock_in_time: null,
            new_clock_in_time: input.clockInTime,
            old_clock_out_time: null,
            new_clock_out_time: input.clockOutTime,
            edit_reason: `[補登] ${input.reason}`
        })

        revalidatePath('/attendance')
    })
}

/**
 * 修改打卡記錄
 */
export async function updateAttendance(
    attendanceId: number,
    newClockIn: string | null,
    newClockOut: string | null,
    reason: string,
    breakDuration?: number
): Promise<ActionResult<void>> {
    return withErrorHandling(async () => {
        const input = UpdateAttendanceSchema.parse({ attendanceId, newClockIn, newClockOut, reason, breakDuration })
        const profile = await requireUserProfile()
        const supabase = await createClient()

        const { data: original, error: fetchError } = await supabase
            .from('attendance')
            .select('*')
            .eq('id', input.attendanceId)
            .single()

        if (fetchError || !original) throw { code: ErrorCodes.NOT_FOUND, message: '找不到該筆打卡記錄' }

        const { status, workHours, breakDuration: finalBreak } = await calculateAttendanceFields(
            supabase,
            original.user_id,
            input.newClockIn,
            input.newClockOut,
            input.breakDuration
        )

        const { error: updateError } = await supabase.from('attendance').update({
            clock_in_time: input.newClockIn,
            clock_out_time: input.newClockOut,
            work_hours: workHours,
            status: status,
            is_edited: true,
            break_duration: finalBreak
        }).eq('id', input.attendanceId)

        if (updateError) throw new Error(`修改失敗: ${updateError.message}`)

        await supabase.from('attendance_edit_logs').insert({
            attendance_id: input.attendanceId,
            editor_id: profile.id,
            old_clock_in_time: original.clock_in_time,
            new_clock_in_time: input.newClockIn,
            old_clock_out_time: original.clock_out_time,
            new_clock_out_time: input.newClockOut,
            edit_reason: input.reason
        })

        revalidatePath('/attendance')
        revalidatePath('/')
    })
}

// ==========================================
// Read Actions
// ==========================================

export async function getUserProfile(): Promise<ActionResult<UserRow>> {
    return withErrorHandling(async () => {
        return requireUserProfile();
    });
}

export async function getAttendanceHistory(startDate: string, endDate: string): Promise<ActionResult<AttendanceRow[]>> {
    return withErrorHandling(async () => {
        const profile = await requireUserProfile()
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('attendance')
            .select('*')
            .eq('user_id', profile.id)
            .gte('work_date', startDate)
            .lte('work_date', endDate)
            .order('work_date', { ascending: false })

        if (error) throw new Error(error.message)
        return data || []
    })
}

export async function getAttendanceLogs(attendanceId: number): Promise<ActionResult<any[]>> {
    return withErrorHandling(async () => {
        await requireUserProfile();
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('attendance_edit_logs')
            .select(`
                *,
                editor:users ( display_name, email )
            `)
            .eq('attendance_id', attendanceId)
            .order('created_at', { ascending: false })

        if (error) throw new Error(error.message)
        return data || []
    })
}

export async function getAllEmployees(): Promise<ActionResult<UserRow[]>> {
    return withErrorHandling(async () => {
        await requireUserRole(['manager', 'super_admin']);
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('users')
            .select('*')
            .order('employee_id', { ascending: true })

        if (error) throw new Error(error.message)
        return data || []
    })
}

export async function getMyMonthlyAttendance(yearMonth: string): Promise<ActionResult<AttendanceRow[]>> {
    return withErrorHandling(async () => {
        const profile = await requireUserProfile()
        const supabase = await createClient()

        const [year, month] = yearMonth.split('-').map(Number)
        const lastDay = new Date(year, month, 0).getDate()
        const startDate = `${yearMonth}-01`
        const endDate = `${yearMonth}-${String(lastDay).padStart(2, '0')}`

        const { data, error } = await supabase
            .from('attendance')
            .select('*')
            .eq('user_id', profile.id)
            .gte('work_date', startDate)
            .lte('work_date', endDate)
            .order('work_date', { ascending: true })

        if (error) throw new Error(error.message)
        return data || []
    })
}

export async function getMyMonthlyLeaves(yearMonth: string): Promise<ActionResult<any[]>> {
    return withErrorHandling(async () => {
        const profile = await requireUserProfile()
        const supabase = await createClient()

        const [year, month] = yearMonth.split('-').map(Number)
        const lastDay = new Date(year, month, 0).getDate()
        const startDate = `${yearMonth}-01`
        const endDate = `${yearMonth}-${String(lastDay).padStart(2, '0')}`

        const { data, error } = await supabase
            .from('leaves')
            .select('*')
            .eq('user_id', profile.id)
            .eq('status', 'approved')
            .gte('start_date', startDate)
            .lte('end_date', endDate)
            .order('start_date', { ascending: true })

        if (error) throw new Error(error.message)
        return data || []
    })
}

export async function getEmployeeAttendanceRecords(employeeId: string, yearMonth: string): Promise<ActionResult<AttendanceRow[]>> {
    return withErrorHandling(async () => {
        await requireUserRole(['manager', 'super_admin'])
        const supabase = await createClient()

        const [year, month] = yearMonth.split('-').map(Number)
        const lastDay = new Date(year, month, 0).getDate()
        const startDate = `${yearMonth}-01`
        const endDate = `${yearMonth}-${String(lastDay).padStart(2, '0')}`

        const { data, error } = await supabase
            .from('attendance')
            .select('*')
            .eq('user_id', employeeId)
            .gte('work_date', startDate)
            .lte('work_date', endDate)
            .order('work_date', { ascending: true })

        if (error) throw new Error(error.message)
        return data || []
    })
}

export async function getEmployeeLeaveRecords(employeeId: string, yearMonth: string): Promise<ActionResult<any[]>> {
    return withErrorHandling(async () => {
        await requireUserRole(['manager', 'super_admin'])
        const supabase = await createClient()

        const [year, month] = yearMonth.split('-').map(Number)
        const lastDay = new Date(year, month, 0).getDate()
        const startDate = `${yearMonth}-01`
        const endDate = `${yearMonth}-${String(lastDay).padStart(2, '0')}`

        const { data, error } = await supabase
            .from('leaves')
            .select('*')
            .eq('user_id', employeeId)
            .eq('status', 'approved')
            .gte('start_date', startDate)
            .lte('end_date', endDate)
            .order('start_date', { ascending: true })

        if (error) throw new Error(error.message)
        return data || []
    })
}

/**
 * 取得目前正在上班的員工清單 (包含 Avatar 與名稱)
 * 定義：今日有打上班卡，且尚未打下班卡。
 * 註：使用 adminClient 來繞過 RLS，讓一般員工也能看見其他人的頭像。
 */
export async function getCurrentWorkingEmployees(): Promise<ActionResult<{ user: { id: string, display_name: string, avatar_url: string | null } }[]>> {
    return withErrorHandling(async () => {
        const supabaseAdmin = createAdminClient()
        const todayStr = getTaipeiDateString(new Date().toISOString())

        const { data, error } = await supabaseAdmin
            .from('attendance')
            .select(`
                clock_in_time,
                users (
                    id,
                    display_name,
                    avatar_url
                )
            `)
            .eq('work_date', todayStr)
            .not('clock_in_time', 'is', null)
            .is('clock_out_time', null)
            .order('clock_in_time', { ascending: true })

        if (error) {
            console.error('Fetch working employees error:', error)
            throw new Error('無法取得目前上班員工清單')
        }

        // 過濾掉可能因為 foreign key reference 失敗而造成 users 為 null 的髒資料
        const validData = data
            .filter((row: any) => row.users)
            .map((row: any) => ({
                user: Array.isArray(row.users) ? row.users[0] : row.users // 防範一對多或是 single 問題
            }))

        return validData as any
    })
}
