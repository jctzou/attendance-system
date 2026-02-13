'use client'

import { useState } from 'react'
import { cancelLeave } from '@/app/leaves/actions'

interface Props {
    data: any[]
}

const LEAVE_TYPE_MAP: Record<string, string> = {
    'sick_leave': '病假',
    'personal_leave': '事假',
    'annual_leave': '特休',
    'other': '其他',
}

export default function LeaveTable({ data }: Props) {
    const [loadingId, setLoadingId] = useState<number | null>(null)

    const handleCancel = async (id: number) => {
        if (!confirm('確定要取消此請假申請嗎？')) return
        setLoadingId(id)
        try {
            await cancelLeave(id)
            // revalidatePath will refresh data
        } catch (e) {
            alert('取消失敗')
        } finally {
            setLoadingId(null)
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved':
                return <span className="px-2.5 py-1 text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">已批准</span>
            case 'rejected':
                return <span className="px-2.5 py-1 text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full">已拒絕</span>
            case 'cancelled':
                return <span className="px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 rounded-full">已取消</span>
            default:
                return <span className="px-2.5 py-1 text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 rounded-full">待審核</span>
        }
    }

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden leave-table-root">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-900/50">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">假別</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">日期</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">天數</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">原因</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">狀態</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {data.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-16 text-center text-slate-500 dark:text-slate-400">
                                    <div className="flex flex-col items-center gap-2">
                                        <span className="material-symbols-outlined text-4xl text-slate-300">event_available</span>
                                        <p>目前沒有請假記錄</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            data.map((leave) => (
                                <tr key={leave.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">
                                        {LEAVE_TYPE_MAP[leave.leave_type] || leave.leave_type}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                                        {leave.start_date} ~ {leave.end_date}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                                        {leave.days} 天
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300 max-w-xs truncate" title={leave.reason}>
                                        {leave.reason}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {getStatusBadge(leave.status)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        {leave.status === 'pending' && (
                                            <button
                                                onClick={() => handleCancel(leave.id)}
                                                disabled={loadingId === leave.id}
                                                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium disabled:opacity-50 transition-colors"
                                            >
                                                {loadingId === leave.id ? '取消中...' : '取消'}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
