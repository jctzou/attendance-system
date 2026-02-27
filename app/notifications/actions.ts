'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { sendServerBroadcast } from '@/utils/supabase/broadcast'
import { revalidatePath, unstable_noStore as noStore } from 'next/cache'

/**
 * 獲取我的通知列表
 */
export async function getMyNotifications() {
    noStore(); // 禁用快取，確保每次都去 DB 抓最新資料
    const supabase = await createClient() as any
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_cleared', false)
        .order('created_at', { ascending: false })
        .limit(20)

    if (error) return { error: error.message }
    return { data }
}

/**
 * 獲取未讀通知數量
 */
export async function getUnreadCount() {
    noStore(); // 禁用快取
    const supabase = await createClient() as any
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { count: 0 }

    const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_cleared', false)
        .eq('is_read', false)

    if (error) return { count: 0 }
    return { count: count || 0 }
}

/**
 * 標記通知為已讀
 */
export async function markAsRead(notificationId: number) {
    const supabase = await createClient() as any
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', user.id)

    if (error) return { error: error.message }

    revalidatePath('/')
    return { success: true }
}

/**
 * 全部標記為已讀
 */
export async function markAllAsRead() {
    const supabase = await createClient() as any
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)

    if (error) return { error: error.message }

    revalidatePath('/')
    return { success: true }
}

/**
 * 清除所有通知 (刪除)
 */
export async function deleteAllNotifications() {
    const supabase = await createClient() as any
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    // 使用單次高效更新，並過濾掉已經是 true 的資料避免無效寫入
    // .neq('is_cleared', true) 同時涵蓋了 false 以及舊資料可能的 null
    const { error } = await supabase
        .from('notifications')
        .update({ is_cleared: true })
        .eq('user_id', user.id)
        .neq('is_cleared', true)

    if (error) return { error: error.message }

    revalidatePath('/', 'layout')
    return { success: true }
}

/**
 * 建立通知（內部使用）
 */
export async function createNotification(
    userId: string,
    type: string,
    title: string,
    message: string,
    link?: string
) {
    try {
        const supabaseAdmin = createAdminClient()

        // @ts-ignore
        const { error, data } = await (supabaseAdmin.from('notifications') as any).insert({
            user_id: userId,
            type,
            title,
            message,
            link,
            is_read: false
        }).select('*')

        if (error) {
            console.error('[createNotification] Failed:', error)
            return { error: error.message }
        }

        // 穩定的伺服器端廣播
        await sendServerBroadcast('public:notification_sync', 'new_notification', { targetUserId: userId })

        return { success: true }
    } catch (err: any) {
        console.error('[createNotification] Unexpected Exception:', err);
        return { error: err.message }
    }
}
