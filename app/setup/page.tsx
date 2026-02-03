'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useState } from 'react'

export default function SetupPage() {
    const [logs, setLogs] = useState<string[]>([])
    const [loading, setLoading] = useState(false)

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const testUsers = [
        {
            email: 'admin@example.com',
            password: 'password123',
            role: 'super_admin',
            name: '王大明',
            employee_id: 'E001'
        },
        {
            email: 'manager@example.com',
            password: 'password123',
            role: 'manager',
            name: '李小華',
            employee_id: 'E002'
        },
        {
            email: 'employee@example.com',
            password: 'password123',
            role: 'employee',
            name: '張小美',
            employee_id: 'E003'
        },
        {
            email: 'employee2@example.com',
            password: 'password123',
            role: 'employee',
            name: '陳小強',
            employee_id: 'E004'
        },
        {
            email: 'employee3@example.com',
            password: 'password123',
            role: 'employee',
            name: '林小玲',
            employee_id: 'E005'
        }
    ]

    const addLog = (msg: string) => setLogs(prev => [...prev, msg])

    const startSetup = async () => {
        setLoading(true)
        setLogs(['開始初始化...'])

        for (const user of testUsers) {
            addLog(`正在建立: ${user.name} (${user.email})...`)

            const { data, error } = await supabase.auth.signUp({
                email: user.email,
                password: user.password,
                options: {
                    data: {
                        display_name: user.name,
                        employee_id: user.employee_id,
                        role: user.role
                    }
                }
            })

            if (error) {
                addLog(`❌ 失敗: ${error.message}`)
            } else {
                if (data.user?.identities?.length === 0) {
                    addLog(`⚠️ 警告: 使用者可能已存在 (Identity empty)`)
                } else {
                    addLog(`✅ 成功! ID: ${data.user?.id}`)
                }
            }
        }

        addLog('初始化完成！請檢查 Supabase Users 表。')
        setLoading(false)
    }

    return (
        <div className="p-10 max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">系統初始化工具</h1>

            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded mb-6 text-sm text-yellow-800">
                ⚠️ 執行前，請確認已在 Supabase 執行了新的 schema.sql (UUID版) 並啟用了 Trigger。
            </div>

            <button
                onClick={startSetup}
                disabled={loading}
                className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 disabled:opacity-50 font-bold"
            >
                {loading ? '處理中...' : '開始建立測試帳號'}
            </button>

            <div className="mt-8 bg-black text-green-400 p-4 rounded font-mono text-xs min-h-[300px] overflow-auto">
                {logs.map((log, i) => (
                    <div key={i}>{log}</div>
                ))}
            </div>
        </div>
    )
}
