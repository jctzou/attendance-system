'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * 獲取我的通知列表
 */
export async function getMyNotifications() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

    if (error) return { error: error.message }
    return { data }
}

/**
 * 獲取未讀通知數量
 */
export async function getUnreadCount() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { count: 0 }

    const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)

    if (error) return { count: 0 }
    return { count: count || 0 }
}

/**
 * 標記通知為已讀
 */
export async function markAsRead(notificationId: number) {
    const supabase = await createClient()
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
    const supabase = await createClient()
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
 * 建立通知（內部使用）
 */
export async function createNotification(
    userId: string,
    type: string,
    title: string,
    message: string,
    link?: string
) {
    const supabase = await createClient()

    // @ts-ignore
    const { error } = await (supabase.from('notifications') as any).insert({
        user_id: userId,
        type,
        title,
        message,
        link,
        is_read: false
    })

    if (error) {
        console.error('Failed to create notification:', error)
        return { error: error.message }
    }

    return { success: true }
}
