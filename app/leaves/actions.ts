'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { calculateAnnualLeaveDays } from '@/utils/leave-calculations'

/**
 * 獲取並初始化我的年度特休餘額
 */
/**
 * 獲取並初始化我的年度特休餘額
 */
export async function getAnnualLeaveBalance() {
    const supabase = await createClient() as any
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    // 直接從 users 表獲取特休資訊
    const { data: userProfile, error } = await supabase
        .from('users')
        .select('annual_leave_total, annual_leave_used')
        .eq('id', user.id)
        .single()

    if (error) {
        console.error('Error fetching annual leave balance:', error)
        return { error: '無法獲取特休餘額' }
    }

    return {
        data: {
            total_days: Number(userProfile.annual_leave_total) || 0,
            used_days: Number(userProfile.annual_leave_used) || 0,
            remaining_days: (Number(userProfile.annual_leave_total) || 0) - (Number(userProfile.annual_leave_used) || 0)
        }
    }
}

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

    const supabase = await createClient() as any
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }
    if (!leaveType || !startDate || !endDate || !reason) {
        return { error: '請填寫完整資訊' }
    }

    // 簡單檢查日期順序
    if (new Date(startDate) > new Date(endDate)) {
        return { error: '結束日期不能早於開始日期' }
    }

    // 特休假餘額檢查 (Annual Leave)
    if (leaveType === 'annual_leave') {
        const days = hours / 8 // 假設一天 8 小時
        const currentYear = new Date(startDate).getFullYear()

        // 獲取使用者特休資訊
        const { data: userProfile } = await supabase
            .from('users')
            .select('annual_leave_total, annual_leave_used')
            .eq('id', user.id)
            .single()

        if (!userProfile) {
            return { error: '無法獲取使用者資訊' }
        }

        const totalDays = Number(userProfile.annual_leave_total) || 0
        // 不需要 used from DB because we calc "pending" separately below

        if (totalDays === 0) {
            return { error: '您目前沒有特休額度 (請確認到職日是否已設定)' }
        }

        // 改進：計算所有 pending + approved 的 annual leave (包含 DB 中已記錄為 used 的，但因為我們重構了，
        // DB 的 annual_leave_used 應該是「已核准並扣除」的。
        // 所以 總使用 = DB.used + Pending Leaves in 'leaves' table.
        // 而 Action 裡原本的邏輯是 sum(pending + approved in leaves table).
        // 如果我們採信 `users.annual_leave_used` 是 source of truth for APPROVED leaves,
        // 那麼我們只需要加上 `pending` 的。
        // 但為了安全起見，且避免同步問題，我們這裡採用標準做法：
        // 檢查限額 = (已核准 + 審核中 + 本次申請) <= 總額

        // 1. 本次申請
        // days is already calculated

        // 2. 已核准 (來自 users.annual_leave_used)
        const approvedDays = Number(userProfile.annual_leave_used) || 0

        // 3. 審核中 (Query leaves table for pending annual leaves)
        const { data: pendingLeaves } = await supabase
            .from('leaves')
            .select('hours')
            .eq('user_id', user.id)
            .eq('leave_type', 'annual_leave') // 注意：確保 type string 一致 (前端傳 'annual_leave'?)
            .eq('status', 'pending')
            .gte('start_date', `${currentYear}-01-01`) // Optional: 限制年度? 特休跨年度通常有別的處理，這裡先簡化

        const pendingHours = (pendingLeaves as any[])?.reduce((sum: number, l: any) => sum + (l.hours || 0), 0) || 0
        const pendingDays = pendingHours / 8

        if ((approvedDays + pendingDays + days) > totalDays) {
            const remaining = totalDays - approvedDays - pendingDays
            return { error: `特休額度不足。剩餘(含審核中扣除): ${remaining.toFixed(2)} 天，本次申請: ${days} 天` }
        }
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

    // 注意：這裡我們沒有更新 leave_balances.used_days。
    // 正確的做法應該是：
    // 1. Approve 時更新 used_days
    // 2. Reject 時不動作
    // 3. Cancel 時不動作 (因為沒扣)
    // 但為了顯示「剩餘天數」，我們需要在前端顯示時扣掉 pending 的部分。

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

    // [NEW] 如果是批准特休，更新 users.annual_leave_used
    if (status === 'approved') {
        const { data: leave } = await supabase
            .from('leaves')
            .select('leave_type, hours, user_id')
            .eq('id', leaveId)
            .single()

        if (leave && (leave as any).leave_type === 'annual_leave') {
            const days = (leave as any).hours / 8
            // RPC call or straight update? Straight update is risky for concurrency but okay for now.
            // Ideally use rpc('increment_annual_leave_used', { uid: leave.user_id, delta: days })

            // Fetch current used
            const { data: u } = await supabase.from('users').select('annual_leave_used').eq('id', (leave as any).user_id).single()
            const newUsed = (Number((u as any)?.annual_leave_used) || 0) + days

            await supabase.from('users').update({ annual_leave_used: newUsed }).eq('id', (leave as any).user_id)
        }
    }

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

/**
 * 提交請假取消申請
 * 只能取消已批准的請假
 */
export async function cancelLeaveRequest(leaveId: number, cancelReason: string) {
    const supabase = await createClient() as any
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }
    if (!cancelReason || cancelReason.trim() === '') {
        return { error: '請填寫取消原因' }
    }

    // 1. 檢查請假記錄是否存在且已批准
    const { data: leave } = await supabase
        .from('leaves')
        .select('id, user_id, status, start_date, end_date, leave_type')
        .eq('id', leaveId)
        .single() as any

    if (!leave) return { error: '請假記錄不存在' }
    if (leave.user_id !== user.id) return { error: '無權限操作' }
    if (leave.status !== 'approved') {
        return { error: '只能取消已批准的請假' }
    }

    // 2. 檢查是否已有待審核的取消申請
    const { data: existingCancellation } = await supabase
        .from('leave_cancellations')
        .select('id, status')
        .eq('leave_id', leaveId)
        .eq('status', 'pending')
        .single() as any

    if (existingCancellation) {
        return { error: '已有待審核的取消申請' }
    }

    // 3. 創建取消申請記錄
    // @ts-ignore
    const { error: insertError } = await (supabase.from('leave_cancellations') as any).insert({
        leave_id: leaveId,
        user_id: user.id,
        cancel_reason: cancelReason,
        status: 'pending'
    })

    if (insertError) return { error: insertError.message }

    // 4. 發送通知給所有主管
    const { data: managers } = await supabase
        .from('users')
        .select('id')
        .in('role', ['manager', 'super_admin'])

    if (managers && managers.length > 0) {
        const { createNotification } = await import('@/app/notifications/actions')
        const { data: userData } = await supabase
            .from('users')
            .select('display_name')
            .eq('id', user.id)
            .single() as any

        const userName = userData?.display_name || '員工'

        for (const manager of managers) {
            await createNotification(
                manager.id,
                'leave_cancel_request',
                '請假取消申請',
                `${userName} 申請取消請假`,
                '/admin/leaves'
            )
        }
    }

    revalidatePath('/leaves')
    revalidatePath('/admin/leaves')
    return { success: true }
}

/**
 * [Manager Only] 獲取所有待審核的取消申請
 */
export async function getPendingCancellations() {
    const supabase = await createClient() as any
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
        .from('leave_cancellations')
        .select(`
            *,
            leave:leaves!leave_id (
                start_date,
                end_date,
                leave_type,
                hours
            ),
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
 * [Manager Only] 審核請假取消申請
 */
export async function reviewLeaveCancellation(
    cancellationId: number,
    approved: boolean
) {
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

    // 1. 獲取取消申請詳情
    const { data: cancellation } = await supabase
        .from('leave_cancellations')
        .select('id, leave_id, user_id, status')
        .eq('id', cancellationId)
        .single() as any

    if (!cancellation) return { error: '取消申請不存在' }
    if (cancellation.status !== 'pending') {
        return { error: '此申請已被審核' }
    }

    // 2. 更新取消申請狀態
    const newStatus = approved ? 'approved' : 'rejected'
    // @ts-ignore
    const { error: updateError } = await (supabase.from('leave_cancellations') as any)
        .update({
            status: newStatus,
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString()
        })
        .eq('id', cancellationId)

    if (updateError) return { error: updateError.message }

    // 3. 如果批准,更新原請假記錄狀態為 cancelled
    if (approved) {
        // @ts-ignore
        const { error: leaveUpdateError } = await (supabase.from('leaves') as any)
            .update({ status: 'cancelled' })
            .eq('id', cancellation.leave_id)

        if (leaveUpdateError) return { error: leaveUpdateError.message }
    }

    // 4. 發送通知給申請人
    const { createNotification } = await import('@/app/notifications/actions')
    await createNotification(
        cancellation.user_id,
        approved ? 'leave_cancel_approved' : 'leave_cancel_rejected',
        approved ? '取消請假已批准' : '取消請假已拒絕',
        approved ? '您的取消請假申請已通過審核' : '您的取消請假申請未通過審核',
        '/leaves'
    )

    revalidatePath('/leaves')
    revalidatePath('/admin/leaves')
    return { success: true }
}
