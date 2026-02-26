'use client'

import { useEffect, useState } from 'react'
import { getPendingLeaves } from '@/app/leaves/actions'
import AdminLeaveTable from '@/components/AdminLeaveTable'
import { useRouter } from 'next/navigation'

const LEAVE_TYPE_MAP: Record<string, string> = {
    sick_leave: '病假',
    personal_leave: '事假',
    annual_leave: '特休',
    other: '其他',
}

export default function AdminLeavesPage() {
    const router = useRouter()
    const [leaves, setLeaves] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const fetchLeaves = async () => {
        setLoading(true)
        setError('')
        try {
            const res = await getPendingLeaves()
            if (!res.success) {
                if (res.error.message.includes('Permission denied')) {
                    router.push('/')
                    return
                }
                setError(res.error.message)
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
        fetchLeaves()
    }, [])

    const handleRefresh = () => {
        fetchLeaves()
    }

    return (
        <div className="max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-slate-800 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">verified</span>
                請假審核中心
            </h1>

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                    待審核請假申請
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={async () => {
                            if (!confirm('確定要執行「年度特休計算」嗎？\n這將檢查所有員工的到職日，並為今日滿週年者發放特休。')) return;
                            try {
                                const res = await fetch('/api/cron/annual-leave', { method: 'POST' });
                                const data = await res.json();
                                if (data.success) {
                                    alert(`執行成功！\n處理人數: ${data.processed}\n詳細資訊: ${JSON.stringify(data.details, null, 2)}`);
                                } else {
                                    alert(`執行失敗: ${data.error}`);
                                }
                            } catch (e) {
                                alert('執行失敗');
                            }
                        }}
                        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 px-3 py-1 border border-indigo-200 rounded hover:bg-indigo-50"
                    >
                        <span className="material-symbols-outlined text-sm">schedule</span>
                        執行特休計算
                    </button>
                    <button
                        onClick={handleRefresh}
                        className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1"
                    >
                        <span className="material-symbols-outlined text-sm">refresh</span>
                        重新整理
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-10 text-slate-500">載入中...</div>
            ) : error ? (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg border border-red-200 dark:border-red-800">
                    錯誤: {error}
                </div>
            ) : (
                <AdminLeaveTable data={leaves} onSuccess={handleRefresh} />
            )}

            <div className="mt-8 p-4 bg-primary/5 dark:bg-primary/10 rounded-lg text-sm text-slate-700 dark:text-neutral-300 border border-primary/20">
                <p className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-primary text-base">info</span>
                    <span>批准或拒絕後,員工可在「請假管理」頁面看到更新後的狀態。</span>
                </p>
            </div>
        </div>
    )
}
