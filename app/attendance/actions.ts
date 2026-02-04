// @ts-nocheck
'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

/**
 * 上班打卡 (Clock In)
 */
export async function clockIn(userId: string) {
    const supabase = await createClient()
    const now = new Date()

    // 1. 檢查是否已打卡 (避免重複)
    // 注意：這裡使用本地時間字串作為 work_date (YYYY-MM-DD)
    // 在真實專案中，建議統一使用 UTC 或依賴資料庫生成
    // 這裡簡單取現在日期的前面部分
    const workDate = now.toISOString().split('T')[0]

    const { data: existing } = await supabase
        .from('attendance')
        .select('id')
        .eq('user_id', userId)
        .eq('work_date', workDate)
        .single()

    if (existing) {
        return { error: '今日已打卡，請勿重複操作。' }
    }

    // 2. 獲取使用者設定的上班時間
    const { data: rawSettings } = await supabase
        .from('users')
        .select('work_start_time')
        .eq('id', userId)
        .single()

    const userSettings = rawSettings as any
    const targetTimeStr = userSettings?.work_start_time || '09:00:00'

    // 3. 判斷狀態 (遲到判定)
    // 使用台北時間進行判斷
    const taipeiNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }))
    const dateStr = taipeiNow.getFullYear() + '-' +
        String(taipeiNow.getMonth() + 1).padStart(2, '0') + '-' +
        String(taipeiNow.getDate()).padStart(2, '0')

    const targetDate = new Date(`${dateStr}T${targetTimeStr}`)
    // 如果 targetDate 是無效的，預設一個
    if (isNaN(targetDate.getTime())) {
        targetDate.setHours(9, 0, 0, 0)
    }

    let status = 'normal'
    if (taipeiNow > targetDate) {
        status = 'late'
    }

    // 4. 寫入資料庫
    const { error } = await supabase.from('attendance').insert({
        user_id: userId,
        work_date: workDate,
        clock_in_time: now.toISOString(),
        status: status
    } as any)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/')
    return { success: true, status }
}

/**
 * 下班打卡 (Clock Out)
 */
export async function clockOut(userId: string) {
    const supabase = await createClient()
    const now = new Date()
    const workDate = now.toISOString().split('T')[0]

    // 1. 檢查是否有上班卡
    const { data: rawRecord } = await supabase
        .from('attendance')
        .select('id, clock_in_time')
        .eq('user_id', userId)
        .eq('work_date', workDate)
        .single()

    const record = rawRecord as any

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

    // 3. 判斷狀態 (早退判定)
    const taipeiNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }))
    const dateStr = taipeiNow.getFullYear() + '-' +
        String(taipeiNow.getMonth() + 1).padStart(2, '0') + '-' +
        String(taipeiNow.getDate()).padStart(2, '0')

    const targetDate = new Date(`${dateStr}T${targetTimeStr}`)
    if (isNaN(targetDate.getTime())) {
        targetDate.setHours(18, 0, 0, 0)
    }

    // 計算工時 (小時)
    const clockInTime = new Date(record.clock_in_time)
    const diffMs = now.getTime() - clockInTime.getTime()
    const workHours = (diffMs / (1000 * 60 * 60)).toFixed(2)

    // 準備更新資料
    const updateData: any = {
        clock_out_time: now.toISOString(),
        work_hours: workHours,
    }

    // 狀態判斷邏輯：
    // 獲取原本打卡時的狀態
    const { data: originalRecord } = await supabase
        .from('attendance')
        .select('status')
        .eq('id', record.id)
        .single()

    const originalStatus = (originalRecord as any)?.status || 'normal'
    const isEarlyLeave = taipeiNow < targetDate

    let finalStatus = originalStatus

    if (isEarlyLeave) {
        if (originalStatus === 'late') {
            finalStatus = 'late early_leave'
        } else if (originalStatus === 'normal') {
            finalStatus = 'early_leave'
        }
    } else {
        // 如果沒有早退，保持原狀 (可能是 late 或 normal)
        finalStatus = originalStatus
    }

    updateData.status = finalStatus

    const { error } = await supabase
        .from('attendance')
        .update(updateData as any)
        .eq('id', record.id)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/')
    return { success: true }
}
