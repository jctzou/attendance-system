'use client'

import { useState } from 'react'
import EditAttendanceDialog from './EditAttendanceDialog'
import AttendanceLogDialog from './AttendanceLogDialog'

interface Props {
    data: any[]
}

export default function AttendanceTable({ data }: Props) {
    const [editingRecord, setEditingRecord] = useState<any>(null)
    const [viewingLogsId, setViewingLogsId] = useState<number | null>(null)

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'late': return 'text-orange-600 bg-orange-50'
            case 'early_leave': return 'text-yellow-600 bg-yellow-50'
            case 'absent': return 'text-red-600 bg-red-50'
            default: return 'text-green-600 bg-green-50'
        }
    }

    const getStatusText = (status: string) => {
        switch (status) {
            case 'late': return '遲到'
            case 'early_leave': return '早退'
            case 'absent': return '缺勤'
            default: return '正常'
        }
    }

    return (
        <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">日期</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">上班時間</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">下班時間</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">工時</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">狀態</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {data.length === 0 ? (
                        <tr>
                            <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                                無打卡記錄
                            </td>
                        </tr>
                    ) : (
                        data.map((record) => (
                            <tr key={record.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {record.work_date}
                                    {record.is_edited && <span className="ml-2 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">已修改</span>}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {record.clock_in_time ? new Date(record.clock_in_time).toLocaleTimeString('zh-TW', { hour12: false }) : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {record.clock_out_time ? new Date(record.clock_out_time).toLocaleTimeString('zh-TW', { hour12: false }) : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {record.work_hours || '-'} hr
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(record.status)}`}>
                                        {getStatusText(record.status)}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 space-x-2">
                                    <button
                                        onClick={() => setEditingRecord(record)}
                                        className="text-blue-600 hover:text-blue-900 font-medium btn-pointer"
                                    >
                                        修改
                                    </button>
                                    {record.is_edited && (
                                        <button
                                            onClick={() => setViewingLogsId(record.id)}
                                            className="text-gray-500 hover:text-gray-700 font-medium btn-pointer"
                                        >
                                            紀錄
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>

            {editingRecord && (
                <EditAttendanceDialog
                    record={editingRecord}
                    onClose={() => setEditingRecord(null)}
                    onSuccess={() => {
                        // 簡單重整頁面獲取最新數據，或由上層傳入 refresh
                        window.location.reload()
                    }}
                />
            )}

            {viewingLogsId && (
                <AttendanceLogDialog
                    attendanceId={viewingLogsId}
                    onClose={() => setViewingLogsId(null)}
                />
            )}
        </div>
    )
}
