'use client'

import { useEffect, useState } from 'react'
import { getAttendanceLogs } from '@/app/attendance/actions'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/Dialog'
import { Card } from '@/components/ui/Card'

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
        <Dialog isOpen={true} onClose={onClose} maxWidth="lg">
            <DialogHeader title="修改紀錄" onClose={onClose} />
            <DialogContent>
                {loading ? (
                    <div className="text-center py-10 text-slate-500">
                        <div className="animate-spin w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full mx-auto mb-2"></div>
                        載入中...
                    </div>
                ) : logs.length === 0 ? (
                    <div className="text-center py-10 text-slate-500">無修改紀錄</div>
                ) : (
                    <div className="space-y-4">
                        {logs.map((log) => (
                            <Card key={log.id} padding="p-4" className="bg-slate-50 dark:bg-slate-800 border !border-slate-200 dark:!border-slate-700 shadow-none">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                        修改者: {log.editor?.display_name || 'Unknown'}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        {new Date(log.created_at).toLocaleString()}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                                    <div className="bg-white dark:bg-slate-900 rounded p-2 border border-slate-100 dark:border-slate-800">
                                        <span className="text-xs text-slate-400 block mb-1 uppercase font-bold tracking-wider">Original</span>
                                        <div className="text-slate-600 dark:text-slate-400">In: {formatTime(log.old_clock_in_time)}</div>
                                        <div className="text-slate-600 dark:text-slate-400">Out: {formatTime(log.old_clock_out_time)}</div>
                                    </div>
                                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-2 border border-blue-100 dark:border-blue-800/50">
                                        <span className="text-xs text-blue-400 block mb-1 uppercase font-bold tracking-wider">New</span>
                                        <div className="font-bold text-blue-700 dark:text-blue-400">In: {formatTime(log.new_clock_in_time)}</div>
                                        <div className="font-bold text-blue-700 dark:text-blue-400">Out: {formatTime(log.new_clock_out_time)}</div>
                                    </div>
                                </div>

                                <div className="text-sm bg-white dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-800">
                                    <span className="text-slate-400 mr-2 font-medium">原因:</span>
                                    <span className="text-slate-700 dark:text-slate-300">{log.edit_reason}</span>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
