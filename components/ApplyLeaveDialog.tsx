'use client'

import { useState } from 'react'
import { applyLeave } from '@/app/leaves/actions'

interface Props {
    onClose: () => void
    onSuccess: () => void
}

const LEAVE_TYPES = [
    { value: 'sick_leave', label: '病假' },
    { value: 'personal_leave', label: '事假' },
    { value: 'annual_leave', label: '特休' },
    { value: 'other', label: '其他' },
]

export default function ApplyLeaveDialog({ onClose, onSuccess }: Props) {
    const [leaveType, setLeaveType] = useState('sick_leave')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [hours, setHours] = useState(8)
    const [reason, setReason] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!startDate || !endDate || !reason) {
            setError('請填寫完整資訊')
            return
        }
        setLoading(true)
        setError('')

        try {
            const res = await applyLeave(leaveType, startDate, endDate, Number(hours), reason)
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
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">申請請假</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">假別</label>
                        <select
                            value={leaveType}
                            onChange={(e) => setLeaveType(e.target.value)}
                            className="w-full border rounded-md p-2 text-sm bg-white"
                        >
                            {LEAVE_TYPES.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">開始日期</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full border rounded-md p-2 text-sm"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">結束日期</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full border rounded-md p-2 text-sm"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">請假時數 (小時)</label>
                        <input
                            type="number"
                            value={hours}
                            onChange={(e) => setHours(Number(e.target.value))}
                            min="0.5"
                            step="0.5"
                            className="w-full border rounded-md p-2 text-sm"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">請假原因</label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            required
                            className="w-full border rounded-md p-2 text-sm h-24 resize-none"
                            placeholder="請說明請假原因..."
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
                            {loading ? '提交申請...' : '送出申請'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
