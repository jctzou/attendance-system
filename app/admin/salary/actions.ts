'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

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
}

export interface SalaryRecordData {
    id?: number
    userId: string
    displayName: string
    yearMonth: string
    type: SalaryType
    status: 'SETTLED' | 'UNSETTLED'

    // Financials
    baseSalary: number
    bonus: number
    totalSalary: number

    // Stats
    workHours: number
    lateCount: number
    earlyLeaveCount: number
    leaveDays: number
    totalBreakHours?: number // New field

    rate: number // Hourly rate or Monthly base

    notes?: string
    settledDate?: string
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
        .select('display_name, salary_type, salary_amount')
        .eq('id', userId)
        .single()

    if (userError || !userData) return { error: 'User not found' }

    // 2. Define Date Range
    const [year, month] = yearMonth.split('-')
    const startDate = `${year}-${month}-01`
    const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0]

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
                displayName: userData.display_name,
                yearMonth,
                type: (settledData.salaryType as SalaryType) || 'monthly',
                status: 'SETTLED',

                baseSalary: settledData.base_salary,
                bonus: settledData.bonus,
                totalSalary: settledData.total_salary,
                rate: settledData.rate,

                workHours: settledData.work_hours,
                lateCount: settledData.details?.lateCount || 0,
                earlyLeaveCount: settledData.details?.earlyLeaveCount || 0,
                leaveDays: settledData.details?.leaveDays || 0,
                totalBreakHours: settledData.details?.totalBreakHours || 0,

                notes: existingRecord.notes || '',
                settledDate: existingRecord.paid_at
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
        attendance.forEach((record: any) => {
            workHours += Number(record.work_hours) || 0
            totalBreakHours += Number(record.break_duration) || 0
            if (record.status?.includes('late')) lateCount++
            if (record.status?.includes('early_leave')) earlyLeaveCount++
        })
    }

    // Process Leaves
    if (leaves) {
        leaves.forEach((leave: any) => {
            const start = new Date(leave.start_date)
            const end = new Date(leave.end_date)
            const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
            leaveDays += days
            leaveDetails[leave.leave_type] = (leaveDetails[leave.leave_type] || 0) + days
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

    // TODO: Add Deduction Logic if specified
    const totalSalary = baseSalary + bonus

    const result: SalaryRecordData = {
        id: existingRecord?.id,
        userId,
        displayName: userData.display_name,
        yearMonth,
        type: salaryType,
        status: 'UNSETTLED',

        baseSalary,
        bonus,
        totalSalary,

        workHours: parseFloat(workHours.toFixed(2)),
        totalBreakHours: parseFloat(totalBreakHours.toFixed(2)),
        lateCount,
        earlyLeaveCount,
        leaveDays,

        rate: salaryAmount,

        notes
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
        totalBreakHours: data.totalBreakHours
    }

    const { error } = await supabase
        .from('salary_records')
        .upsert({
            user_id: data.userId,
            year_month: data.yearMonth,
            base_salary: data.baseSalary,
            work_hours: data.workHours,
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
        work_hours: data.workHours,
        rate: data.rate,
        details: {
            lateCount: data.lateCount,
            earlyLeaveCount: data.earlyLeaveCount,
            leaveDays: data.leaveDays,
            totalBreakHours: data.totalBreakHours
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
            work_hours: data.workHours,
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
