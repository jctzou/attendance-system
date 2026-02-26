import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
    const supabase = await (createClient() as any);
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Auth needed' }, { status: 401 })

    // 測試 1: 能否抓到管理員的 ID
    const { data: admins, error: adminErr } = await supabase
        .from('users')
        .select('id, email, role')
        .in('role', ['manager', 'super_admin'])

    // 測試 2: 能否幫這些管理員塞入測試通知
    let insertErr = null;
    let insertedData = null;
    if (admins && admins.length > 0) {
        const { data, error } = await supabase.from('notifications').insert({
            user_id: admins[0].id,
            type: 'test_leave',
            title: 'RLS 測試',
            message: '如果你看到這則，代表 RLS 允許跨帳號新增',
            is_read: false
        }).select('*')
        insertErr = error;
        insertedData = data;
    }

    return NextResponse.json({
        tester: { email: user.email },
        adminsFound: admins,
        fetchAdminError: adminErr,
        insertedData: insertedData,
        insertError: insertErr
    })
}
