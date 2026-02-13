import { createClient } from '@/utils/supabase/server'
import { calculateAnnualLeaveDays } from '@/utils/leave-calculations'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        // Auth check: Check for Bearer token for Cron, or Session for manual trigger
        const authHeader = request.headers.get('authorization')
        const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`

        const supabase = await createClient()

        // If manual, check if admin
        if (!isCron) {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

            const { data: admin } = await supabase.from('users').select('role').eq('id', user.id).single()
            if (!admin || !['manager', 'super_admin'].includes(admin.role)) {
                return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
            }
        }

        // Fix: Use Taiwan Time (UTC+8) explicitly
        // Vercel/Server might be in UTC. 
        // We want to know "What day is it in Taiwan?"
        const now = new Date()
        const taiwanDateStr = now.toLocaleString("en-US", { timeZone: "Asia/Taipei" })
        const today = new Date(taiwanDateStr)

        const currentMonth = today.getMonth() + 1 // 1-12
        const currentDay = today.getDate() // 1-31
        const currentYear = today.getFullYear()

        const todayStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`

        console.log(`[Annual Leave Job] Server Time: ${now.toISOString()}`)
        console.log(`[Annual Leave Job] Taiwan Time: ${todayStr}`)

        // 1. Find all active employees
        const { data: empls, error } = await supabase
            .from('users')
            .select('id, onboard_date, annual_leave_total, last_reset_date, display_name')
            .not('onboard_date', 'is', null) // Only those with onboard_date set

        if (error) throw error

        const results = []

        for (const emp of empls) {
            const onboard = new Date(emp.onboard_date)
            // Check if today is the anniversary (Month and Day match)
            // Note: onboard_date is YYYY-MM-DD.
            // Be careful with timezones. We assume onboard_date matches today's month/day locally.
            // Or simpler: onboard_date's month/day matches today's month/day.

            const onboardMonth = onboard.getMonth() + 1
            const onboardDay = onboard.getDate()

            let isAnniversary = (onboardMonth === currentMonth && onboardDay === currentDay)
            let isHalfYear = false

            // Check for 6-month anniversary (only for <1yr service)
            // 6-month date = onboard + 6 months
            const sixMonthDate = new Date(emp.onboard_date)
            sixMonthDate.setMonth(sixMonthDate.getMonth() + 6)

            if (sixMonthDate.getMonth() + 1 === currentMonth && sixMonthDate.getDate() === currentDay) {
                // Determine if it is THE 6th month (year match)
                // Actually, labor law: 6 months service gets 3 days.
                // We check if (today - onboard) in months == 6.
                // Or simply check if we already granted it?
                isHalfYear = true
            }

            // Calculate Years of Service
            // Diff in years
            let yearsOfService = currentYear - onboard.getFullYear()
            // If today < birthday in current year, subtract 1?
            // Since we only run on anniversary, yearsOfService is exactly currentYear - onboardYear.

            // Logic:
            // 1. Anniversary (1 year, 2 year...)
            // 2. 6-month mark (0.5 year)

            let action = null
            let daysToGrant = 0

            // Skip if already ran today (check last_reset_date)
            if (emp.last_reset_date === todayStr) {
                results.push({ id: emp.id, name: emp.display_name, status: 'skipped_already_run' })
                continue
            }

            if (isAnniversary) {
                // Full Year Anniversary
                // Calculate entitlement for the NEW year starting today
                // Example: Onboard 2020-01-01. Today 2021-01-01. Service = 1 year.
                // Entitlement: 7 days.
                // Onboard 2020-01-01. Today 2020-07-01. Service = 0.5 year. Entitlement: 3 days.

                // Use existing util, pass 'currentYear' or 'currentYear + 1'?
                // calculateAnnualLeaveDays calculates based on "end of targetYear".
                // If today is anniversary, we should calculate what they get for this newly started year.
                // Actually, labor law is: "Worker who has worked for..."
                // 1 year service -> 7 days.
                // So on 1st anniversary, yearsOfService = 1. Grant 7.

                if (yearsOfService > 0) {
                    // Get days based on yearsOfService
                    daysToGrant = getDaysByTenure(yearsOfService)
                    action = 'grant_anniversary'
                }
            } else if (isHalfYear) {
                // 6 Month Mark
                // Check if yearsOfService == 0 (meaning < 1 year)
                // Actually logic: If (today - onboard) approx 6 months.
                // Difference in months
                const diffTime = Math.abs(today.getTime() - onboard.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                // 6 months approx 180 days.
                // Let's stick to date matching for simplicity.
                // If sixMonthDate matches today, and yearsOfService == 0 (0.5 yr) or ...?
                // Actually, 6-month leave is ONLY for the first year.

                if (currentYear === onboard.getFullYear() || (currentYear === onboard.getFullYear() + 1 && currentMonth < onboardMonth)) {
                    // It is the first 6 months
                    daysToGrant = 3
                    action = 'grant_half_year'
                }
            }

            if (action) {
                // RESET Logic:
                // Before granting new leave, should we clear old leave?
                // Spec says: "Settlement on day before new grant".
                // But cron runs on the day of grant. So we clear old, then add new.
                // Or simply: SET total = newDays. used = 0.

                // Update User
                await supabase.from('users').update({
                    annual_leave_total: daysToGrant,
                    annual_leave_used: 0,
                    last_reset_date: todayStr
                }).eq('id', emp.id)

                // Log it
                await supabase.from('annual_leave_logs').insert({
                    user_id: emp.id,
                    year: yearsOfService, // Or 0.5
                    action: 'grant',
                    days_change: daysToGrant,
                    description: `Automatic grant: ${action} (Tenure: ${yearsOfService.toFixed(1)} years)`
                })

                // Also log the "Reset" of previous balance if it was > 0?
                // Simplification for now.

                results.push({ id: emp.id, name: emp.display_name, action, days: daysToGrant })
            }
        }

        return NextResponse.json({ success: true, processed: results.length, details: results })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}

function getDaysByTenure(years: number): number {
    if (years < 1) return 0 // Should be handled by 6-month check logic
    if (years < 2) return 7
    if (years < 3) return 10
    if (years < 5) return 14
    if (years < 10) return 15
    // 10+ years: 15 + (years - 10), max 30
    const extra = years - 10
    return Math.min(15 + extra, 30)
}
