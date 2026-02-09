'use client'

import { useEffect, useState } from 'react'
import { getMyLeaves } from './actions'
import LeaveTable from '@/components/LeaveTable'
import ApplyLeaveDialog from '@/components/ApplyLeaveDialog'
import Link from 'next/link'

export default function LeavesPage() {
    const [leaves, setLeaves] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showApplyDialog, setShowApplyDialog] = useState(false)

    const fetchLeaves = async () => {
        setLoading(true)
        const res = await getMyLeaves()
        if (res.data) {
            setLeaves(res.data)
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchLeaves()
    }, [])

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white border-b shadow-sm h-16 flex items-center justify-between px-6">
                <div className="font-bold text-lg text-blue-600">🏖️ 請假管理</div>
                <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
                    ← 回首頁
                </Link>
            </nav>

            <div className="max-w-5xl mx-auto py-10 px-4">
                <div className="flex justify-between items-end mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">我的請假記錄</h1>
                    <button
                        onClick={() => setShowApplyDialog(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700 btn-pointer"
                    >
                        + 申請請假
                    </button>
                </div>

                {loading ? (
                    <div className="text-center py-10 text-gray-500">載入中...</div>
                ) : (
                    <LeaveTable data={leaves} />
                )}
            </div>

            {showApplyDialog && (
                <ApplyLeaveDialog
                    onClose={() => setShowApplyDialog(false)}
                    onSuccess={() => {
                        fetchLeaves()
                    }}
                />
            )}
        </div>
    )
}
