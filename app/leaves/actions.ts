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

    // 通知所有管理員
    const { data: managers } = await supabase
        .from('users')
        .select('id')
        .in('role', ['manager', 'super_admin'])

    if (managers && managers.length > 0) {
        const { createNotification } = await import('@/app/notifications/actions')
        for (const manager of managers) {
            await createNotification(
                manager.id,
                'new_leave_request',
                '新的請假申請',
                `有新的請假申請待審核`,
                '/admin/leaves'
            )
        }
    }

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

/**
 * [Manager Only] 獲取所有待審核的請假單
 */
export async function getPendingLeaves() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    // Check if manager
    const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single() as any

    if (!userData || !['manager', 'super_admin'].includes(userData.role)) {
        return { error: 'Permission denied: Managers only' }
    }

    const { data, error } = await supabase
        .from('leaves')
        .select(`
            *,
            user:users!user_id (
                display_name,
                email
            )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })

    if (error) return { error: error.message }
    return { data }
}

/**
 * [Manager Only] 審核請假
 */
export async function reviewLeave(leaveId: number, status: 'approved' | 'rejected', comment?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    // Check if manager
    const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single() as any

    if (!userData || !['manager', 'super_admin'].includes(userData.role)) {
        return { error: 'Permission denied' }
    }

    // @ts-ignore
    const { error } = await (supabase.from('leaves') as any)
        .update({ status: status })
        .eq('id', leaveId)

    if (error) return { error: error.message }

    // 通知申請人
    const { data: leave } = await supabase
        .from('leaves')
        .select('user_id')
        .eq('id', leaveId)
        .single() as any

    if (leave) {
        const { createNotification } = await import('@/app/notifications/actions')
        const isApproved = status === 'approved'
        await createNotification(
            leave.user_id,
            status === 'approved' ? 'leave_approved' : 'leave_rejected',
            isApproved ? '請假已批准' : '請假已拒絕',
            isApproved ? '您的請假申請已通過審核' : '您的請假申請未通過審核',
            '/leaves'  // 員工查看自己的請假頁面
        )
    }

    revalidatePath('/leaves')
    revalidatePath('/admin/leaves')
    return { success: true }
}
