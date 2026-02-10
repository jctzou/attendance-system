'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * 計算指定員工的月薪
 */
export async function calculateMonthlySalary(userId: string, yearMonth: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    // 檢查管理員權限
    const { data: adminData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single() as any

    if (!adminData || !['manager', 'super_admin'].includes(adminData.role)) {
        return { error: 'Permission denied: Managers only' }
    }

    // 獲取員工資料
    const { data: userData } = await supabase
        .from('users')
        .select('salary_type, salary_amount')
        .eq('id', userId)
        .single() as any

    if (!userData) return { error: 'User not found' }

    let baseSalary = 0
    let workHours = 0

    if (userData.salary_type === 'monthly') {
        // 月薪人員：固定薪資
        baseSalary = userData.salary_amount || 0
    } else {
        // 鐘點人員：計算總工時
        const [year, month] = yearMonth.split('-')
        const startDate = `${year}-${month}-01`
        const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0]

        const { data: attendanceData } = await supabase
            .from('attendance')
            .select('work_hours')
            .eq('user_id', userId)
            .gte('work_date', startDate)
            .lte('work_date', endDate)

        if (attendanceData) {
            workHours = attendanceData.reduce((sum, record) => sum + (parseFloat(record.work_hours) || 0), 0)
            baseSalary = workHours * (userData.salary_amount || 0)
        }
    }

    // 獲取該月獎金
    const { data: bonusData } = await supabase
        .from('bonuses')
        .select('amount')
        .eq('user_id', userId)
        .gte('granted_at', `${yearMonth}-01`)
        .lt('granted_at', `${yearMonth}-32`)

    const bonus = bonusData?.reduce((sum, b) => sum + parseFloat(b.amount.toString()), 0) || 0

    const totalSalary = baseSalary + bonus

    return {
        data: {
            baseSalary: parseFloat(baseSalary.toFixed(2)),
            workHours: parseFloat(workHours.toFixed(2)),
            bonus: parseFloat(bonus.toFixed(2)),
            totalSalary: parseFloat(totalSalary.toFixed(2))
        }
    }
}

/**
 * 獲取所有員工的薪資記錄
 */
export async function getSalaryRecords(yearMonth: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    // 檢查管理員權限
    const { data: adminData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single() as any

    if (!adminData || !['manager', 'super_admin'].includes(adminData.role)) {
        return { error: 'Permission denied: Managers only' }
    }

    const { data, error } = await supabase
        .from('salary_records')
        .select(`
            *,
            user:users!user_id (
                display_name,
                email,
                employee_id,
                salary_type
            )
        `)
        .eq('year_month', yearMonth)
        .order('created_at', { ascending: false })

    if (error) return { error: error.message }
    return { data }
}

/**
 * 建立或更新薪資記錄
 */
export async function upsertSalaryRecord(
    userId: string,
    yearMonth: string,
    data: {
        baseSalary: number
        workHours: number
        bonus: number
        deduction?: number
        totalSalary: number
        notes?: string
    }
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    // 檢查管理員權限
    const { data: adminData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single() as any

    if (!adminData || !['manager', 'super_admin'].includes(adminData.role)) {
        return { error: 'Permission denied: Managers only' }
    }

    // @ts-ignore
    const { error } = await (supabase.from('salary_records') as any).upsert({
        user_id: userId,
        year_month: yearMonth,
        base_salary: data.baseSalary,
        work_hours: data.workHours,
        bonus: data.bonus,
        deduction: data.deduction || 0,
        total_salary: data.totalSalary,
        notes: data.notes,
        updated_at: new Date().toISOString()
    }, {
        onConflict: 'user_id,year_month'
    })

    if (error) return { error: error.message }

    revalidatePath('/admin/salary')
    return { success: true }
}

/**
 * 標記薪資為已發放
 */
export async function markAsPaid(recordId: number) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    // 檢查管理員權限
    const { data: adminData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single() as any

    if (!adminData || !['manager', 'super_admin'].includes(adminData.role)) {
        return { error: 'Permission denied: Managers only' }
    }

    // @ts-ignore
    const { error } = await (supabase.from('salary_records') as any)
        .update({
            is_paid: true,
            paid_at: new Date().toISOString()
        })
        .eq('id', recordId)

    if (error) return { error: error.message }

    revalidatePath('/admin/salary')
    return { success: true }
}

/**
 * 追加獎金
 */
export async function addBonus(userId: string, amount: number, reason: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    // 檢查管理員權限
    const { data: adminData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single() as any

    if (!adminData || !['manager', 'super_admin'].includes(adminData.role)) {
        return { error: 'Permission denied: Managers only' }
    }

    // @ts-ignore
    const { error } = await (supabase.from('bonuses') as any).insert({
        user_id: userId,
        amount,
        reason,
        granted_by: user.id
    })

    if (error) return { error: error.message }

    revalidatePath('/admin/salary')
    return { success: true }
}

/**
 * 獲取獎金歷史
 */
export async function getBonusHistory(userId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    const { data, error } = await supabase
        .from('bonuses')
        .select(`
            *,
            granted_by_user:users!granted_by (
                display_name
            )
        `)
        .eq('user_id', userId)
        .order('granted_at', { ascending: false })

    if (error) return { error: error.message }
    return { data }
}

/**
 * 獲取所有員工
 */
export async function getAllUsers() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    // 檢查管理員權限
    const { data: adminData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single() as any

    if (!adminData || !['manager', 'super_admin'].includes(adminData.role)) {
        return { error: 'Permission denied: Managers only' }
    }

    const { data, error } = await supabase
        .from('users')
        .select('id, display_name, email, employee_id, salary_type')
        .eq('is_active', true)
        .order('employee_id')

    if (error) return { error: error.message }
    return { data }
}

