'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'
import { createNotification } from '@/app/notifications/actions'
import { z } from 'zod'
import { ActionResult, ErrorCodes } from '@/types/actions'
import { requireUserProfile, requireUserRole, withErrorHandling } from '@/utils/actions_common'
import { checkLeaveConflicts, LeaveRequestDay } from '@/utils/leaves_helper'
import { v4 as uuidv4 } from 'uuid'

const ApplyLeaveSchema = z.object({
    leaveType: z.string().min(1, '請選擇假別'),
    startDate: z.string().min(10, '必須提供開始時間'),
    endDate: z.string().min(10, '必須提供結束時間'),
    days: z.number().positive('請假天數必須大於 0').multipleOf(0.5, '請假天數必須為 0.5 的倍數'),
    reason: z.string().min(1, '請填寫請假事由'),
    dailyStatus: z.array(z.object({
        date: z.string(),
        days: z.number()
    })).min(1, '至少需要一天請假明細')
})

const CancelLeaveReqSchema = z.object({
    leaveId: z.number(),
    cancelReason: z.string().min(1, '請填寫取消原因'),
})

export async function getAnnualLeaveBalance(): Promise<ActionResult<{ total_days: number, used_days: number, remaining_days: number }>> {
    return withErrorHandling(async () => {
        const profile = await requireUserProfile()
        const total = Number(profile.annual_leave_total) || 0;
        const used = Number(profile.annual_leave_used) || 0;
        return {
            total_days: total,
            used_days: used,
            remaining_days: total - used
        }
    })
}

export async function applyLeave(
    leaveType: string,
    startDate: string,
    endDate: string,
    days: number,
    reason: string,
    dailyStatus: LeaveRequestDay[]
): Promise<ActionResult<void>> {
    return withErrorHandling(async () => {
        const input = ApplyLeaveSchema.parse({ leaveType, startDate, endDate, days, reason, dailyStatus })
        const profile = await requireUserProfile()
        const supabase = await createClient()

        if (new Date(input.startDate) > new Date(input.endDate)) {
            throw { code: ErrorCodes.VALIDATION_FAILED, message: '結束日期不能早於開始日期' }
        }

        if (input.leaveType === 'annual_leave' || input.leaveType === 'annual') {
            const currentYear = new Date(input.startDate).getFullYear()
            const totalDays = Number(profile.annual_leave_total) || 0

            if (totalDays === 0) {
                throw { code: ErrorCodes.BUSINESS_CONFLICT, message: '您目前沒有特休額度 (請確認到職日是否已設定)' }
            }

            const approvedDays = Number(profile.annual_leave_used) || 0

            // 查詢待審核特休
            const { data: pendingLeaves } = await supabase
                .from('leaves')
                .select('days')
                .eq('user_id', profile.id)
                .in('leave_type', ['annual_leave', 'annual'])
                .eq('status', 'pending')
                .gte('start_date', `${currentYear}-01-01`)

            const pendingDays = (pendingLeaves || []).reduce((sum, l) => sum + (Number(l.days) || 0), 0)

            if ((approvedDays + pendingDays + input.days) > totalDays) {
                const remaining = totalDays - approvedDays - pendingDays
                throw {
                    code: ErrorCodes.BUSINESS_CONFLICT,
                    message: `特休額度不足。剩餘(含審核中扣除): ${remaining.toFixed(1)} 天，本次申請: ${input.days} 天`
                }
            }
        }

        // 進行防重複請假檢查 (單日上限 1.0)
        const checkResult = await checkLeaveConflicts(supabase, profile.id, input.dailyStatus)
        if (!checkResult.success) {
            throw { code: ErrorCodes.BUSINESS_CONFLICT, message: checkResult.error }
        }

        // 生成群組 ID
        const groupId = uuidv4()

        // 轉換為單日寫入格式
        const insertData = input.dailyStatus.map(d => ({
            user_id: profile.id,
            leave_type: input.leaveType,
            start_date: d.date,       // 都是單日
            end_date: d.date,         // 都是單日
            days: d.days,
            hours: d.days * 8,        // legacy
            reason: input.reason,
            status: 'pending' as const,
            group_id: groupId
        }))

        const { error: insertError } = await supabase.from('leaves').insert(insertData)

        if (insertError) throw new Error(insertError.message)

        // 【新增】發送通知給管理員
        try {
            // 使用 Admin Client 繞過 RLS，因為一般員工無權撈取所有使用者的角色
            const supabaseAdmin = createAdminClient()
            const { data: managers } = await supabaseAdmin.from('users').select('id').in('role', ['manager', 'super_admin'])
            if (managers) {
                for (const m of (managers as any[])) {
                    await createNotification(
                        m.id,
                        'new_leave_request',
                        '新的請假申請',
                        `${profile.display_name} 申請了 ${input.days} 天的 ${input.leaveType}`,
                        '/admin/leaves'
                    )
                }
            }
        } catch (err) {
            console.error('Failed to notify managers about new leave:', err)
        }

        revalidatePath('/leaves')
    })
}

export async function getMyLeaves() {
    return withErrorHandling(async () => {
        const profile = await requireUserProfile()
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('leaves')
            .select('*, approver:users!approver_id(display_name, email)')
            .eq('user_id', profile.id)
            .order('created_at', { ascending: false })

        if (error) throw new Error(error.message)
        return data || []
    })
}

export async function cancelLeave(leaveId: number): Promise<ActionResult<void>> {
    return withErrorHandling(async () => {
        const profile = await requireUserProfile()
        const supabase = await createClient()

        const { data: leave } = await supabase
            .from('leaves')
            .select('status, user_id')
            .eq('id', leaveId)
            .single()

        if (!leave) throw { code: ErrorCodes.NOT_FOUND, message: '找不到請假紀錄' }
        if (leave.user_id !== profile.id) throw { code: ErrorCodes.FORBIDDEN, message: '權限不足' }
        if (leave.status !== 'pending') throw { code: ErrorCodes.BUSINESS_CONFLICT, message: '只能取消待審核的請假' }

        const { error } = await supabase.from('leaves').delete().eq('id', leaveId)
        if (error) throw new Error(error.message)

        revalidatePath('/leaves')
    })
}

export async function cancelLeaveGroup(groupId: string): Promise<ActionResult<void>> {
    return withErrorHandling(async () => {
        const profile = await requireUserProfile()
        const supabase = await createClient()

        const { data: leaves } = await supabase
            .from('leaves')
            .select('status, user_id')
            .eq('group_id', groupId)

        if (!leaves || leaves.length === 0) throw { code: ErrorCodes.NOT_FOUND, message: '找不到請假紀錄' }

        for (const leave of leaves) {
            if (leave.user_id !== profile.id) throw { code: ErrorCodes.FORBIDDEN, message: '權限不足' }
            if (leave.status !== 'pending') throw { code: ErrorCodes.BUSINESS_CONFLICT, message: '只能取消待審核的請假' }
        }

        const { error } = await supabase.from('leaves').delete().eq('group_id', groupId)
        if (error) throw new Error(error.message)

        revalidatePath('/leaves')
    })
}

/**
 * 員工提出取消已批准假单的申請
 * 假单狀態改為 cancel_pending，等待主管同意
 */
export async function requestCancelLeave(leaveId: number, cancelReason: string): Promise<ActionResult<void>> {
    return withErrorHandling(async () => {
        const parsed = CancelLeaveReqSchema.safeParse({ leaveId, cancelReason })
        if (!parsed.success) throw { code: ErrorCodes.VALIDATION_FAILED, message: parsed.error.flatten().fieldErrors.cancelReason?.[0] || '請填寫取消原因' }

        const profile = await requireUserProfile()
        const supabase = await createClient()

        const { data: leave } = await supabase
            .from('leaves')
            .select('status, user_id')
            .eq('id', leaveId)
            .single()

        if (!leave) throw { code: ErrorCodes.NOT_FOUND, message: '找不到請假紀錄' }
        if (leave.user_id !== profile.id) throw { code: ErrorCodes.FORBIDDEN, message: '權限不足' }
        if (leave.status !== 'approved') throw { code: ErrorCodes.BUSINESS_CONFLICT, message: '只能對已批准的假單提出取消申請' }

        const { error } = await supabase
            .from('leaves')
            .update({ status: 'cancel_pending', cancel_reason: cancelReason })
            .eq('id', leaveId)

        if (error) {
            console.error('[requestCancelLeave] DB error:', error)
            throw new Error(`資料庫更新失敗: ${error.message}`)
        }

        revalidatePath('/leaves')
        revalidatePath('/admin/leaves')
    })
}

/**
 * 主管同意或拒絕員工的取消假單申請
 * approve=true ：同意取消 → 假单從 DB 刪除
 * approve=false ：拒絕取消 → 假单狀態恢復為 approved
 */
export async function approveCancelLeave(leaveId: number, approve: boolean): Promise<ActionResult<void>> {
    return withErrorHandling(async () => {
        await requireUserRole(['manager', 'super_admin'])
        const supabase = await createAdminClient()

        const { data: leave } = await supabase
            .from('leaves')
            .select('status, user_id')
            .eq('id', leaveId)
            .single()

        if (!leave) throw { code: ErrorCodes.NOT_FOUND, message: '找不到請假紀錄' }
        if (leave.status !== 'cancel_pending') throw { code: ErrorCodes.BUSINESS_CONFLICT, message: '該筆請假並非待審取消狀態' }

        if (approve) {
            const { error } = await supabase.from('leaves').delete().eq('id', leaveId)
            if (error) throw new Error(error.message)
        } else {
            const { error } = await supabase.from('leaves').update({ status: 'approved', cancel_reason: null }).eq('id', leaveId)
            if (error) throw new Error(error.message)
        }

        await createNotification(
            leave.user_id,
            'leave_cancel_result',
            approve ? '請假取消已核准' : '請假取消已拒絕',
            approve ? '主管已核准您的請假取消申請' : '主管拒絕了您的請假取消申請，假單方額不變'
        ).catch(() => { })

        revalidatePath('/admin/leaves')
        revalidatePath('/leaves')
    })
}

// ==========================================
// Manager Actions
// ==========================================

export async function getPendingLeaves() {
    return withErrorHandling(async () => {
        await requireUserRole(['manager', 'super_admin'])
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('leaves')
            .select(`*, user:users!user_id ( display_name, email )`)
            .in('status', ['pending', 'cancel_pending'])
            .order('created_at', { ascending: true })

        if (error) throw new Error(error.message)
        return data || []
    })
}

export async function reviewLeave(leaveId: number, status: 'approved' | 'rejected'): Promise<ActionResult<void>> {
    return withErrorHandling(async () => {
        const manager = await requireUserRole(['manager', 'super_admin'])
        const supabase = await createClient()

        const { error } = await supabase.from('leaves')
            .update({
                status,
                approver_id: manager.id,
                approved_at: new Date().toISOString(),
            })
            .eq('id', leaveId)

        if (error) throw new Error(error.message)

        // 取出這張假單的申請人與細節 (不論通過或拒絕都會需要)
        const { data: leaveData } = await supabase
            .from('leaves')
            .select('leave_type, days, user_id')
            .eq('id', leaveId)
            .single()

        if (status === 'approved') {
            if (leaveData && (leaveData.leave_type === 'annual_leave' || leaveData.leave_type === 'annual')) {
                const days = Number(leaveData.days) || 0
                const { data: u } = await supabase.from('users').select('annual_leave_used').eq('id', leaveData.user_id).single()
                const newUsed = (Number(u?.annual_leave_used) || 0) + days
                await supabase.from('users').update({ annual_leave_used: newUsed }).eq('id', leaveData.user_id)
            }
        }

        revalidatePath('/leaves')
        revalidatePath('/admin/leaves')

        // 【新增】發送審核結果通知給申請人
        if (leaveData) {
            const statusText = status === 'approved' ? '已核准' : '遭退回'
            try {
                await createNotification(
                    leaveData.user_id,
                    status === 'approved' ? 'leave_approved' : 'leave_rejected',
                    `請假申請${statusText}`,
                    `您的 ${leaveData.leave_type} (${leaveData.days} 天) 申請${statusText}`,
                    '/leaves'
                )
            } catch (err) {
                console.error('Failed to notify user about leave review:', err)
            }
        }
    })
}

export async function reviewLeaveGroup(groupId: string, status: 'approved' | 'rejected'): Promise<ActionResult<void>> {
    return withErrorHandling(async () => {
        const manager = await requireUserRole(['manager', 'super_admin'])
        const supabase = await createClient()

        // 取出該群組所有 pending 狀態的資料
        const { data: leavesGroup } = await supabase
            .from('leaves')
            .select('*')
            .eq('group_id', groupId)
            .eq('status', 'pending')

        if (!leavesGroup || leavesGroup.length === 0) {
            throw { code: ErrorCodes.NOT_FOUND, message: '找不到待審核的群組假單，或已審核完畢' }
        }

        // 批次更新為 approved 或 rejected
        const { error: updateError } = await supabase
            .from('leaves')
            .update({
                status,
                approver_id: manager.id,
                approved_at: new Date().toISOString(),
            })
            .eq('group_id', groupId)
            .eq('status', 'pending')

        if (updateError) throw new Error(updateError.message)

        // 統計 user_id, type 與總天數 (針對同一個 group_id，user 與 type 是相同的)
        const userId = leavesGroup[0].user_id
        const leaveType = leavesGroup[0].leave_type
        const totalDays = leavesGroup.reduce((sum, l) => sum + Number(l.days || 0), 0)

        // 若核准的為特休，批次扣除額度
        if (status === 'approved' && (leaveType === 'annual_leave' || leaveType === 'annual')) {
            const { data: u } = await supabase.from('users').select('annual_leave_used').eq('id', userId).single()
            const newUsed = (Number(u?.annual_leave_used) || 0) + totalDays
            await supabase.from('users').update({ annual_leave_used: newUsed }).eq('id', userId)
        }

        revalidatePath('/leaves')
        revalidatePath('/admin/leaves')

        // 發送通知 (合併發一則群組的)
        const statusText = status === 'approved' ? '已核准' : '遭退回'
        try {
            await createNotification(
                userId,
                status === 'approved' ? 'leave_approved' : 'leave_rejected',
                `請假申請${statusText}`,
                `您的 ${leaveType} (共 ${totalDays} 天) 申請${statusText}`,
                '/leaves'
            )
        } catch (err) {
            console.error('Failed to notify user about group leave review:', err)
        }
    })
}
