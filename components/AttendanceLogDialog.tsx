'use client'

import { useEffect, useState } from 'react'
import { getAttendanceLogs } from '@/app/attendance/actions'

interface Props {
    attendanceId: number
    onClose: () => void
}

export default function AttendanceLogDialog({ attendanceId, onClose }: Props) {
    const [logs, setLogs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        getAttendanceLogs(attendanceId).then(res => {
            if (res.data) {
                setLogs(res.data)
            }
            setLoading(false)
        })
    }, [attendanceId])

    const formatTime = (iso: string | null) => {
        if (!iso) return '-'
        return new Date(iso).toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit' })
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">修改紀錄</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
                </div>

                {loading ? (
                    <div className="text-center py-10">載入中...</div>
                ) : logs.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">無修改紀錄</div>
                ) : (
                    <div className="space-y-4">
                        {logs.map((log) => (
                            <div key={log.id} className="border rounded-md p-4 bg-gray-50">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="text-sm font-bold text-gray-800">
                                        修改者: {log.editor?.display_name || 'Unknown'}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {new Date(log.created_at).toLocaleString()}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-sm mb-2">
                                    <div>
                                        <span className="text-gray-500 block">修改前</span>
                                        <div>In: {formatTime(log.old_clock_in_time)}</div>
                                        <div>Out: {formatTime(log.old_clock_out_time)}</div>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block">修改後</span>
                                        <div className="font-mono text-blue-700">In: {formatTime(log.new_clock_in_time)}</div>
                                        <div className="font-mono text-blue-700">Out: {formatTime(log.new_clock_out_time)}</div>
                                    </div>
                                </div>

                                <div className="text-sm bg-white p-2 rounded border">
                                    <span className="text-gray-500 mr-2">原因:</span>
                                    {log.edit_reason}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
