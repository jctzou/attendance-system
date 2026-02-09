'use client'

import { useState } from 'react'
import { updateAttendance } from '@/app/attendance/actions'

interface Props {
    record: any
    onClose: () => void
    onSuccess: () => void
}

export default function EditAttendanceDialog({ record, onClose, onSuccess }: Props) {
    const [clockIn, setClockIn] = useState(toDatetimeLocal(record.clock_in_time))
    const [clockOut, setClockOut] = useState(toDatetimeLocal(record.clock_out_time))
    const [reason, setReason] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    function toDatetimeLocal(isoString: string | null) {
        if (!isoString) return ''
        // Convert UTC/ISO to local datetime string for input: YYYY-MM-DDTHH:mm
        const date = new Date(isoString)
        const offset = date.getTimezoneOffset()
        const localDate = new Date(date.getTime() - offset * 60 * 1000)
        return localDate.toISOString().slice(0, 16)
    }

    function toISO(localString: string) {
        if (!localString) return null
        return new Date(localString).toISOString()
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!reason.trim()) {
            setError('請填寫修改原因')
            return
        }
        setLoading(true)
        setError('')

        try {
            const res = await updateAttendance(
                record.id,
                toISO(clockIn),
                toISO(clockOut),
                reason
            )
            if (res.error) {
                setError(res.error)
            } else {
                onSuccess()
                onClose()
            }
        } catch (err) {
            setError('發生錯誤')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                <h3 className="text-xl font-bold mb-4">修改打卡記錄</h3>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
                        <div className="text-gray-900">{record.work_date}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">上班時間</label>
                            <input
                                type="datetime-local"
                                value={clockIn}
                                onChange={(e) => setClockIn(e.target.value)}
                                className="w-full border rounded-md p-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">下班時間</label>
                            <input
                                type="datetime-local"
                                value={clockOut}
                                onChange={(e) => setClockOut(e.target.value)}
                                className="w-full border rounded-md p-2 text-sm"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">修改原因 (必填)</label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            required
                            className="w-full border rounded-md p-2 text-sm h-24 resize-none"
                            placeholder="請說明修改原因..."
                        />
                    </div>

                    {error && <div className="text-red-600 text-sm">{error}</div>}

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md font-medium"
                            disabled={loading}
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-md font-medium disabled:opacity-50"
                            disabled={loading}
                        >
                            {loading ? '儲存中...' : '確認修改'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
