import { SupabaseClient } from '@supabase/supabase-js'

export interface LeaveRequestDay {
    date: string // YYYY-MM-DD
    days: number // 0.5 or 1.0
}

/**
 * 檢查送出的「單日細項陣列」是否與資料庫既有請假紀錄衝突。
 * 規則：同一名員工在同一天 (date) 最多只能請 1.0 天的假。
 * 即使是不同假別，只要相加超過 1 就不允許。
 * 狀態為 "rejected" 或 "cancelled" 被視為無效請假，不列入計算（目前系統可能只有 pending/approved，皆列入計算）。
 */
export async function checkLeaveConflicts(
    supabase: SupabaseClient,
    userId: string,
    requestedDays: LeaveRequestDay[]
): Promise<{ success: boolean; error?: string }> {

    // 如果傳進來是空的，直接過關
    if (!requestedDays || requestedDays.length === 0) {
        return { success: true }
    }

    // 1. 抓取這批申請中，每一天已經存在的請假天數 (排除被拒絕的)
    const datesToCheck = requestedDays.map(d => d.date)

    const { data: existingLeaves, error } = await supabase
        .from('leaves')
        .select('start_date, days')
        .eq('user_id', userId)
        .in('start_date', datesToCheck)
        .in('status', ['pending', 'approved']) // 只計算有效假單

    if (error) {
        return { success: false, error: '檢查重複請假時發生資料庫錯誤' }
    }

    // 2. 彙整每一天「已請的總天數」
    // 雖然舊系統是 start_date -> end_date 區間，但在這個新模組轉換期中，
    // 新的邏輯保證每一天就是獨立的一筆 row，且其 start_date 會等於 end_date。
    // 如果剛好有舊資料是跨日的（start_date 與端點不同），這裡的防呆可能針對跨日中的 "中間天數" 失效。
    // （如果需做到絕對安全，可以對舊資料做一次正規化 data cleanup）。我們目前先以新架構（單日為主）防呆。
    const existingDaysMap: Record<string, number> = {}
    if (existingLeaves) {
        for (const l of existingLeaves) {
            // 在新架構下，start_date 本質上就是「出勤日」
            // 日期從 DB 取出可能帶有時間或時區，保證轉為 YYYY-MM-DD 做比對
            const dateOnly = new Date(l.start_date).toISOString().split('T')[0]
            existingDaysMap[dateOnly] = (existingDaysMap[dateOnly] || 0) + Number(l.days)
        }
    }

    // 3. 逐日檢查：目前申請的 + 過去已經請的，是否超過 1 天？
    for (const req of requestedDays) {
        const existing = existingDaysMap[req.date] || 0
        const total = existing + req.days

        if (total > 1.0) {
            // 找出是哪一天爆炸
            const formattedDate = new Date(req.date).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' })
            return {
                success: false,
                error: `${formattedDate} 申請天數衝突。該日已請 ${existing} 天，本次申請 ${req.days} 天，合計超過單日上限！`
            }
        }
    }

    return { success: true }
}
