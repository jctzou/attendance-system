'use client'

import { useEffect, useState } from 'react'
import { getPendingLeaves, getPendingCancellations, reviewLeaveCancellation } from '@/app/leaves/actions'
import AdminLeaveTable from '@/components/AdminLeaveTable'
import { useRouter } from 'next/navigation'

type TabType = 'leaves' | 'cancellations'

const LEAVE_TYPE_MAP: Record<string, string> = {
    sick_leave: '病假',
    personal_leave: '事假',
    annual_leave: '特休',
    other: '其他',
}

export default function AdminLeavesPage() {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState<TabType>('leaves')
    const [leaves, setLeaves] = useState<any[]>([])
    const [cancellations, setCancellations] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const fetchLeaves = async () => {
        setLoading(true)
        setError('')
        try {
            const res = await getPendingLeaves()
            if (res.error) {
                if (res.error.includes('Permission denied')) {
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

    const fetchCancellations = async () => {
        setLoading(true)
        setError('')
        try {
            const res = await getPendingCancellations()
            if (res.error) {
                setError(res.error)
            } else {
                setCancellations(res.data || [])
            }
        } catch (e) {
            setError('載入失敗')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (activeTab === 'leaves') {
            fetchLeaves()
        } else {
            fetchCancellations()
        }
    }, [activeTab])

    const handleRefresh = () => {
        if (activeTab === 'leaves') {
            fetchLeaves()
        } else {
            fetchCancellations()
        }
    }

    const handleReviewCancellation = async (cancellationId: number, approved: boolean) => {
        try {
            const res = await reviewLeaveCancellation(cancellationId, approved)
            if (res.error) {
                alert(`錯誤: ${res.error}`)
            } else {
                alert(approved ? '已批准取消請假' : '已拒絕取消請假')
                fetchCancellations()
            }
        } catch (e) {
            alert('操作失敗')
        }
    }

    return (
        <div className="max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-slate-800 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">verified</span>
                請假審核中心
            </h1>

            {/* 標籤頁切換 */}
            <div className="flex gap-4 mb-6 border-b border-slate-200 dark:border-slate-700">
                <button
                    onClick={() => setActiveTab('leaves')}
                    className={`pb-3 px-4 font-medium transition-colors ${activeTab === 'leaves'
                        ? 'text-primary border-b-2 border-primary'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                >
                    請假申請 {leaves.length > 0 && `(${leaves.length})`}
                </button>
                <button
                    onClick={() => setActiveTab('cancellations')}
                    className={`pb-3 px-4 font-medium transition-colors ${activeTab === 'cancellations'
                        ? 'text-primary border-b-2 border-primary'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                >
                    取消申請 {cancellations.length > 0 && `(${cancellations.length})`}
                </button>
            </div>

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                    {activeTab === 'leaves' ? '待審核請假申請' : '待審核取消申請'}
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
            ) : activeTab === 'leaves' ? (
                <AdminLeaveTable data={leaves} onSuccess={handleRefresh} />
            ) : (
                <div className="space-y-4">
                    {cancellations.length === 0 ? (
                        <div className="text-center py-10 text-slate-500">
                            目前沒有待審核的取消申請
                        </div>
                    ) : (
                        cancellations.map((cancellation: any) => (
                            <div key={cancellation.id} className="bg-card-light dark:bg-card-dark rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-slate-300/50 dark:border-slate-700/50 p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="font-bold text-lg text-slate-800 dark:text-white">
                                            {cancellation.user?.display_name || '未知員工'}
                                        </div>
                                        <div className="text-sm text-slate-500 dark:text-slate-400">
                                            {cancellation.user?.email}
                                        </div>
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                        申請時間: {new Date(cancellation.created_at).toLocaleString('zh-TW')}
                                    </div>
                                </div>

                                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
                                    <div className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
                                        <div>
                                            <span className="font-medium">假別:</span>{' '}
                                            {LEAVE_TYPE_MAP[cancellation.leave?.leave_type] || cancellation.leave?.leave_type}
                                        </div>
                                        <div>
                                            <span className="font-medium">日期:</span>{' '}
                                            {cancellation.leave?.start_date} ~ {cancellation.leave?.end_date}
                                        </div>
                                        <div>
                                            <span className="font-medium">時數:</span>{' '}
                                            {cancellation.leave?.hours} 小時
                                        </div>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">取消原因:</div>
                                    <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-200">
                                        {cancellation.cancel_reason}
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3">
                                    <button
                                        onClick={() => handleReviewCancellation(cancellation.id, false)}
                                        className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg font-medium transition-colors"
                                    >
                                        拒絕
                                    </button>
                                    <button
                                        onClick={() => handleReviewCancellation(cancellation.id, true)}
                                        className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg font-medium transition-colors"
                                    >
                                        批准取消
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            <div className="mt-8 p-4 bg-primary/5 dark:bg-primary/10 rounded-lg text-sm text-slate-700 dark:text-slate-300 border border-primary/20">
                <p className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-primary text-base">info</span>
                    <span>{activeTab === 'leaves' ? '批准或拒絕後,員工可在「請假管理」頁面看到更新後的狀態。' : '批准取消申請後,原請假記錄將被標記為已取消。'}</span>
                </p>
            </div>
        </div>
    )
}
