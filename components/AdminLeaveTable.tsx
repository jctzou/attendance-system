'use client'

import { useState } from 'react'
import { reviewLeave } from '@/app/leaves/actions'

interface Props {
    data: any[]
    onSuccess?: () => void
}

const LEAVE_TYPE_MAP: Record<string, string> = {
    'sick_leave': '病假',
    'personal_leave': '事假',
    'annual_leave': '特休',
    'other': '其他',
}

export default function AdminLeaveTable({ data, onSuccess }: Props) {
    const [processingId, setProcessingId] = useState<number | null>(null)

    const handleReview = async (id: number, status: 'approved' | 'rejected') => {
        const actionText = status === 'approved' ? '批准' : '拒絕'
        if (!confirm(`確定要${actionText}這筆申請嗎？`)) return

        setProcessingId(id)
        try {
            const res = await reviewLeave(id, status)
            if (res.error) {
                alert(res.error)
            } else {
                alert(`${actionText}成功！`)
                if (onSuccess) {
                    onSuccess()
                }
            }
        } catch (e) {
            console.error('Error in handleReview:', e)
            alert('操作失敗')
        } finally {
            setProcessingId(null)
        }
    }

    if (data.length === 0) {
        return (
            <div className="text-center py-10 text-slate-500 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                目前沒有待審核的申請
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Mobile Card View (< md) */}
            <div className="block md:hidden space-y-4">
                {data.map((leave) => (
                    <div key={leave.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
                        {/* Header: User Info */}
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <div className="font-bold text-lg text-slate-800 dark:text-slate-100">
                                    {leave.user?.display_name || 'Unknown'}
                                </div>
                                <div className="text-sm text-slate-500 dark:text-slate-400">
                                    {leave.user?.email}
                                </div>
                            </div>
                            <div className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                {LEAVE_TYPE_MAP[leave.leave_type] || leave.leave_type}
                            </div>
                        </div>

                        {/* Content: Details */}
                        <div className="space-y-3 mb-4">
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700/50">
                                <div className="text-sm text-slate-600 dark:text-slate-300">
                                    <div className="flex justify-between mb-1">
                                        <span className="text-slate-400">日期:</span>
                                        <span className="font-mono">{leave.start_date} ~ {leave.end_date}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">天數:</span>
                                        <span className="font-medium">{leave.days} 天</span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div className="text-xs font-medium text-slate-400 mb-1">事由:</div>
                                <div className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                                    {leave.reason}
                                </div>
                            </div>

                            <div className="text-xs text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-700">
                                申請時間: {new Date(leave.created_at).toLocaleString('zh-TW')}
                            </div>
                        </div>

                        {/* Footer: Actions */}
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => handleReview(leave.id, 'rejected')}
                                disabled={processingId === leave.id}
                                className="w-full py-2.5 px-4 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
                            >
                                拒絕
                            </button>
                            <button
                                onClick={() => handleReview(leave.id, 'approved')}
                                disabled={processingId === leave.id}
                                className="w-full py-2.5 px-4 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-sm transition-colors disabled:opacity-50"
                            >
                                批准
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-900/50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">申請人</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">假別</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">時間 / 天數</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">原因</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">申請時間</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">審核</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                        {data.map((leave) => (
                            <tr key={leave.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                                        {leave.user?.display_name || 'Unknown'}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                        {leave.user?.email}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                        {LEAVE_TYPE_MAP[leave.leave_type] || leave.leave_type}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                                    <div className="font-mono">{leave.start_date} ~ {leave.end_date}</div>
                                    <div className="text-xs text-slate-400 mt-0.5">共 {leave.days} 天</div>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 max-w-xs truncate" title={leave.reason}>
                                    {leave.reason}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                                    {new Date(leave.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                    <button
                                        onClick={() => handleReview(leave.id, 'approved')}
                                        disabled={processingId === leave.id}
                                        className="text-emerald-600 hover:text-emerald-900 dark:hover:text-emerald-400 disabled:opacity-50 transition-colors"
                                    >
                                        批准
                                    </button>
                                    <button
                                        onClick={() => handleReview(leave.id, 'rejected')}
                                        disabled={processingId === leave.id}
                                        className="text-red-600 hover:text-red-900 dark:hover:text-red-400 disabled:opacity-50 transition-colors"
                                    >
                                        拒絕
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
