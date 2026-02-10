'use client'

import { useEffect, useState } from 'react'
import { getPendingLeaves } from '@/app/leaves/actions'
import AdminLeaveTable from '@/components/AdminLeaveTable'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function AdminLeavesPage() {
    const router = useRouter()
    const [leaves, setLeaves] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [userEmail, setUserEmail] = useState('')

    const fetchLeaves = async () => {
        setLoading(true)
        setError('')
        try {
            const res = await getPendingLeaves()
            if (res.error) {
                if (res.error.includes('Permission denied')) {
                    // Not a manager, redirect
                    router.push('/')
                    return
                }
                setError(res.error)
            } else {
                setLeaves(res.data || [])
            }
        } catch (e) {
            setError('載入失敗')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        // Get user email from somewhere, or just show loading
        fetchLeaves()
    }, [])

    // Expose refresh function to child component
    const handleRefresh = () => {
        fetchLeaves()
    }

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
                    <button
                        onClick={handleRefresh}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                        🔄 重新整理
                    </button>
                </div>

                {loading ? (
                    <div className="text-center py-10 text-gray-500">載入中...</div>
                ) : error ? (
                    <div className="bg-red-50 text-red-600 p-4 rounded">
                        錯誤: {error}
                    </div>
                ) : (
                    <AdminLeaveTable data={leaves} onSuccess={handleRefresh} />
                )}

                <div className="mt-8 p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
                    <p>ℹ️ 提示：批准或拒絕後，員工可在「請假管理」頁面看到更新後的狀態。</p>
                </div>
            </div>
        </div>
    )
}
