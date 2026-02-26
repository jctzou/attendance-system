import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { calculateAnnualLeaveGrantDays, shouldGrantAnnualLeave } from '@/utils/annual-leave-engine'

export async function POST(request: Request) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        const { data: users, error } = await supabase.from('users').select('*')
        if (error) throw error

        let processed = 0
        let details = []
        const today = new Date()

        for (const user of users) {
            if (!user.onboard_date) continue;
            const onboardDate = new Date(user.onboard_date)

            const { data: logs } = await supabase.from('annual_leave_logs')
                .select('created_at')
                .eq('user_id', user.id)
                .eq('type', 'grant')
                .order('created_at', { ascending: false })
                .limit(1)

            const lastResetDate = logs && logs.length > 0 ? new Date(logs[0].created_at) : null

            if (shouldGrantAnnualLeave(onboardDate, lastResetDate, today)) {
                const grantDays = calculateAnnualLeaveGrantDays(onboardDate, today)
                if (grantDays > 0) {
                    await supabase.from('annual_leave_logs').insert({
                        user_id: user.id,
                        type: 'grant',
                        days: grantDays,
                        notes: `System granted ${grantDays} days for anniversary.`
                    })
                    processed++
                    details.push({ userId: user.id, granted: grantDays })
                }
            }
        }

        return NextResponse.json({ success: true, processed, details })
    } catch (error: any) {
        console.error('[Cron Job] Error:', error)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
