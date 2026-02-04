'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * 將 HH:mm:ss 轉為秒數，方便精確比較
 */
function timeToSeconds(timeStr: string) {
    if (!timeStr) return 0
    const parts = timeStr.split(':').map(Number)
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0)
}

/**
 * 上班打卡 (Clock In)
 */
export async function clockIn(userId: string) {
    const supabase = await createClient()
    const now = new Date()

    // 1. 取得台北時間的日期與時間 (HH:mm:ss)
    const taipeiDate = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }) // YYYY-MM-DD
    const taipeiTime = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Taipei', hour12: false }) // HH:mm:ss
    const workDate = taipeiDate

    // 2. 檢查是否已打卡 (避免重複)
    const { data: existing } = await supabase
        .from('attendance')
        .select('id')
        .eq('user_id', userId)
        .eq('work_date', workDate)
        .single()

    if (existing) {
        return { error: '今日已打卡，請勿重複操作。' }
    }

    // 3. 獲取使用者設定的上班時間
    const { data: rawSettings } = await supabase
        .from('users')
        .select('work_start_time')
        .eq('id', userId)
        .single()

    const userSettings = rawSettings as any
    const targetTimeStr = userSettings?.work_start_time || '09:00:00'

    // 4. 判斷狀態 (遲到判定)
    const nowSeconds = timeToSeconds(taipeiTime)
    const targetSeconds = timeToSeconds(targetTimeStr)
    const isLate = nowSeconds > targetSeconds

    // 5. 寫入資料庫
    const { error } = await supabase.from('attendance').insert({
        user_id: userId,
        work_date: workDate,
        clock_in_time: now.toISOString(),
        status: isLate ? 'late' : 'normal',
        is_late: isLate
    } as any)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/')
    return { success: true }
}

/**
 * 下班打卡 (Clock Out)
 */
export async function clockOut(userId: string) {
    const supabase = await createClient()
    const now = new Date()

    // 取得台北時間日期
    const taipeiDate = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }) // YYYY-MM-DD
    const taipeiTime = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Taipei', hour12: false }) // HH:mm:ss
    const workDate = taipeiDate

    // 1. 檢查是否有上班卡
    const { data: record } = await supabase
        .from('attendance')
        .select('id, clock_in_time')
        .eq('user_id', userId)
        .eq('work_date', workDate)
        .single()

    if (!record) {
        return { error: '尚未上班打卡，無法下班。' }
    }

    // 2. 獲取使用者設定的下班時間
    const { data: rawSettings } = await supabase
        .from('users')
        .select('work_end_time')
        .eq('id', userId)
        .single()

    const userSettings = rawSettings as any
    const targetTimeStr = userSettings?.work_end_time || '18:00:00'

    // 3. 判斷是否早退
    const nowSeconds = timeToSeconds(taipeiTime)
    const targetSeconds = timeToSeconds(targetTimeStr)
    const isEarlyLeave = nowSeconds < targetSeconds

    // 計算工時 (小時)
    const clockInTime = new Date((record as any).clock_in_time)
    const diffMs = now.getTime() - clockInTime.getTime()
    const workHours = (diffMs / (1000 * 60 * 60)).toFixed(2)

    // 4. 更新資料庫
    const { error } = await supabase
        .from('attendance')
        .update({
            clock_out_time: now.toISOString(),
            work_hours: workHours,
            is_early_leave: isEarlyLeave
        } as any)
        .eq('id', (record as any).id)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/')
    return { success: true }
}
