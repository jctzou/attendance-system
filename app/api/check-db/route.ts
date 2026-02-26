import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
    const supabase = await (createClient() as any);

    // 抓取最後 5 筆通知
    const { data: notifs } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)

    // 抓取最後 3 筆請假
    const { data: leaves } = await supabase
        .from('leaves')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3)

    return NextResponse.json({
        recentLeaves: leaves,
        recentNotifs: notifs
    })
}
