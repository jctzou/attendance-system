'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * 提交請假申請
 */
export async function applyLeave(
    leaveType: string,
    startDate: string,
    endDate: string,
    hours: number,
    reason: string
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }
    if (!leaveType || !startDate || !endDate || !reason) {
        return { error: '請填寫完整資訊' }
    }

    // 簡單檢查日期順序
    if (new Date(startDate) > new Date(endDate)) {
        return { error: '結束日期不能早於開始日期' }
    }

    // @ts-ignore
    const { error } = await (supabase.from('leaves') as any).insert({
        user_id: user.id,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        hours: hours,
        reason: reason,
        status: 'pending' // 預設待審核
    })

    if (error) return { error: error.message }

    revalidatePath('/leaves')
    return { success: true }
}

/**
 * 獲取我的請假紀錄
 */
export async function getMyLeaves() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    const { data, error } = await supabase
        .from('leaves')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (error) return { error: error.message }
    return { data }
}

/**
 * 取消請假 (僅限待審核狀態)
 */
export async function cancelLeave(leaveId: number) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    // 先檢查狀態與擁有者
    const { data: leave } = await supabase
        .from('leaves')
        .select('status, user_id')
        .eq('id', leaveId)
        .single() as any

    if (!leave) return { error: 'Leave not found' }
    if (leave.user_id !== user.id) return { error: 'Permission denied' }
    if (leave.status !== 'pending') return { error: '只能取消待審核的請假' }

    const { error } = await supabase
        .from('leaves')
        .delete()
        .eq('id', leaveId)

    if (error) return { error: error.message }

    revalidatePath('/leaves')
    return { success: true }
}
