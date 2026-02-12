'use client'

import { useState } from 'react'
import { applyLeave } from '@/app/leaves/actions'
import { Dialog, DialogContent, DialogHeader, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface Props {
    onClose: () => void
    onSuccess: () => void
    annualLeaveBalance?: any
}

const LEAVE_TYPES = [
    { value: 'sick_leave', label: '病假' },
    { value: 'personal_leave', label: '事假' },
    { value: 'annual_leave', label: '特休' },
    { value: 'other', label: '其他' },
]

export default function ApplyLeaveDialog({ onClose, onSuccess, annualLeaveBalance }: Props) {
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

        // 前端檢查特休餘額
        if (leaveType === 'annual_leave' && annualLeaveBalance) {
            const requestedDays = hours / 8
            const remainingDays = annualLeaveBalance.total_days - annualLeaveBalance.used_days
            if (requestedDays > remainingDays) {
                setError(`特休餘額不足。剩餘: ${remainingDays} 天，申請: ${requestedDays} 天`)
                return
            }
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
        <Dialog isOpen={true} onClose={onClose} maxWidth="md">
            <DialogHeader title="申請請假" onClose={onClose} />
            <DialogContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">假別</label>
                        <select
                            value={leaveType}
                            onChange={(e) => setLeaveType(e.target.value)}
                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                        >
                            {LEAVE_TYPES.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                        {/* 顯示特休餘額提示 */}
                        {leaveType === 'annual_leave' && annualLeaveBalance && (
                            <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                剩餘特休: {annualLeaveBalance.total_days - annualLeaveBalance.used_days} 天 / 總計: {annualLeaveBalance.total_days} 天
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <Input
                            type="date"
                            label="開始日期"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            required
                        />
                        <Input
                            type="date"
                            label="結束日期"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            required
                        />
                    </div>

                    <Input
                        type="number"
                        label="請假時數 (小時)"
                        value={hours.toString()}
                        onChange={(e) => setHours(Number(e.target.value))}
                        min="0.5"
                        step="0.5"
                        required
                    />

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">請假原因</label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            required
                            className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent h-24 resize-none"
                            placeholder="請說明請假原因..."
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-md">
                            {error}
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={onClose} disabled={loading} type="button">
                            取消
                        </Button>
                        <Button type="submit" disabled={loading} isLoading={loading}>
                            送出申請
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
