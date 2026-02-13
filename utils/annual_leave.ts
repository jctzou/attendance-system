import { createClient } from '@/utils/supabase/server'

/**
 * 計算特休天數 (勞基法第38條)
 * @param onboardDate 到職日
 * @param targetDate 計算基準日 (通常是今日)
 * @returns { days: number, year: number, isGrantDate: boolean }
 */
export function calculateEntitlement(onboardDate: Date, targetDate: Date = new Date()) {
    // Clone dates to avoid mutation
    const onboard = new Date(onboardDate)
    const target = new Date(targetDate)

    // Normalize to midnight UTC to avoid timezone shifts affecting diff calculation if not careful
    // But since we care about "months/years passed", we can use local year/month diffs.
    // Let's stick to the "Is today the anniversary?" check.

    const onboardMonth = onboard.getMonth()
    const onboardDay = onboard.getDate()

    const targetMonth = target.getMonth()
    const targetDay = target.getDate()

    // Check if dates match (Month and Day)
    // Note: This simple equality check might fail for leap years (Feb 29). 
    // Labor standards usually say if Feb 29 is missing, grant on Feb 28 or Mar 1.
    // For simplicity, we strictly check month/day equality for now. 
    // If onboard is 2020-02-29, and today is 2021-02-28, it won't match. 
    // FIXME: Handle leaplings if strict compliance is required.

    let isGrantDate = false
    let yearsOfService = target.getFullYear() - onboard.getFullYear()

    // Adjust yearsOfService if we haven't reached the anniversary in current year yet
    if (targetMonth < onboardMonth || (targetMonth === onboardMonth && targetDay < onboardDay)) {
        yearsOfService -= 1
    }

    // Calculate exact months difference for the "6 months" rule
    const totalMonths = (target.getFullYear() - onboard.getFullYear()) * 12 + (targetMonth - onboardMonth) + (targetDay >= onboardDay ? 0 : -1)

    // Rule 1: 6 months check
    // If today is exactly 6 months after onboard
    // E.g. Onboard 1/1, Target 7/1. totalMonths = 6. 
    const sixMonthDate = new Date(onboard)
    sixMonthDate.setMonth(sixMonthDate.getMonth() + 6)

    if (
        sixMonthDate.getDate() === targetDay &&
        sixMonthDate.getMonth() === targetMonth &&
        sixMonthDate.getFullYear() === target.getFullYear()
    ) {
        return { days: 3, year: 0.5, isGrantDate: true }
    }

    // Rule 2: Anniversary check
    if (onboardMonth === targetMonth && onboardDay === targetDay) {
        // If yearsOfService >= 1, it's a grant date
        if (yearsOfService >= 1) {
            let entitlement = 0
            if (yearsOfService >= 1 && yearsOfService < 2) entitlement = 7
            else if (yearsOfService >= 2 && yearsOfService < 3) entitlement = 10
            else if (yearsOfService >= 3 && yearsOfService < 5) entitlement = 14
            else if (yearsOfService >= 5 && yearsOfService < 10) entitlement = 15
            else if (yearsOfService >= 10) {
                entitlement = 15 + (yearsOfService - 10)
                if (entitlement > 30) entitlement = 30
            }

            return { days: entitlement, year: yearsOfService, isGrantDate: true }
        }
    }

    return { days: 0, year: yearsOfService, isGrantDate: false }
}

/**
 * 檢查並發放特休
 * @param userId 指定使用者ID (Optional, 若無則檢查所有 Active User)
 */
export async function checkAndGrantLeave(userId?: string) {
    const supabase = await createClient()

    // 1. Get users
    let query = supabase.from('users').select('*').eq('is_active', true).not('onboard_date', 'is', null)
    if (userId) {
        query = query.eq('id', userId)
    }

    const { data: users, error } = await query

    if (error) {
        console.error('Fetch users error:', error)
        return { error: error.message }
    }

    const today = new Date()
    const results = []

    for (const user of users) {
        if (!user.onboard_date) continue

        const onboardDate = new Date(user.onboard_date)
        const { days, year, isGrantDate } = calculateEntitlement(onboardDate, today)

        if (isGrantDate) {
            // Check if already granted recently (prevent double grant on same day if script runs twice)
            // Or check `last_reset_date`
            const lastReset = user.last_reset_date ? new Date(user.last_reset_date) : null

            // If last_reset_date matches today, skip
            if (lastReset &&
                lastReset.getFullYear() === today.getFullYear() &&
                lastReset.getMonth() === today.getMonth() &&
                lastReset.getDate() === today.getDate()
            ) {
                results.push({ user: user.display_name, status: 'skipped (already granted)' })
                continue
            }

            // --- Grant Logic ---

            // 1. Settlement (Cash out or Reset old leave)
            // Policy: Reset remaining to 0 before granting new. 
            // Optional: Log cashout amount.
            const remaining = (Number(user.annual_leave_total) || 0) - (Number(user.annual_leave_used) || 0)
            if (remaining > 0) {
                await supabase.from('annual_leave_logs').insert({
                    user_id: user.id,
                    year: year, // Current Anniversary Year
                    action: 'reset',
                    days_change: -remaining,
                    description: `年度結算 (剩餘: ${remaining})`
                })
            }

            // 2. Update User Record
            // Reset used to 0, Set total to new entitlement
            const { error: updateError } = await supabase.from('users').update({
                annual_leave_total: days,
                annual_leave_used: 0,
                last_reset_date: today.toISOString().split('T')[0]
            }).eq('id', user.id)

            if (updateError) {
                console.error(`Failed to update user ${user.id}:`, updateError)
                results.push({ user: user.display_name, status: 'failed', error: updateError.message })
            } else {
                // 3. Log Grant
                await supabase.from('annual_leave_logs').insert({
                    user_id: user.id,
                    year: year,
                    action: 'grant',
                    days_change: days,
                    description: `年資滿 ${year} 年發放`
                })

                results.push({ user: user.display_name, status: 'granted', days, year })
            }
        }
    }

    return { results }
}
