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
                return <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-700 rounded-full">已批准</span>
            case 'rejected':
                return <span className="px-2 py-1 text-xs font-semibold bg-red-100 text-red-700 rounded-full">已拒絕</span>
            default:
                return <span className="px-2 py-1 text-xs font-semibold bg-yellow-100 text-yellow-700 rounded-full">待審核</span>
        }
    }

    return (
        <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">假別</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">日期</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">時數</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">原因</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">狀態</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {data.length === 0 ? (
                        <tr>
                            <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                                無請假記錄
                            </td>
                        </tr>
                    ) : (
                        data.map((leave) => (
                            <tr key={leave.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {LEAVE_TYPE_MAP[leave.leave_type] || leave.leave_type}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {leave.start_date} ~ {leave.end_date}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {leave.hours} hr
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate" title={leave.reason}>
                                    {leave.reason}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {getStatusBadge(leave.status)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {leave.status === 'pending' && (
                                        <button
                                            onClick={() => handleCancel(leave.id)}
                                            disabled={loadingId === leave.id}
                                            className="text-red-600 hover:text-red-800 font-medium btn-pointer disabled:opacity-50"
                                        >
                                            {loadingId === leave.id ? '...' : '取消'}
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    )
}
