import { createClient } from '@supabase/supabase-js'

// 這個 Client 給有需要繞過 RLS (Row Level Security) 限制的 Server Action 背景作業使用
// 例如：通知中心寄發系統通知給管理員，或是 cron job 批次更新。
export const createAdminClient = () => {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in environment variables. This is required for secure Server Actions (e.g. Auth Management). Please add it to your .env.local file.')
    }

    return createClient<any>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    )
}
