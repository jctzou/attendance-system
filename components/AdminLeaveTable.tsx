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
        console.log('handleReview called:', { id, status })
        if (!confirm(`確定要${actionText}這筆申請嗎？`)) return

        setProcessingId(id)
        try {
            console.log('Calling reviewLeave...')
            const res = await reviewLeave(id, status)
            console.log('reviewLeave response:', res)
            if (res.error) {
                alert(res.error)
            } else {
                alert(`${actionText}成功！`)
                // Call parent's refresh function
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

    return (
        <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">申請人</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">假別</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">時間 / 時數</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">原因</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">申請時間</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">審核</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {data.length === 0 ? (
                        <tr>
                            <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                                目前沒有待審核的申請
                            </td>
                        </tr>
                    ) : (
                        data.map((leave) => (
                            <tr key={leave.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">
                                        {leave.user?.display_name || 'Unknown'}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {leave.user?.email}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {LEAVE_TYPE_MAP[leave.leave_type] || leave.leave_type}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <div>{leave.start_date} ~ {leave.end_date}</div>
                                    <div className="text-xs text-gray-400">共 {leave.hours} 小時</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate" title={leave.reason}>
                                    {leave.reason}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {new Date(leave.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                    <button
                                        onClick={() => handleReview(leave.id, 'approved')}
                                        disabled={processingId === leave.id}
                                        className="text-green-600 hover:text-green-900 disabled:opacity-50 btn-pointer"
                                    >
                                        批准
                                    </button>
                                    <button
                                        onClick={() => handleReview(leave.id, 'rejected')}
                                        disabled={processingId === leave.id}
                                        className="text-red-600 hover:text-red-900 disabled:opacity-50 btn-pointer"
                                    >
                                        拒絕
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    )
}
