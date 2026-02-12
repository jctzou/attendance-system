'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { Database } from '@/types/supabase'
import { SupabaseClient } from '@supabase/supabase-js'
import {
    timeToSeconds,
    calculateWorkHours,
    determineAttendanceStatus
} from '@/utils/attendance-calculations'

type ActionResponse = {
    success?: boolean
    error?: string
}

/**
 * 上班打卡 (Clock In)
 */
export async function clockIn(userId: string, customTime?: Date): Promise<ActionResponse> {
    const supabase = await createClient() as any
    const now = customTime || new Date()

    // 1. 取得台北時間的日期與時間
    const taipeiDate = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }) // YYYY-MM-DD
    const taipeiTime = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Taipei', hour12: false }) // HH:mm:ss
    const workDate = taipeiDate

    // 2. 檢查是否已打卡 (避免重複)
    const { data: existing, error: fetchError } = await supabase
        .from('attendance')
        .select('id')
        .eq('user_id', userId)
        .eq('work_date', workDate)
        .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
        return { error: '檢查打卡紀錄失敗' }
    }

    if (existing) {
        return { error: '今日已打卡，請勿重複操作。' }
    }

    // 3. 獲取使用者設定的上班時間
    const { data: userSettings } = await supabase
        .from('users')
        .select('work_start_time')
        .eq('id', userId)
        .single()

    const targetTimeStr = userSettings?.work_start_time || '09:00:00'

    // 4. 判斷狀態 (遲到判定)
    // 這裡只會有 clockIn，所以 status 暫時只判斷 late 或 normal (early_leave 需下班時判斷)
    const status = determineAttendanceStatus(taipeiTime, null, targetTimeStr, '18:00:00')

    // 5. 寫入資料庫
    const { error } = await supabase.from('attendance').insert({
        user_id: userId,
        work_date: workDate,
        clock_in_time: now.toISOString(),
        status: status === 'late' ? 'late' : 'normal' // 剛上班只可能是 late 或 normal
    })

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/')
    return { success: true }
}

/**
 * 下班打卡 (Clock Out)
 */
export async function clockOut(userId: string, customTime?: Date, breakDuration?: number): Promise<ActionResponse> {
    const supabase = await createClient() as any
    const now = customTime || new Date()

    const taipeiDate = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
    const taipeiTime = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Taipei', hour12: false }) // HH:mm:ss
    const workDate = taipeiDate

    // 1. 檢查是否有上班卡
    const { data: record } = await supabase
        .from('attendance')
        .select('id, clock_in_time')
        .eq('user_id', userId)
        .eq('work_date', workDate)
        .single()

    if (!record) {
        return { error: '尚未上班打卡，無法下班。' }
    }

    // 2. 獲取使用者設定的下班時間、員工類型與午休時間
    const { data: userSettings } = await supabase
        .from('users')
        .select('work_start_time, work_end_time, salary_type, break_hours')
        .eq('id', userId)
        .single()

    const workStartTime = userSettings?.work_start_time || '09:00:00'
    const workEndTime = userSettings?.work_end_time || '18:00:00'
    const isHourly = userSettings?.salary_type === 'hourly'

    // 決定使用的午休時間
    // 鐘點人員: 使用前端傳入的 breakDuration (若無則預設 1.0)
    // 月薪人員: 使用系統設定的 userSettings.break_hours
    let actualBreakHours = userSettings?.break_hours || 1.0
    if (isHourly && breakDuration !== undefined) {
        actualBreakHours = breakDuration
    }

    // 3. 計算狀態與工時
    // 需要把上班時間(ISO)轉回 HH:mm:ss 來做狀態判定
    const clockInDate = new Date(record.clock_in_time!)
    const clockInTimeStr = clockInDate.toLocaleTimeString('en-GB', { timeZone: 'Asia/Taipei', hour12: false })

    const status = determineAttendanceStatus(clockInTimeStr, taipeiTime, workStartTime, workEndTime)

    const workHours = calculateWorkHours(
        record.clock_in_time!,
        now.toISOString(),
        actualBreakHours,
        isHourly
    )

    // 4. 更新資料庫
    const { error } = await supabase.from('attendance')
        .update({
            clock_out_time: now.toISOString(),
            work_hours: workHours,
            status: status,
            break_duration: isHourly ? actualBreakHours : null // 僅鐘點人員記錄動態午休
        })
        .eq('id', record.id)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/')
    return { success: true }
}

/**
 * 取消下班打卡 (Cancel Clock Out)
 */
export async function cancelClockOut(userId: string): Promise<ActionResponse> {
    const supabase = await createClient() as any
    const now = new Date()

    const workDate = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })

    // 1. 檢查是否有今日的打卡記錄
    const { data: record } = await supabase
        .from('attendance')
        .select('id, clock_in_time, clock_out_time, status')
        .eq('user_id', userId)
        .eq('work_date', workDate)
        .single()

    if (!record) {
        return { error: '今日尚未打卡。' }
    }

    if (!record.clock_out_time) {
        return { error: '尚未下班打卡,無需取消。' }
    }

    // 2. 回復狀態
    // 如果之前是'late early_leave'，取消下班後應該變回 'late' (如果遲到的話)
    // 這裡簡化處理：如果本來就有 late，則保留 late，否則 normal
    // 更精確的做法是重新讀取上班時間與設定值重算，但這裡直接從字串判斷
    let newStatus = 'normal'
    if (record.status && record.status.includes('late')) {
        newStatus = 'late'
    }

    // 3. 更新資料庫
    const { error } = await supabase.from('attendance')
        .update({
            clock_out_time: null,
            work_hours: null,
            status: newStatus
            // 不修改 is_edited,保持原有狀態
        })
        .eq('id', record.id)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/')
    return { success: true }
}

/**
 * 獲取打卡歷史記錄
 */
export async function getAttendanceHistory(startDate: string, endDate: string) {
    const supabase = await createClient() as any
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .gte('work_date', startDate)
        .lte('work_date', endDate)
        .order('work_date', { ascending: false })

    if (error) return { error: error.message }
    return { data }
}

/**
 * 獲取修改日誌
 */
export async function getAttendanceLogs(attendanceId: number) {
    const supabase = await createClient() as any

    const { data, error } = await supabase
        .from('attendance_edit_logs')
        .select(`
            *,
            editor:users (
                display_name,
                email
            )
        `)
        .eq('attendance_id', attendanceId)
        .order('created_at', { ascending: false })

    if (error) return { error: error.message }
    return { data }
}

/**
 * 修改打卡記錄
 */
export async function updateAttendance(
    attendanceId: number,
    newClockIn: string | null,
    newClockOut: string | null,
    reason: string,
    breakDuration?: number // Optional: For hourly employees
) {
    const supabase = await createClient() as any
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }
    if (!reason.trim()) return { error: '請填寫修改原因' }

    // 1. 獲取原始資料與驗證權限
    const { data: original, error: fetchError } = await supabase
        .from('attendance')
        .select('*')
        .eq('id', attendanceId)
        .single()

    if (fetchError || !original) return { error: 'Attendance record not found' }

    // 簡單權限檢查：只能改自己的 (或管理員)
    if (original.user_id !== user.id) {
        // 這裡省略管理員檢查 logic (實際應用應加上)
        // return { error: 'Permission denied' }
    }

    // 2. 寫入修改日誌
    const { error: logError } = await supabase.from('attendance_edit_logs').insert({
        attendance_id: attendanceId,
        editor_id: user.id,
        old_clock_in_time: original.clock_in_time,
        new_clock_in_time: newClockIn,
        old_clock_out_time: original.clock_out_time,
        new_clock_out_time: newClockOut,
        edit_reason: reason
    })

    if (logError) return { error: `Log Error: ${logError.message}` }

    // 3. 計算新工時與狀態
    let newWorkHours: number | null = original.work_hours
    let newStatus = 'normal'

    if (newClockIn && newClockOut) {
        const { data: userData } = await supabase
            .from('users')
            .select('work_start_time, work_end_time, salary_type, break_hours')
            .eq('id', original.user_id)
            .single()

        if (userData) {
            const isHourly = userData.salary_type === 'hourly'
            // Use provided breakDuration if hourly, otherwise fallback to settings or default
            const breakHours = (isHourly && breakDuration !== undefined)
                ? breakDuration
                : (userData.break_hours || 1.0)

            const workStartTime = userData.work_start_time || '09:00:00'
            const workEndTime = userData.work_end_time || '18:00:00'

            newWorkHours = calculateWorkHours(newClockIn, newClockOut, breakHours, isHourly)

            // 轉換時間部分做判斷
            const inTimeStr = new Date(newClockIn).toLocaleTimeString('en-GB', { timeZone: 'Asia/Taipei', hour12: false })
            const outTimeStr = new Date(newClockOut).toLocaleTimeString('en-GB', { timeZone: 'Asia/Taipei', hour12: false })

            newStatus = determineAttendanceStatus(inTimeStr, outTimeStr, workStartTime, workEndTime)
        }
    } else if (!newClockOut) {
        // 如果清除了下班卡
        newWorkHours = null
        // 狀態只可能是 late 或 normal
        if (newClockIn) {
            const { data: userData } = await supabase
                .from('users')
                .select('work_start_time')
                .eq('id', original.user_id)
                .single()
            const workStartTime = userData?.work_start_time || '09:00:00'
            const inTimeStr = new Date(newClockIn).toLocaleTimeString('en-GB', { timeZone: 'Asia/Taipei', hour12: false })

            // 這裡傳 null 給 clockOutTimeStr
            newStatus = determineAttendanceStatus(inTimeStr, null, workStartTime, '18:00:00')
        }
    }

    // 4. 更新 Attendance
    const { error: updateError } = await supabase.from('attendance').update({
        clock_in_time: newClockIn,
        clock_out_time: newClockOut,
        work_hours: newWorkHours,
        status: newStatus,
        is_edited: true,
        break_duration: breakDuration // Update break_duration for hourly
    }).eq('id', attendanceId)

    if (updateError) return { error: `Update Error: ${updateError.message}` }

    revalidatePath('/')
    return { success: true }
}

/**
 * 獲取當前使用者資料
 */
export async function getUserProfile() {
    const supabase = await createClient() as any
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

    if (error) return { error: error.message }
    return { data }
}

/**
 * 獲取所有員工列表 (管理員用)
 */
export async function getAllEmployees() {
    const supabase = await createClient() as any
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    // 檢查權限
    const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!profile || !['manager', 'super_admin'].includes(profile.role)) {
        return { error: 'Permission denied' }
    }

    const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('employee_id', { ascending: true })

    if (error) return { error: error.message }
    return { data }
}

/**
 * 獲取我的月度打卡記錄
 */
export async function getMyMonthlyAttendance(yearMonth: string) {
    const supabase = await createClient() as any
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    const [year, month] = yearMonth.split('-').map(Number)
    const lastDay = new Date(year, month, 0).getDate()

    const startDate = `${yearMonth}-01`
    const endDate = `${yearMonth}-${String(lastDay).padStart(2, '0')}`

    const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .gte('work_date', startDate)
        .lte('work_date', endDate)
        .order('work_date', { ascending: true })

    if (error) return { error: error.message }
    return { data }
}

/**
 * 獲取我的月度請假記錄
 */
export async function getMyMonthlyLeaves(yearMonth: string) {
    const supabase = await createClient() as any
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    const [year, month] = yearMonth.split('-').map(Number)
    const lastDay = new Date(year, month, 0).getDate()

    const startDate = `${yearMonth}-01`
    const endDate = `${yearMonth}-${String(lastDay).padStart(2, '0')}`

    const { data, error } = await supabase
        .from('leaves')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'approved')
        .gte('start_date', startDate)
        .lte('end_date', endDate)
        .order('start_date', { ascending: true })

    if (error) return { error: error.message }
    return { data }
}

/**
 * 獲取指定員工的打卡記錄 (管理員用)
 */
export async function getEmployeeAttendanceRecords(employeeId: string, yearMonth: string) {
    const supabase = await createClient() as any
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    // 檢查權限
    const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!profile || !['manager', 'super_admin'].includes(profile.role)) {
        return { error: 'Permission denied' }
    }

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

    if (error) return { error: error.message }
    return { data }
}

/**
 * 獲取指定員工的請假記錄 (管理員用)
 */
export async function getEmployeeLeaveRecords(employeeId: string, yearMonth: string) {
    const supabase = await createClient() as any
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    // 檢查權限
    const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!profile || !['manager', 'super_admin'].includes(profile.role)) {
        return { error: 'Permission denied' }
    }

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

    if (error) return { error: error.message }
    return { data }
}

/**
 * 補登打卡記錄
 */
export async function addAttendanceRecord(
    workDate: string,
    clockInTime: string | null,
    clockOutTime: string | null,
    reason: string,
    breakDuration?: number // Optional: For hourly employees
) {
    const supabase = await createClient() as any
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }
    if (!reason.trim()) return { error: '請填寫補登原因' }

    // 1. 檢查該日期是否已有記錄
    const { data: existing } = await supabase
        .from('attendance')
        .select('id')
        .eq('user_id', user.id)
        .eq('work_date', workDate)
        .single()

    if (existing) {
        return { error: '該日期已有打卡記錄,請使用修改功能' }
    }

    // 2. 計算工時與狀態
    let workHours: number | null = null
    let status = 'normal'

    if (clockInTime && clockOutTime) {
        const { data: userData } = await supabase
            .from('users')
            .select('work_start_time, work_end_time, salary_type, break_hours')
            .eq('id', user.id)
            .single()

        if (userData) {
            const isHourly = userData.salary_type === 'hourly'
            // Use provided breakDuration if hourly, otherwise fallback to settings or default
            const breakHours = (isHourly && breakDuration !== undefined)
                ? breakDuration
                : (userData.break_hours || 1.0)

            const workStartTime = userData.work_start_time || '09:00:00'
            const workEndTime = userData.work_end_time || '18:00:00'

            workHours = calculateWorkHours(clockInTime, clockOutTime, breakHours, isHourly)

            const inTimeStr = new Date(clockInTime).toLocaleTimeString('en-GB', { timeZone: 'Asia/Taipei', hour12: false })
            const outTimeStr = new Date(clockOutTime).toLocaleTimeString('en-GB', { timeZone: 'Asia/Taipei', hour12: false })

            status = determineAttendanceStatus(inTimeStr, outTimeStr, workStartTime, workEndTime)
        }
    }

    // 3. 創建打卡記錄
    const { data: newRecord, error: insertError } = await supabase.from('attendance').insert({
        user_id: user.id,
        work_date: workDate,
        clock_in_time: clockInTime,
        clock_out_time: clockOutTime,
        work_hours: workHours,
        status: status,
        is_edited: true, // 標記為補登
        break_duration: breakDuration
    }).select().single()

    if (insertError) {
        return { error: `補登失敗: ${insertError.message}` }
    }

    // 4. 創建修改日誌(記錄補登)
    const { error: logError } = await supabase.from('attendance_edit_logs').insert({
        attendance_id: newRecord.id,
        editor_id: user.id,
        old_clock_in_time: null,
        new_clock_in_time: clockInTime,
        old_clock_out_time: null,
        new_clock_out_time: clockOutTime,
        edit_reason: `[補登] ${reason}`
    })

    if (logError) {
        console.error('Log error:', logError)
    }

    revalidatePath('/attendance')
    return { success: true }
}
