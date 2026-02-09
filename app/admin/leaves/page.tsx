import { createClient } from '@/utils/supabase/server'
import { getPendingLeaves } from '@/app/leaves/actions'
import AdminLeaveTable from '@/components/AdminLeaveTable'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function AdminLeavesPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/')
    }

    // 檢查管理員權限
    const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single() as any

    if (!userData || !['manager', 'super_admin'].includes(userData.role)) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen">
                <h1 className="text-2xl font-bold text-red-600 mb-4">權限不足</h1>
                <p className="text-gray-600 mb-6">此頁面僅限管理員存取。</p>
                <Link href="/" className="text-blue-600 hover:underline">回首頁</Link>
            </div>
        )
    }

    const { data: pendingLeaves, error } = await getPendingLeaves()

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white border-b shadow-sm h-16 flex items-center justify-between px-6">
                <div className="font-bold text-lg text-blue-600">👮‍♂️ 請假審核中心</div>
                <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
                    ← 回首頁
                </Link>
            </nav>

            <div className="max-w-6xl mx-auto py-10 px-4">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">待審核申請</h1>
                    <span className="text-sm text-gray-500">管理員: {user.email}</span>
                </div>

                {error ? (
                    <div className="bg-red-50 text-red-600 p-4 rounded">
                        錯誤: {error}
                    </div>
                ) : (
                    <AdminLeaveTable data={pendingLeaves || []} />
                )}

                <div className="mt-8 p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
                    <p>ℹ️ 提示：批准或拒絕後，員工可在「請假管理」頁面看到更新後的狀態。</p>
                </div>
            </div>
        </div>
    )
}
