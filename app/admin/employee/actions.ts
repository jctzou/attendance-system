'use server'

import { createClient } from '@/utils/supabase/server'

/**
 * 獲取員工詳細資料
 */
export async function getEmployeeDetails(userId: string) {
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
        .select('*')
        .eq('id', userId)
        .single()

    if (error) return { error: error.message }
    return { data }
}

/**
 * 獲取員工打卡記錄
 */
export async function getEmployeeAttendance(userId: string, yearMonth: string) {
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

    const [year, month] = yearMonth.split('-')
    const startDate = `${year}-${month}-01`
    const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0]

    const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', userId)
        .gte('work_date', startDate)
        .lte('work_date', endDate)
        .order('work_date', { ascending: true })

    if (error) return { error: error.message }
    return { data }
}

/**
 * 獲取員工請假記錄
 */
export async function getEmployeeLeaves(userId: string, yearMonth: string) {
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

    const [year, month] = yearMonth.split('-')
    const startDate = `${year}-${month}-01`
    const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0]

    const { data, error } = await supabase
        .from('leaves')
        .select('*')
        .eq('user_id', userId)
        .gte('start_date', startDate)
        .lte('end_date', endDate)
        .order('start_date', { ascending: true })

    if (error) return { error: error.message }
    return { data }
}
