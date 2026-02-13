'use client'

import { useState, useEffect } from 'react'
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
    const [reason, setReason] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    // Date -> Duration (1.0, 0.5, 0)
    const [dailyStatus, setDailyStatus] = useState<Record<string, number>>({})

    // Generate date list when start/end changes
    useEffect(() => {
        if (!startDate || !endDate) {
            setDailyStatus({})
            return
        }

        const start = new Date(startDate)
        const end = new Date(endDate)

        if (start > end) {
            setDailyStatus({})
            return
        }

        const newStatus: Record<string, number> = {}
        const current = new Date(start)

        while (current <= end) {
            const dateStr = current.toISOString().split('T')[0]
            // Default to 1.0 (Full Day)
            newStatus[dateStr] = 1.0
            current.setDate(current.getDate() + 1)
        }
        setDailyStatus(newStatus)
    }, [startDate, endDate])

    const totalDays = Object.values(dailyStatus).reduce((sum, val) => sum + val, 0)

    const handleStatusChange = (date: string, value: number) => {
        setDailyStatus(prev => ({
            ...prev,
            [date]: value
        }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!startDate || !endDate || !reason) {
            setError('請填寫完整資訊')
            return
        }

        if (totalDays <= 0) {
            setError('請假天數必須大於 0')
            return
        }

        // 前端檢查特休餘額
        if (leaveType === 'annual_leave' && annualLeaveBalance) {
            const remainingDays = annualLeaveBalance.total_days - annualLeaveBalance.used_days
            if (totalDays > remainingDays) {
                setError(`特休餘額不足。剩餘: ${remainingDays} 天，申請: ${totalDays} 天`)
                return
            }
        }

        setLoading(true)
        setError('')

        try {
            const res = await applyLeave(leaveType, startDate, endDate, totalDays, reason)
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

    // Helper to format date for display
    const formatDateDisplay = (dateStr: string) => {
        // Parse YYYY-MM-DD directly to avoid UTC/Local shifting issues
        const [year, month, day] = dateStr.split('-').map(Number)
        // Create local date object (months are 0-indexed)
        const date = new Date(year, month - 1, day)
        const dayOfWeek = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()]
        return `${month}月${day}日 (${dayOfWeek})`
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
                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-shadow"
                        >
                            {LEAVE_TYPES.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                        {leaveType === 'annual_leave' && annualLeaveBalance && (
                            <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">info</span>
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

                    {/* Daily Breakdown List */}
                    {Object.keys(dailyStatus).sort().length > 0 && (
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    請假天數 (每日明細)
                                </label>
                                <div className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-medium text-slate-600 dark:text-slate-400">
                                    共 {totalDays} 天
                                </div>
                            </div>

                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                                {Object.keys(dailyStatus).sort().map(date => {
                                    const status = dailyStatus[date]
                                    const isNone = status === 0

                                    // Robust weekend check
                                    const [y, m, d] = date.split('-').map(Number)
                                    const day = new Date(y, m - 1, d).getDay()
                                    const isWeekend = day === 0 || day === 6 // 0=Sun, 6=Sat

                                    return (
                                        <div
                                            key={date}
                                            className={`
                                                flex justify-between items-center p-3 rounded-xl border transition-all duration-200
                                                ${isNone
                                                    ? 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-60'
                                                    : isWeekend
                                                        ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30 shadow-sm'
                                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm hover:border-primary/50 dark:hover:border-primary/50'
                                                }
                                            `}
                                        >
                                            <div className={`text-sm font-medium ${isNone ? 'text-slate-400 line-through decoration-slate-400' : isWeekend ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                                {formatDateDisplay(date)}
                                                {!isNone && (
                                                    <div className={`text-xs mt-0.5 font-bold ${status === 1 ? 'text-orange-500' : 'text-orange-400'}`}>
                                                        {status === 1 ? '全天' : '半天'}
                                                    </div>
                                                )}
                                                {isNone && <div className="text-xs mt-0.5 text-slate-400">不請假</div>}
                                            </div>

                                            <div className={`flex rounded-lg p-1 ${isWeekend ? 'bg-white/50 dark:bg-slate-900/50' : 'bg-slate-100 dark:bg-slate-900'}`}>
                                                <button
                                                    type="button"
                                                    onClick={() => handleStatusChange(date, 1)}
                                                    className={`
                                                        px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200
                                                        ${status === 1
                                                            ? 'bg-orange-500 text-white shadow-sm'
                                                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                                        }
                                                    `}
                                                >
                                                    全天
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleStatusChange(date, 0.5)}
                                                    className={`
                                                        px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200
                                                        ${status === 0.5
                                                            ? 'bg-orange-500 text-white shadow-sm'
                                                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                                        }
                                                    `}
                                                >
                                                    半天
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleStatusChange(date, 0)}
                                                    className={`
                                                        px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200
                                                        ${status === 0
                                                            ? 'bg-slate-500 text-white shadow-sm'
                                                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                                        }
                                                    `}
                                                >
                                                    不請
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">請假原因</label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            required
                            className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent h-24 resize-none transition-shadow"
                            placeholder="請說明請假原因..."
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-md flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">error</span>
                            {error}
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={onClose} disabled={loading} type="button">
                            取消
                        </Button>
                        <Button type="submit" disabled={loading || totalDays <= 0} isLoading={loading}>
                            送出申請 {totalDays > 0 && `(${totalDays} 天)`}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
