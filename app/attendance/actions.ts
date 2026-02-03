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
    const { data: userSettings } = await supabase
        .from('users')
        .select('work_start_time')
        .eq('id', userId)
        .single()

    const targetTimeStr = userSettings?.work_start_time || '09:00:00'

    // 3. 判斷狀態 (遲到判定)
    // 將 "09:00:00" 轉換為當天的 Date 物件進行比較
    const [targetHour, targetMinute] = targetTimeStr.split(':').map(Number)
    const targetDate = new Date(now)
    targetDate.setHours(targetHour, targetMinute, 0, 0)

    let status = 'normal'
    // 給予 1 分鐘緩衝? 這裡嚴格執行: 超過即遲到
    if (now > targetDate) {
        status = 'late'
    }

    // 4. 寫入資料庫
    const { error } = await supabase.from('attendance').insert({
        user_id: userId,
        work_date: workDate,
        clock_in_time: now.toISOString(),
        status: status
    })

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
    const { data: userSettings } = await supabase
        .from('users')
        .select('work_end_time')
        .eq('id', userId)
        .single()

    const targetTimeStr = userSettings?.work_end_time || '18:00:00'

    // 3. 判斷狀態 (早退判定)
    const [targetHour, targetMinute] = targetTimeStr.split(':').map(Number)
    const targetDate = new Date(now)
    targetDate.setHours(targetHour, targetMinute, 0, 0)

    let status = 'normal' // 這裡通常需要結合上班狀態，例如如果上班已經遲到，下班早退怎麼算？
    // 簡化邏輯：如果現在是早退，就標記早退。如果已經是遲到，可能需要保留遲到狀態或複合狀態。
    // 但資料庫 status 欄位只有一個。
    // 策略：如果原本是 normal，且現在早退 -> early_leave。
    // 如果原本是 late，且現在早退 -> late (遲到比較嚴重?) 或 early_leave?
    // 這裡我們先簡單處理：只要早退就標記早退 (覆蓋遲到狀態)，或者保留遲到？
    // 為了單純，我們先只判斷早退。若有早退，覆蓋狀態。

    if (now < targetDate) {
        status = 'early_leave'
    } else {
        // 如果沒有早退，且原本並非 normal (例如 late)，則保持原狀?
        // 需先查詢原本狀態?
        // 為了 Server Action 簡單，我們先不讀取原本 status，除非我們要實作複雜邏輯。
        // 但 Update 會覆蓋。
        // 修正：我們應該只更新 status 若它是 early_leave。若正常下班，則保持原本的 status (可能是 late 或 normal)。
        // 所以這裡 status 預設為 null (不更新)，只有早退才更新。
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

    if (now < targetDate) {
        updateData.status = 'early_leave' // 覆蓋為早退
    }

    const { error } = await supabase
        .from('attendance')
        .update(updateData)
        .eq('id', record.id)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/')
    return { success: true }
}
