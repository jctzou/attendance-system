'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'
import { createNotification } from '@/app/notifications/actions'
import { z } from 'zod'
import { ActionResult, ErrorCodes } from '@/types/actions'
import { requireUserProfile, requireUserRole, withErrorHandling } from '@/utils/actions_common'

const ApplyLeaveSchema = z.object({
    leaveType: z.string().min(1, '請選擇假別'),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, '開始時間格式不正確'), // 假設前端傳 ISO 或 local string (這裡暫定 YYYY-MM-DDTHH:mm)
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, '結束時間格式不正確'),
    days: z.number().positive('請假天數必須大於 0').multipleOf(0.5, '請假天數必須為 0.5 的倍數'),
    reason: z.string().min(1, '請填寫請假事由'),
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
    reason: string
): Promise<ActionResult<void>> {
    return withErrorHandling(async () => {
        // 先不做嚴格時間正則校驗，因為可能帶秒，先將時間簡化為字串或用 Zod preprocess，此處放寬時間校驗以免前端傳送格式差異
        const InputSchema = z.object({
            leaveType: z.string().min(1, '請選擇假別'),
            startDate: z.string().min(10, '必須提供開始時間'),
            endDate: z.string().min(10, '必須提供結束時間'),
            days: z.number().positive('請假天數必須大於 0').multipleOf(0.5, '請假必須為 0.5 的倍數'),
            reason: z.string().min(1, '請填寫事由'),
        })

        const input = InputSchema.parse({ leaveType, startDate, endDate, days, reason })
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

        const { error: insertError } = await supabase.from('leaves').insert({
            user_id: profile.id,
            leave_type: input.leaveType,
            start_date: new Date(input.startDate).toISOString(),
            end_date: new Date(input.endDate).toISOString(),
            days: input.days,
            hours: input.days * 8, // legacy
            reason: input.reason,
            status: 'pending'
        })

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
            .select('*')
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
            .eq('status', 'pending')
            .order('created_at', { ascending: true })

        if (error) throw new Error(error.message)
        return data || []
    })
}

export async function reviewLeave(leaveId: number, status: 'approved' | 'rejected'): Promise<ActionResult<void>> {
    return withErrorHandling(async () => {
        await requireUserRole(['manager', 'super_admin'])
        const supabase = await createClient()

        const { error } = await supabase.from('leaves')
            .update({ status })
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


