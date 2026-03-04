'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { getLeaveDeductionWeight } from '@/utils/leave-policies'

// --- Types ---

export type SalaryType = 'monthly' | 'hourly'

export interface SalaryDetails {
    baseSalary: number
    workHours: number
    salaryType: SalaryType
    hourlyRate?: number
    monthlyRate?: number
    lateCount: number
    earlyLeaveCount: number
    leaveDays: number
    leaveDetails: Record<string, number>
    totalBreakHours?: number
    deduction?: number
}

export interface SalaryRecordData {
    id?: number
    userId: string
    displayName: string
    yearMonth: string
    type: SalaryType
    status: 'SETTLED' | 'UNSETTLED'
    avatarUrl?: string | null // New field

    // Financials
    baseSalary: number
    bonus: number
    deduction: number
    totalSalary: number

    // Stats
    workHours: number
    lateCount: number
    earlyLeaveCount: number
    leaveDays: number
    leaveDetails: Record<string, number>
    totalBreakHours?: number // New field

    rate: number // Hourly rate or Monthly base

    notes?: string
    settledDate?: string
    workStartTime?: string
    workEndTime?: string
}

export interface ActionResponse<T = any> {
    success?: boolean
    data?: T
    error?: string
}

// --- Actions ---

/**
 * Get all users with their current salary settings
 */
export async function getAllUsers(): Promise<ActionResponse<any[]>> {
    const supabase = await createClient() as any

    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    // Role check
    const { data: adminUser } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!adminUser || !['manager', 'super_admin'].includes(adminUser.role)) {
        return { error: 'Permission denied' }
    }

    const { data, error } = await supabase
        .from('users')
        .select(`
            id,
            display_name,
            avatar_url,
            email,
            employee_id,
            salary_type,
            salary_amount,
            role
        `)
        .in('role', ['employee', 'manager', 'super_admin'])
        .order('id', { ascending: true })

    if (error) return { error: error.message }
    return { data }
}

/**
 * Update user salary settings
 */
export async function updateUserSalarySettings(userId: string, type: SalaryType, amount: number): Promise<ActionResponse> {
    const supabase = await createClient() as any

    // Auth & Permission check (Simplified for brevity, assuming middleware/RLS handles some)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    // Update user
    const { error } = await supabase
        .from('users')
        .update({
            salary_type: type,
            salary_amount: amount,
            updated_at: new Date().toISOString()
        })
        .eq('id', userId)

    if (error) return { error: error.message }

    revalidatePath('/admin/salary')
    return { success: true }
}

/**
 * Calculate salary for a specific user and month
 * This function aggregates attendance, leaves, and user settings to produce a 'live' calculation
 */

export async function calculateMonthlySalary(userId: string, yearMonth: string, forceLive = false): Promise<ActionResponse<SalaryRecordData>> {
    const supabase = await createClient() as any

    // 1. Get User Data
    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('display_name, avatar_url, salary_type, salary_amount, work_start_time, work_end_time')
        .eq('id', userId)
        .single()

    if (userError || !userData) return { error: 'User not found' }

    // 2. Define Date Range
    // 使用 getDate() 計算月底日期，避免 toISOString() 的 timezone 問題
    // 與 attendance/actions.ts 的寫法完全一致
    const [yearStr, monthStr] = yearMonth.split('-')
    const yearNum = parseInt(yearStr)
    const monthNum = parseInt(monthStr)
    const lastDay = new Date(yearNum, monthNum, 0).getDate()
    const startDate = `${yearMonth}-01`
    const endDate = `${yearMonth}-${String(lastDay).padStart(2, '0')}`

    // 3. Get Existing Salary Record (for bonus/notes/settled data)
    const { data: existingRecord } = await supabase
        .from('salary_records')
        .select('*')
        .eq('user_id', userId)
        .eq('year_month', yearMonth)
        .single()

    // --- CHECK SETTLED STATUS FIRST ---
    if (!forceLive && existingRecord?.is_paid && existingRecord.settled_data) {
        // If settled, return the snapshot data EXACTLY as it was
        const settledData = existingRecord.settled_data as any
        return {
            success: true,
            data: {
                id: existingRecord.id,
                userId,
                displayName: userData.display_name || 'Unknown',
                avatarUrl: userData.avatar_url, // Always use current avatar
                yearMonth,
                type: (settledData.salaryType as SalaryType) || 'monthly',
                status: 'SETTLED',

                baseSalary: settledData.base_salary,
                bonus: settledData.bonus,
                deduction: settledData.details?.deduction || 0,
                totalSalary: settledData.total_salary,
                rate: settledData.rate,

                workHours: settledData.work_minutes,
                lateCount: settledData.details?.lateCount || 0,
                earlyLeaveCount: settledData.details?.earlyLeaveCount || 0,
                leaveDays: settledData.details?.leaveDays || 0,
                leaveDetails: settledData.details?.leaveDetails || {},
                totalBreakHours: settledData.details?.totalBreakHours || 0,

                notes: existingRecord.notes || '',
                settledDate: existingRecord.paid_at,
                workStartTime: settledData.details?.workStartTime || userData.work_start_time || '09:00:00',
                workEndTime: settledData.details?.workEndTime || userData.work_end_time || '18:00:00'
            }
        }
    }

    // --- LIVE CALCULATION ---

    // 4. Get Attendance
    const { data: attendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', userId)
        .gte('work_date', startDate)
        .lte('work_date', endDate)

    // 5. Get Leaves
    const { data: leaves } = await supabase
        .from('leaves')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'approved')
        .gte('start_date', startDate)
        .lte('end_date', endDate)

    const salaryType = (userData.salary_type as SalaryType) || 'monthly'
    const salaryAmount = userData.salary_amount || 0

    let workHours = 0
    let totalBreakHours = 0
    let lateCount = 0
    let earlyLeaveCount = 0
    let leaveDays = 0
    let leaveDetails: Record<string, number> = {}

    // Process Attendance
    if (attendance) {
        // 【診斷】工時異常偵測：若該月出勤筆數或單筆工時異常大，輸出警告
        if (attendance.length > 35) {
            console.warn(`[Salary] 異常：${userId} 在 ${yearMonth} 有 ${attendance.length} 筆出勤記錄（超過一個月天數），請檢查 DB 日期篩選是否正確。startDate=${startDate}, endDate=${endDate}`)
        }
        attendance.forEach((record: any) => {
            const minutes = Number(record.work_minutes) || 0
            if (minutes > 1440) {
                console.warn(`[Salary] 異常工時(分)：attendance id=${record.id}, work_date=${record.work_date}, work_minutes=${record.work_minutes}`)
            }
            workHours += minutes / 60
            totalBreakHours += (Number(record.break_duration) || 0) / 60
            if (record.status?.includes('late')) lateCount++
            if (record.status?.includes('early_leave')) earlyLeaveCount++
        })
    }

    // Process Leaves
    if (leaves) {
        leaves.forEach((leave: any) => {
            // 新版架構：直接讀取 record 裡的 days，因為單筆 row 就是精確的一天(0.5 / 1.0)
            const days = Number(leave.days) || 0;
            leaveDays += days;
            leaveDetails[leave.leave_type] = (leaveDetails[leave.leave_type] || 0) + days;
        })
    }

    // Calculation Logic
    let baseSalary = 0
    if (salaryType === 'monthly') {
        baseSalary = salaryAmount
    } else {
        baseSalary = workHours * salaryAmount
    }

    // Bonus & Notes from existing record (even if not settled)
    const bonus = existingRecord?.bonus || 0
    const notes = existingRecord?.notes || ''

    // Deduction Logic:
    let deduction = 0
    let deductPoints = 0

    // 計算無薪假點數 (扣薪權重)
    if (leaves) {
        leaves.forEach((leave: any) => {
            const weight = getLeaveDeductionWeight(leave.leave_type)
            deductPoints += (Number(leave.days) || 0) * weight
        })
    }

    if (salaryType === 'monthly' && deductPoints > 0) {
        // 月薪制扣薪：預設每月 30 天做分母
        const dailyRate = Math.round(salaryAmount / 30)
        deduction = Math.ceil(dailyRate * deductPoints) // 採用無條件進位取整數
    }

    const totalSalary = Math.ceil(baseSalary + bonus - deduction) // 總薪資也無條件進位

    const result: SalaryRecordData = {
        id: existingRecord?.id,
        userId,
        displayName: userData.display_name || 'Unknown',
        avatarUrl: userData.avatar_url,
        yearMonth,
        type: salaryType,
        status: 'UNSETTLED',

        baseSalary,
        bonus,
        deduction,
        totalSalary,

        workHours: parseFloat(workHours.toFixed(2)),
        totalBreakHours: parseFloat(totalBreakHours.toFixed(2)),
        lateCount,
        earlyLeaveCount,
        leaveDays,
        leaveDetails,

        rate: salaryAmount,

        notes,
        workStartTime: userData.work_start_time || '09:00:00',
        workEndTime: userData.work_end_time || '18:00:00'
    }

    return { success: true, data: result }
}

/**
 * Save the calculated salary record to DB
 * This is called automatically when viewing the page to ensure DB has latest data
 */
export async function saveSalaryRecord(data: SalaryRecordData): Promise<ActionResponse> {
    const supabase = await createClient() as any

    // Only update if NOT settled/paid
    if (data.status === 'SETTLED') return { success: true }

    const details: SalaryDetails = {
        baseSalary: data.baseSalary,
        workHours: data.workHours,
        salaryType: data.type,
        lateCount: data.lateCount,
        earlyLeaveCount: data.earlyLeaveCount,
        leaveDays: data.leaveDays,
        leaveDetails: {}, // can populate if passed
        totalBreakHours: data.totalBreakHours,
        deduction: data.deduction
    }

    const { error } = await supabase
        .from('salary_records')
        .upsert({
            user_id: data.userId,
            year_month: data.yearMonth,
            base_salary: data.baseSalary,
            work_minutes: data.workHours,
            bonus: data.bonus,
            total_salary: data.totalSalary,
            notes: data.notes,
            details: details,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'user_id,year_month'
        })

    if (error) return { error: error.message }
    return { success: true }
}

/**
 * Update Bonus
 */
export async function updateBonus(userId: string, yearMonth: string, amount: number, notes: string): Promise<ActionResponse> {
    const supabase = await createClient() as any

    // Check if settled first
    const { data: record } = await supabase
        .from('salary_records')
        .select('is_paid')
        .eq('user_id', userId)
        .eq('year_month', yearMonth)
        .single()

    if (record?.is_paid) return { error: '已結算之薪資無法修改獎金' }

    // Trigger update
    const { error } = await supabase
        .from('salary_records')
        .update({
            bonus: amount,
            notes: notes,
            updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('year_month', yearMonth)

    if (error) return { error: error.message }

    // Re-calculate total immediately to keep DB consistent
    const calc = await calculateMonthlySalary(userId, yearMonth)
    if (calc.success && calc.data) {
        await saveSalaryRecord(calc.data)
    }

    revalidatePath('/admin/salary')
    return { success: true }
}

/**
 * Settle Salary (Lock it)
 */
export async function settleSalary(userId: string, yearMonth: string): Promise<ActionResponse> {
    const supabase = await createClient() as any

    // 1. Get STRICT LATEST calculation
    // This ensures we settle on exactly what the system thinks is right at this moment
    const calc = await calculateMonthlySalary(userId, yearMonth)
    if (!calc.success || !calc.data) return { error: calc.error || 'Calculation failed' }

    const data = calc.data

    if (data.status === 'SETTLED') return { error: '此薪資單已結算' }

    // 2. Prepare Snapshot
    // This JSONB object is the "Single Source of Truth" for history
    const settledData = {
        salaryType: data.type,
        base_salary: data.baseSalary,
        bonus: data.bonus,
        total_salary: data.totalSalary,
        work_minutes: data.workHours,
        rate: data.rate,
        details: {
            lateCount: data.lateCount,
            earlyLeaveCount: data.earlyLeaveCount,
            leaveDays: data.leaveDays,
            leaveDetails: data.leaveDetails,
            totalBreakHours: data.totalBreakHours,
            workStartTime: data.workStartTime,
            workEndTime: data.workEndTime
        }
    }

    // 3. Update DB - Lock it
    const { error } = await supabase
        .from('salary_records')
        .update({
            is_paid: true,
            paid_at: new Date().toISOString(),
            settled_data: settledData,
            total_salary: data.totalSalary,
            base_salary: data.baseSalary, // Ensure columns match snapshot
            work_minutes: data.workHours,
            bonus: data.bonus,
            updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('year_month', yearMonth)

    if (error) return { error: error.message }

    revalidatePath('/admin/salary')
    return { success: true }
}

/**
 * Resettle Salary (Unlock it)
 */
export async function resettleSalary(userId: string, yearMonth: string): Promise<ActionResponse> {
    const supabase = await createClient() as any

    // 1. Unlock
    const { error } = await supabase
        .from('salary_records')
        .update({
            is_paid: false,
            paid_at: null,
            settled_data: null,
            updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('year_month', yearMonth)

    if (error) return { error: error.message }

    // 2. Trigger Fresh Calculation immediately
    // This ensures the user sees the "Live" data right after unlocking, not the old settled data
    const calc = await calculateMonthlySalary(userId, yearMonth)
    if (calc.data) {
        await saveSalaryRecord(calc.data)
    }

    revalidatePath('/admin/salary')
    return { success: true }
}

/**
 * Batch calculate all employees' salary for a given month.
 * DB round-trips: fixed 5 (regardless of employee count).
 * Does NOT call saveSalaryRecord automatically (Plan B optimization merged).
 */
export async function calculateAllMonthlySalaries(yearMonth: string): Promise<ActionResponse<SalaryRecordData[]>> {
    const supabase = await createClient() as any

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const { data: adminUser } = await supabase
        .from('users').select('role').eq('id', user.id).single()

    if (!adminUser || !['manager', 'super_admin'].includes(adminUser.role)) {
        return { error: 'Permission denied' }
    }

    const [yearStr, monthStr] = yearMonth.split('-')
    const yearNum = parseInt(yearStr)
    const monthNum = parseInt(monthStr)
    const lastDay = new Date(yearNum, monthNum, 0).getDate()
    const startDate = `${yearMonth}-01`
    const endDate = `${yearMonth}-${String(lastDay).padStart(2, '0')}`

    // 1. All employees
    const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, display_name, avatar_url, salary_type, salary_amount, work_start_time, work_end_time')
        .in('role', ['employee', 'manager', 'super_admin'])
        .order('id', { ascending: true })

    if (usersError || !users) return { error: usersError?.message || 'Failed to fetch users' }
    const userIds = users.map((u: any) => u.id)

    // 2. Batch attendance (single query)
    const { data: allAttendance } = await supabase
        .from('attendance')
        .select('user_id, work_minutes, break_duration, status, work_date')
        .in('user_id', userIds)
        .gte('work_date', startDate)
        .lte('work_date', endDate)

    // 3. Batch leaves (single query)
    const { data: allLeaves } = await supabase
        .from('leaves')
        .select('user_id, leave_type, days')
        .in('user_id', userIds)
        .eq('status', 'approved')
        .gte('start_date', startDate)
        .lte('end_date', endDate)

    // 4. Batch salary records (single query)
    const { data: allSalaryRecords } = await supabase
        .from('salary_records')
        .select('*')
        .in('user_id', userIds)
        .eq('year_month', yearMonth)

    // 5. Group by user in JS
    const attendanceByUser = new Map<string, any[]>()
    const leavesByUser = new Map<string, any[]>()
    const salaryRecordByUser = new Map<string, any>()

        ; (allAttendance || []).forEach((rec: any) => {
            if (!attendanceByUser.has(rec.user_id)) attendanceByUser.set(rec.user_id, [])
            attendanceByUser.get(rec.user_id)!.push(rec)
        })
        ; (allLeaves || []).forEach((rec: any) => {
            if (!leavesByUser.has(rec.user_id)) leavesByUser.set(rec.user_id, [])
            leavesByUser.get(rec.user_id)!.push(rec)
        })
        ; (allSalaryRecords || []).forEach((rec: any) => {
            salaryRecordByUser.set(rec.user_id, rec)
        })

    // 6. Calculate per user
    const results: SalaryRecordData[] = users.map((userData: any) => {
        const existingRecord = salaryRecordByUser.get(userData.id)

        // Settled: return snapshot directly
        if (existingRecord?.is_paid && existingRecord.settled_data) {
            const s = existingRecord.settled_data as any
            return {
                id: existingRecord.id,
                userId: userData.id,
                displayName: userData.display_name || 'Unknown',
                avatarUrl: userData.avatar_url,
                yearMonth,
                type: (s.salaryType as SalaryType) || 'monthly',
                status: 'SETTLED' as const,
                baseSalary: s.base_salary,
                bonus: s.bonus,
                deduction: s.details?.deduction || 0,
                totalSalary: s.total_salary,
                rate: s.rate,
                workHours: s.work_minutes,
                lateCount: s.details?.lateCount || 0,
                earlyLeaveCount: s.details?.earlyLeaveCount || 0,
                leaveDays: s.details?.leaveDays || 0,
                leaveDetails: s.details?.leaveDetails || {},
                totalBreakHours: s.details?.totalBreakHours || 0,
                notes: existingRecord.notes || '',
                settledDate: existingRecord.paid_at,
                workStartTime: s.details?.workStartTime || userData.work_start_time || '09:00:00',
                workEndTime: s.details?.workEndTime || userData.work_end_time || '18:00:00',
            } satisfies SalaryRecordData
        }

        // Unsettled: live calculation
        const attendance = attendanceByUser.get(userData.id) || []
        const leaves = leavesByUser.get(userData.id) || []
        const salaryType = (userData.salary_type as SalaryType) || 'monthly'
        const salaryAmount = userData.salary_amount || 0

        let workHours = 0, totalBreakHours = 0, lateCount = 0, earlyLeaveCount = 0, leaveDays = 0
        const leaveDetails: Record<string, number> = {}

        attendance.forEach((rec: any) => {
            const minutes = Number(rec.work_minutes) || 0
            if (minutes > 1440) {
                console.warn(`[Salary Batch] Abnormal work_minutes: work_date=${rec.work_date}, work_minutes=${rec.work_minutes}, user=${userData.display_name}`)
            }
            workHours += minutes / 60
            totalBreakHours += (Number(rec.break_duration) || 0) / 60
            if (rec.status?.includes('late')) lateCount++
            if (rec.status?.includes('early_leave')) earlyLeaveCount++
        })

        leaves.forEach((leave: any) => {
            const days = Number(leave.days) || 0
            leaveDays += days
            leaveDetails[leave.leave_type] = (leaveDetails[leave.leave_type] || 0) + days
        })

        const baseSalary = salaryType === 'monthly' ? salaryAmount : workHours * salaryAmount
        const bonus = existingRecord?.bonus || 0
        const notes = existingRecord?.notes || ''

        let deduction = 0
        let deductPoints = 0

        leaves.forEach((leave: any) => {
            const weight = getLeaveDeductionWeight(leave.leave_type)
            deductPoints += (Number(leave.days) || 0) * weight
        })

        if (salaryType === 'monthly' && deductPoints > 0) {
            const dailyRate = Math.round(salaryAmount / 30)
            deduction = Math.ceil(dailyRate * deductPoints) // 採用無條件進位取整數
        }

        const totalSalary = Math.ceil(baseSalary + bonus - deduction) // 總薪資也無條件進位

        return {
            id: existingRecord?.id,
            userId: userData.id,
            displayName: userData.display_name || 'Unknown',
            avatarUrl: userData.avatar_url,
            yearMonth,
            type: salaryType,
            status: 'UNSETTLED' as const,
            baseSalary,
            bonus,
            deduction,
            totalSalary,
            workHours: parseFloat(workHours.toFixed(2)),
            totalBreakHours: parseFloat(totalBreakHours.toFixed(2)),
            lateCount,
            earlyLeaveCount,
            leaveDays,
            leaveDetails,
            rate: salaryAmount,
            notes,
            workStartTime: userData.work_start_time || '09:00:00',
            workEndTime: userData.work_end_time || '18:00:00'
        } satisfies SalaryRecordData
    })

    return { success: true, data: results }
}
