'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { updateAttendance, addAttendanceRecord } from '@/app/attendance/actions'
import { cancelLeave } from '@/app/leaves/actions'
import TimeSlotSelector from './TimeSlotSelector'
import { Dialog, DialogContent, DialogHeader, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LEAVE_TYPE_MAP } from '@/app/attendance/constants'

interface Props {
    date: string
    existingRecord?: any
    existingLeave?: any
    onClose: () => void
    onSuccess: () => void
    isAdmin?: boolean
}

type Tab = 'attendance' | 'leave'

import { toLocalISOString, toLocalDateString, toUTCISOString } from '@/utils/date-helpers'

// ... imports

// Remove manual toLocalISOString helper

export default function AttendanceActionDialog({ date, existingRecord, existingLeave, onClose, onSuccess, isAdmin = false }: Props) {
    const [activeTab, setActiveTab] = useState<Tab>('attendance')
    const [loading, setLoading] = useState(false)
    const [mode, setMode] = useState<'add' | 'edit'>('add')
    const [userSalaryType, setUserSalaryType] = useState<'monthly' | 'hourly'>('monthly')

    // Attendance Form State (Always Local ISO String: YYYY-MM-DDTHH:mm)
    const [clockIn, setClockIn] = useState<string>('')
    const [clockOut, setClockOut] = useState<string>('')
    const [breakDuration, setBreakDuration] = useState<number>(1.0)
    const [reason, setReason] = useState('')
    const [validationError, setValidationError] = useState<string | null>(null)

    // Leave Form State
    const [leaveType, setLeaveType] = useState('sick')
    const [leaveStart, setLeaveStart] = useState(date)
    const [leaveEnd, setLeaveEnd] = useState(date)
    const [leaveReason, setLeaveReason] = useState('')

    // 1. Initialize Data
    useEffect(() => {
        // ... fetchUserType ...

        if (existingRecord) {
            setMode('edit')
            // Convert DB UTC -> Local ISO for State
            setClockIn(toLocalISOString(existingRecord.clock_in_time))
            setClockOut(toLocalISOString(existingRecord.clock_out_time))
            setBreakDuration(existingRecord.break_duration ?? 1.0)
            setActiveTab('attendance')
        } else {
            setMode('add')
            // Default: 09:00 / 18:00 Local Time on the selected date
            setClockIn(`${date}T09:00`)
            setClockOut(`${date}T18:00`)
            setBreakDuration(1.0)

            if (existingLeave) {
                setActiveTab('leave')
            } else {
                setActiveTab('attendance')
            }
        }

        if (existingLeave) {
            setLeaveType(existingLeave.leave_type)
            setLeaveStart(toLocalDateString(existingLeave.start_date))
            setLeaveEnd(toLocalDateString(existingLeave.end_date))
            setLeaveReason(existingLeave.reason || '')
        } else {
            setLeaveStart(date)
            setLeaveEnd(date)
        }
    }, [existingRecord, existingLeave, date])

    // ... validation ...

    // 3. Handlers
    const handleAttendanceSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (validationError) return

        setLoading(true)
        try {
            // Convert Local ISO -> UTC ISO for DB
            const utcClockIn = toUTCISOString(clockIn)
            const utcClockOut = toUTCISOString(clockOut)

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

            if (res?.error) {
                alert(res.error)
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

    const handleLeaveSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            setLoading(false)
            return
        }

        // @ts-ignore
        const { error } = await (supabase.from('leaves') as any).insert({
            user_id: user.id,
            leave_type: leaveType,
            start_date: leaveStart,
            end_date: leaveEnd,
            reason: leaveReason,
            status: 'pending'
        })

        if (error) {
            alert(error.message)
        } else {
            alert('假單已送出申請')
            onSuccess()
            onClose()
        }
        setLoading(false)
    }

    const handleCancelLeave = async () => {
        if (!existingLeave) return
        if (!confirm('確定要取消此請假申請嗎？')) return

        setLoading(true)
        try {
            const res = await cancelLeave(existingLeave.id)
            if (res.error) {
                alert(res.error)
            } else {
                alert('已取消申請')
                onSuccess()
                onClose()
            }
        } catch (err) {
            console.error(err)
            alert('發生錯誤')
        } finally {
            setLoading(false)
        }
    }

    const getTitle = () => {
        if (activeTab === 'leave') return existingLeave ? `${date} - 請假詳情` : `${date} - 請假申請`
        return existingRecord ? `${date} - 修改打卡` : `${date} - 補登打卡`
    }

    return (
        <Dialog isOpen={true} onClose={onClose} maxWidth="lg">
            <DialogHeader title={getTitle()} onClose={onClose} />

            <div className="border-b border-slate-200 dark:border-slate-700 px-6">
                <div className="flex space-x-6">
                    <button
                        onClick={() => setActiveTab('attendance')}
                        className={`py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'attendance'
                            ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        {existingRecord ? '修改打卡' : '補登打卡'}
                    </button>
                    <button
                        onClick={() => setActiveTab('leave')}
                        className={`py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'leave'
                            ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        {existingLeave ? '請假詳情' : '請假申請'}
                    </button>
                </div>
            </div>

            <DialogContent className="pt-6">
                {activeTab === 'attendance' ? (
                    <form onSubmit={handleAttendanceSubmit} className="space-y-6">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md text-sm text-blue-800 dark:text-blue-300 mb-4 border border-blue-100 dark:border-blue-900/50">
                            <p>補登與修改請務必填寫原因，系統將記錄修改歷程。</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Salary Type Logic Separation via Implementation Plan */}
                            {userSalaryType === 'hourly' ? (
                                <>
                                    <TimeSlotSelector
                                        label="上班時間"
                                        value={clockIn}
                                        onChange={setClockIn}
                                    />
                                    <TimeSlotSelector
                                        label="下班時間"
                                        value={clockOut}
                                        onChange={setClockOut}
                                    />
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            午休時間 (小時)
                                        </label>
                                        <select
                                            value={breakDuration}
                                            onChange={(e) => setBreakDuration(Number(e.target.value))}
                                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                                        >
                                            {[0, 0.5, 1, 1.5, 2, 2.5, 3].map((val) => (
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
                                        required
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
                ) : (
                    // Leave Tab
                    <div className="space-y-6">
                        {existingLeave ? (
                            // Existing Leave View
                            <div className="space-y-4">
                                <div className={`p-4 rounded-md border ${existingLeave.status === 'approved'
                                    ? 'bg-green-50 border-green-200 text-green-800'
                                    : 'bg-yellow-50 border-yellow-200 text-yellow-800'
                                    }`}>
                                    <div className="font-bold flex items-center gap-2">
                                        {existingLeave.status === 'approved' ? '✓ 已核准' : '⏳ 審核中'}
                                        <span className="text-sm font-normal opacity-75">
                                            ({LEAVE_TYPE_MAP[existingLeave.leave_type] || '未定義假別'})
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-slate-500">開始日期</label>
                                        <div className="font-medium">{existingLeave.start_date.split('T')[0]}</div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500">結束日期</label>
                                        <div className="font-medium">{existingLeave.end_date.split('T')[0]}</div>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500">事由</label>
                                    <div className="font-medium">{existingLeave.reason}</div>
                                </div>

                                <DialogFooter>
                                    <Button variant="outline" onClick={onClose}>
                                        關閉
                                    </Button>
                                    {existingLeave.status === 'pending' && (
                                        <Button
                                            variant="danger"
                                            onClick={handleCancelLeave}
                                            disabled={loading}
                                            isLoading={loading}
                                        >
                                            取消申請
                                        </Button>
                                    )}
                                </DialogFooter>
                            </div>
                        ) : (
                            // New Leave Form
                            <form onSubmit={handleLeaveSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        假別
                                    </label>
                                    <select
                                        value={leaveType}
                                        onChange={(e) => setLeaveType(e.target.value)}
                                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                                    >
                                        {Object.entries(LEAVE_TYPE_MAP).map(([key, label]) => (
                                            <option key={key} value={key}>{label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <Input
                                        type="date"
                                        label="開始日期"
                                        value={leaveStart}
                                        onChange={(e) => setLeaveStart(e.target.value)}
                                        required
                                    />
                                    <Input
                                        type="date"
                                        label="結束日期"
                                        value={leaveEnd}
                                        onChange={(e) => setLeaveEnd(e.target.value)}
                                        required
                                    />
                                </div>

                                <Input
                                    label="請假事由"
                                    value={leaveReason}
                                    onChange={(e) => setLeaveReason(e.target.value)}
                                    placeholder="請填寫具體事由"
                                    required
                                />

                                <DialogFooter>
                                    <Button variant="outline" onClick={onClose} disabled={loading}>
                                        取消
                                    </Button>
                                    <Button type="submit" disabled={loading} isLoading={loading}>
                                        送出申請
                                    </Button>
                                </DialogFooter>
                            </form>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog >
    )
}

