import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

/**
 * 臨時 API 路由：執行 migration 新增 settled_data 欄位
 * 執行後可以刪除此檔案
 */
export async function GET() {
    try {
        const supabase = await createClient() as any

        // 執行 SQL 新增 settled_data 欄位
        const { error } = await supabase.rpc('exec_sql', {
            sql_query: `
                ALTER TABLE salary_records 
                ADD COLUMN IF NOT EXISTS settled_data JSONB;
                
                COMMENT ON COLUMN salary_records.settled_data IS '結算時的薪資數據快照';
            `
        })

        if (error) {
            // 如果 rpc 不存在，嘗試直接使用原生 SQL
            console.error('RPC error:', error)
            return NextResponse.json({
                success: false,
                error: error.message,
                note: '請手動在 Supabase Studio 執行 migration，或使用 psql 連接資料庫執行 SQL'
            })
        }

        return NextResponse.json({
            success: true,
            message: 'settled_data 欄位已成功新增到 salary_records 表'
        })
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message
        })
    }
}
