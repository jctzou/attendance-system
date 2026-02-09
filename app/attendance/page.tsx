import { createClient } from '@/utils/supabase/server'
import AttendanceTable from '@/components/AttendanceTable'
import { getAttendanceHistory } from '@/app/attendance/actions'
import Link from 'next/link'

export default async function AttendancePage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return <div className="p-10 text-center">請先登入</div>
    }

    // 預設取得當月 (或最近30天)
    const today = new Date()
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)

    const startDate = firstDay.toISOString().split('T')[0]
    const endDate = lastDay.toISOString().split('T')[0]

    const { data, error } = await getAttendanceHistory(startDate, endDate)

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white border-b shadow-sm h-16 flex items-center justify-between px-6">
                <div className="font-bold text-lg text-blue-600">📋 打卡記錄</div>
                <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
                    ← 回首頁
                </Link>
            </nav>

            <div className="max-w-5xl mx-auto py-10 px-4">
                <div className="flex justify-between items-end mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">本月出勤 ({today.getMonth() + 1}月)</h1>
                    <span className="text-sm text-gray-500">使用者: {user.email}</span>
                </div>

                {error ? (
                    <div className="bg-red-50 text-red-600 p-4 rounded">
                        錯誤: {error}
                    </div>
                ) : (
                    <AttendanceTable data={data || []} />
                )}
            </div>
        </div>
    )
}
