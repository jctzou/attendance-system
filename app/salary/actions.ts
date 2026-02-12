'use server'

import { createClient } from '@/utils/supabase/server'

/**
 * 獲取當前登入用戶的已發放薪資記錄
 */
export async function getMySalaryRecords() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    const { data, error } = await supabase
        .from('salary_records')
        .select(`
            *,
            user:users (
                display_name,
                email,
                salary_type
            )
        `)
        .eq('user_id', user.id)
        .eq('is_paid', true) // 只顯示已發放
        .order('year_month', { ascending: false })

    if (error) {
        console.error('Error fetching my salary records:', error)
        return { error: error.message }
    }

    return { data }
}
