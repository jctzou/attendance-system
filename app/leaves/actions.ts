'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'
import { createNotification } from '@/app/notifications/actions'
import { sendServerBroadcast } from '@/utils/supabase/broadcast'
import { z } from 'zod'
import { ActionResult, ErrorCodes } from '@/types/actions'
import { requireUserProfile, requireUserRole, withErrorHandling } from '@/utils/actions_common'
import { checkLeaveConflicts, LeaveRequestDay } from '@/utils/leaves_helper'
import { v4 as uuidv4 } from 'uuid'

// ---- 廣播 Helper（只發 Broadcast 訊號，不插入通知記錄）----
// 通知記錄由 DB Trigger (handle_leave_notifications) 統一負責插入（含去重邏輯）

/** 廣播給所有主管，讓其鈴噹即時更新 */
async function broadcastToManagers() {
    try {
        const supabaseAdmin = createAdminClient()
        const { data: managers } = await supabaseAdmin
            .from('users')
            .select('id')
            .in('role', ['manager', 'super_admin'])
        if (managers) {
            for (const m of managers as { id: string }[]) {
                await sendServerBroadcast('public:notification_sync', 'new_notification', { targetUserId: m.id })
            }
        }
    } catch (err) {
        console.error('[broadcastToManagers] Failed:', err)
    }
}

/** 廣播給指定員工，讓其鈴噹即時更新 */
async function broadcastToUser(userId: string) {
    try {
        await sendServerBroadcast('public:notification_sync', 'new_notification', { targetUserId: userId })
    } catch (err) {
        console.error('[broadcastToUser] Failed:', err)
    }
}

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

        // 通知記錄由 DB Trigger 插入（去重），此處只發 Broadcast 讓主管鈴噹即時跳動
        await broadcastToManagers()
        revalidatePath('/leaves')
    })
}

// 假單列表資料結構（含關聯查詢欄位），供前端 Client Component import 使用
export interface LeaveRow {
    id: number
    group_id: string | null
    leave_type: string
    start_date: string
    end_date: string
    days: number
    reason: string | null
    status: string
    created_at: string
    approver_id: string | null
    approved_at: string | null
    cancel_reason: string | null
    approver: { display_name: string; email: string } | null
}

export async function getMyLeaves(): Promise<ActionResult<LeaveRow[]>> {
    return withErrorHandling(async () => {
        const profile = await requireUserProfile()
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('leaves')
            .select('*, approver:users!approver_id(display_name, email)')
            .eq('user_id', profile.id)
            .order('created_at', { ascending: false })
            .returns<LeaveRow[]>()   // §11.2 策略 A：明確宣告回傳型別，避免 any

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
        // 廣播給主管，讓其鈴噹即時更新（通知記錄由 DB Trigger 插入，已去重）
        await broadcastToManagers()
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
        // 廣播給員工，讓其鈴噹即時更新（通知記錄由 DB Trigger 插入，已去重）
        if (leaveData) await broadcastToUser(leaveData.user_id)
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
        // 廣播給員工，讓其鈴噹即時更新（通知記錄由 DB Trigger 插入，已去重）
        await broadcastToUser(userId)
    })
}

/**
 * 員工申請整批取消同一 group_id 的已批准假單
 * 該 group 中所有 approved 記錄狀態改為 cancel_pending
 */
export async function requestCancelLeaveGroup(groupId: string, cancelReason: string): Promise<ActionResult<void>> {
    return withErrorHandling(async () => {
        if (!cancelReason.trim()) throw { code: ErrorCodes.VALIDATION_FAILED, message: '請填寫取消原因' }

        const profile = await requireUserProfile()
        const supabase = await createClient()

        const { data: leaves } = await supabase
            .from('leaves')
            .select('id, status, user_id')
            .eq('group_id', groupId)

        if (!leaves || leaves.length === 0) throw { code: ErrorCodes.NOT_FOUND, message: '找不到請假紀錄' }

        for (const leave of leaves) {
            if (leave.user_id !== profile.id) throw { code: ErrorCodes.FORBIDDEN, message: '權限不足' }
            if (leave.status !== 'approved') throw { code: ErrorCodes.BUSINESS_CONFLICT, message: '只能對已全數批准的假單群組提出取消申請' }
        }

        const { error } = await supabase
            .from('leaves')
            .update({ status: 'cancel_pending', cancel_reason: cancelReason })
            .eq('group_id', groupId)

        if (error) throw new Error(error.message)

        revalidatePath('/leaves')
        revalidatePath('/admin/leaves')
        // 通知記錄由 DB Trigger 插入（去重），此處只廣播讓主管鈴噹即時跳動
        await broadcastToManagers()
    })
}

/**
 * 主管批次審核整個 group_id 的取消申請
 * approve=true：同意取消 → 整批刪除
 * approve=false：拒絕取消 → 整批恢復 approved
 */
export async function approveCancelLeaveGroup(groupId: string, approve: boolean): Promise<ActionResult<void>> {
    return withErrorHandling(async () => {
        await requireUserRole(['manager', 'super_admin'])
        const supabase = await createAdminClient()

        const { data: leaves } = await supabase
            .from('leaves')
            .select('id, status, user_id')
            .eq('group_id', groupId)
            .eq('status', 'cancel_pending')

        if (!leaves || leaves.length === 0) throw { code: ErrorCodes.NOT_FOUND, message: '找不到待審取消的群組假單' }

        const userId = leaves[0].user_id

        if (approve) {
            const { error } = await supabase.from('leaves').delete()
                .eq('group_id', groupId).eq('status', 'cancel_pending')
            if (error) throw new Error(error.message)
        } else {
            const { error } = await supabase.from('leaves')
                .update({ status: 'approved', cancel_reason: null })
                .eq('group_id', groupId).eq('status', 'cancel_pending')
            if (error) throw new Error(error.message)
        }

        await createNotification(
            userId,
            'leave_cancel_result',
            approve ? '請假取消已核准' : '請假取消已拒絕',
            approve ? '主管已核准您的請假取消申請（整批）' : '主管拒絕了您的請假取消申請，假單維持不變'
        ).catch(() => { })

        revalidatePath('/admin/leaves')
        revalidatePath('/leaves')
        await broadcastToUser(userId)
    })
}
