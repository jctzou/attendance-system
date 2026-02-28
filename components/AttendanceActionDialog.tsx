'use client'

import { useState, useEffect, useRef } from 'react'
import { updateAttendance, addAttendanceRecord } from '@/app/attendance/actions'
import TimeSlotSelector from './TimeSlotSelector'
import { Dialog, DialogContent, DialogHeader, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LEAVE_TYPE_MAP } from '@/app/attendance/constants'
import { formatToTaipeiTime, fromTaipeiLocalToUTC } from '@/utils/timezone'

interface Props {
    date: string
    existingRecord?: any
    existingLeave?: any
    onClose: () => void
    onSuccess: () => void
    isAdmin?: boolean
    salaryType?: 'monthly' | 'hourly'
}

export default function AttendanceActionDialog({ date, existingRecord, existingLeave, onClose, onSuccess, isAdmin = false, salaryType = 'monthly' }: Props) {
    const [loading, setLoading] = useState(false)
    const [mode, setMode] = useState<'add' | 'edit'>('add')
    const userSalaryType = salaryType

    // Attendance Form State (Always Local ISO String: YYYY-MM-DDTHH:mm)
    const [clockIn, setClockIn] = useState<string>('')
    const [clockOut, setClockOut] = useState<string>('')
    const [breakDuration, setBreakDuration] = useState<number>(1.0)
    const [reason, setReason] = useState('')
    const [validationError, setValidationError] = useState<string | null>(null)

    // 追蹤使用者是否已主動更改時間（防止初始化時觸發午休防呆）
    const hasUserInteracted = useRef(false)

    // 1. Initialize Data
    useEffect(() => {
        // 重置交互旧慌，避免聲下一次對話框開啟時觤發市休防呆
        hasUserInteracted.current = false
        if (existingRecord) {
            setMode('edit')
            setClockIn(existingRecord.clock_in_time ? formatToTaipeiTime(existingRecord.clock_in_time, "yyyy-MM-dd'T'HH:mm") : `${date}T09:00`)
            setClockOut(existingRecord.clock_out_time ? formatToTaipeiTime(existingRecord.clock_out_time, "yyyy-MM-dd'T'HH:mm") : '')
            setBreakDuration(existingRecord.break_duration ?? 1.0)
        } else {
            setMode('add')
            setClockIn(`${date}T09:00`)
            setClockOut(`${date}T18:00`)
            setBreakDuration(1.0)
        }
    }, [existingRecord, date])

    // 2. Validation for clock-in/out times
    useEffect(() => {
        if (clockIn && clockOut) {
            const inTime = new Date(clockIn)
            const outTime = new Date(clockOut)
            if (outTime <= inTime) {
                setValidationError('下班時間必須晚於上班時間')
            } else {
                setValidationError(null)
            }
        } else {
            setValidationError(null)
        }
    }, [clockIn, clockOut])

    // 3. 使用者主動更改時間後，實施午休防呆
    // 法則：上班時間 >= 12:00 或 下班時間 < 12:00 → 午休自動歸零
    useEffect(() => {
        if (!hasUserInteracted.current) return  // 初始化時不觸發
        const clockInHour = clockIn ? parseInt(clockIn.split('T')[1]?.split(':')[0] || '0', 10) : -1
        const clockOutHour = clockOut ? parseInt(clockOut.split('T')[1]?.split(':')[0] || '99', 10) : 99
        if (clockInHour >= 12 || clockOutHour < 12) {
            setBreakDuration(0)
        }
    }, [clockIn, clockOut])

    // 包裝對話框的時間更改 handler，標記使用者已主動互動
    const handleClockInChange = (val: string) => {
        hasUserInteracted.current = true
        setClockIn(val)
    }
    const handleClockOutChange = (val: string) => {
        hasUserInteracted.current = true
        setClockOut(val)
    }

    // 4. Handlers
    const handleAttendanceSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (validationError) return

        setLoading(true)
        try {
            const utcClockIn = clockIn ? fromTaipeiLocalToUTC(clockIn) : null
            const utcClockOut = clockOut ? fromTaipeiLocalToUTC(clockOut) : null

            let res
            if (mode === 'edit') {
                res = await updateAttendance(
                    existingRecord.id,
                    utcClockIn,
                    utcClockOut,
                    reason,
                    userSalaryType === 'hourly' ? breakDuration : undefined
                )
            } else {
                res = await addAttendanceRecord(
                    date,
                    utcClockIn,
                    utcClockOut,
                    reason,
                    userSalaryType === 'hourly' ? breakDuration : undefined
                )
            }

            if (res && !res.success) {
                alert(res.error.message)
            } else {
                onSuccess()
                onClose()
            }
        } catch (error) {
            console.error(error)
            alert('發生錯誤')
        } finally {
            setLoading(false)
        }
    }

    const getTitle = () => {
        return existingRecord ? `${date} - 修改打卡` : `${date} - 補登打卡`
    }

    return (
        <Dialog isOpen={true} onClose={onClose} maxWidth="lg">
            <DialogHeader title={getTitle()} onClose={onClose} />

            <DialogContent className="pt-6">
                {/* 若該日有請假，顯示提示橫幅（唯讀） */}
                {existingLeave && (
                    <div className={`mb-4 p-3 rounded-md border text-sm flex items-center gap-2 ${existingLeave.status === 'approved'
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
                        : existingLeave.status === 'cancel_pending'
                            ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-300'
                            : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300'
                        }`}>
                        <span className="material-symbols-outlined text-[18px]">
                            {existingLeave.status === 'approved' ? 'event_available' : 'pending'}
                        </span>
                        <span>
                            <span className="font-semibold">
                                {LEAVE_TYPE_MAP[existingLeave.leave_type] || existingLeave.leave_type}
                            </span>
                            {' — '}
                            {existingLeave.status === 'approved' ? '已核准' :
                                existingLeave.status === 'cancel_pending' ? '申請取消中' : '審核中'}
                            {existingLeave.reason && (
                                <span className="opacity-75">（{existingLeave.reason}）</span>
                            )}
                        </span>
                    </div>
                )}

                <form onSubmit={handleAttendanceSubmit} className="space-y-6">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md text-sm text-blue-800 dark:text-blue-300 border border-blue-100 dark:border-blue-900/50">
                        <p>補登與修改請務必填寫原因，系統將記錄修改歷程。</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {userSalaryType === 'hourly' ? (
                            <>
                                <TimeSlotSelector
                                    label="上班時間"
                                    value={clockIn}
                                    onChange={handleClockInChange}
                                    workDate={date}
                                />
                                <div className="relative">
                                    <TimeSlotSelector
                                        label="下班時間"
                                        value={clockOut}
                                        onChange={handleClockOutChange}
                                        workDate={date}
                                    />
                                    {clockOut && (
                                        <button
                                            type="button"
                                            onClick={() => setClockOut('')}
                                            className="absolute right-0 top-0 text-xs text-red-500 hover:text-red-700"
                                        >
                                            清除下班時間
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300">
                                        午休時間 (小時)
                                    </label>
                                    <select
                                        value={breakDuration}
                                        onChange={(e) => setBreakDuration(Number(e.target.value))}
                                        className="w-full p-2 border border-slate-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                                    >
                                        {[0, 1, 1.5, 2].map((val) => (
                                            <option key={val} value={val}>{val} hr</option>
                                        ))}
                                    </select>
                                </div>
                            </>
                        ) : (
                            <>
                                <Input
                                    type="datetime-local"
                                    label="上班時間"
                                    value={clockIn}
                                    onChange={(e) => setClockIn(e.target.value)}
                                    required
                                />
                                <Input
                                    type="datetime-local"
                                    label="下班時間"
                                    value={clockOut}
                                    onChange={(e) => setClockOut(e.target.value)}
                                />
                            </>
                        )}
                    </div>

                    {/* Error Message */}
                    {validationError && (
                        <div className="text-red-500 text-sm font-medium bg-red-50 p-3 rounded-md border border-red-200">
                            ⚠️ {validationError}
                        </div>
                    )}

                    <Input
                        label={mode === 'edit' ? "修改原因 (必填)" : "補登原因 (必填)"}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="請說明原因..."
                        required
                    />

                    <DialogFooter>
                        <Button variant="outline" onClick={onClose} disabled={loading}>
                            取消
                        </Button>
                        <Button type="submit" disabled={loading || !!validationError} isLoading={loading}>
                            {mode === 'edit' ? '確認修改' : '確認補登'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
