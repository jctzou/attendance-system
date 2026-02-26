'use client'

import { useState, useEffect, useTransition } from 'react'
import { clockIn, clockOut, cancelClockOut } from '@/app/attendance/actions'
import { Database } from '@/types/supabase'
import { Dialog, DialogHeader, DialogContent, DialogFooter } from '@/components/ui/Dialog'
import { ATTENDANCE_STATUS_MAP } from '@/app/attendance/constants'
import { features } from '@/utils/features'

// --- Types ---
type AttendanceRow = Database['public']['Tables']['attendance']['Row']

interface Props {
    userId: string
    userName: string | null
    salaryType: 'monthly' | 'hourly'
    userSettings: {
        work_start_time: string
        work_end_time: string
    }
    todayRecord: AttendanceRow | null
}

const STATUS_CONFIG = {
    normal: { label: '正常', color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' },
    late: { label: '遲到', color: 'bg-orange-100 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400' },
    early_leave: { label: '早退', color: 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400' },
    absent: { label: '缺席', color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400' },
}

export default function ModernClockPanel({
    userId,
    userName,
    salaryType,
    userSettings,
    todayRecord: initialRecord,
}: Props) {
    const [time, setTime] = useState<Date | null>(null)
    const [mounted, setMounted] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [message, setMessage] = useState('')
    const [messageType, setMessageType] = useState<'success' | 'error'>('success')

    // Local state for immediate feedback
    const [attendanceRecord, setAttendanceRecord] = useState<AttendanceRow | null>(initialRecord)

    // Hourly: Pre-clock-in slot selection
    const [selectedTimeSlot, setSelectedTimeSlot] = useState<Date | null>(null)

    // Hourly: Post-clock-in break duration selection
    const [breakDuration, setBreakDuration] = useState<number>(1.0)

    // Confirmation Modal State
    const [showCancelConfirm, setShowCancelConfirm] = useState(false)

    // Sync with initial record
    useEffect(() => {
        if (initialRecord) {
            setAttendanceRecord(initialRecord)
            // Restore break duration if applicable
            if (salaryType === 'hourly' && (initialRecord as any).break_duration) {
                setBreakDuration((initialRecord as any).break_duration)
            }
        }
    }, [initialRecord, salaryType])

    // Timer Logic
    useEffect(() => {
        setMounted(true)
        const updateTime = () => setTime(new Date())
        updateTime()
        const timer = setInterval(updateTime, 1000)
        return () => clearInterval(timer)
    }, [])

    // Hourly Slot Logic
    const calculateTimeSlots = (currentTime: Date) => {
        const minutes = currentTime.getMinutes()
        const hours = currentTime.getHours()
        // Prev 30 min slot
        const prevMinutes = Math.floor(minutes / 30) * 30
        const prevSlot = new Date(currentTime)
        prevSlot.setMinutes(prevMinutes, 0, 0)
        // Next 30 min slot
        let nextMinutes = Math.ceil(minutes / 30) * 30
        const nextSlot = new Date(currentTime)
        if (nextMinutes === 60) nextSlot.setHours(hours + 1, 0, 0, 0)
        else nextSlot.setMinutes(nextMinutes, 0, 0)

        return { prevSlot, nextSlot }
    }

    // Initialize Hourly Slot
    useEffect(() => {
        if (salaryType === 'hourly' && time && !selectedTimeSlot) {
            const { prevSlot } = calculateTimeSlots(time)
            setSelectedTimeSlot(prevSlot)
        }
    }, [salaryType, time, selectedTimeSlot])

    // --- Actions ---

    const handleClockIn = async () => {
        setMessage('')
        startTransition(async () => {
            try {
                const timeToUse = salaryType === 'hourly' && selectedTimeSlot ? selectedTimeSlot : undefined
                const res = await clockIn(userId, timeToUse)

                if (!res.success) {
                    setMessageType('error')
                    if (res.error?.code === 'DUPLICATE_ENTRY') {
                        setMessage('⚠️ 今日已完成上班打卡，請勿重複操作')
                    } else {
                        setMessage(`❌ ${res.error?.message}`)
                    }
                } else {
                    setMessageType('success')
                    setMessage('✅ 上班打卡成功')
                    setAttendanceRecord(res.data) // Immediate Update
                }
            } catch (e) {
                setMessageType('error')
                setMessage('❌ 發生未知錯誤')
            }
        })
    }

    const handleClockOut = async () => {
        setMessage('')
        startTransition(async () => {
            try {
                const timeToUse = salaryType === 'hourly' && selectedTimeSlot ? selectedTimeSlot : undefined
                const res = await clockOut(userId, timeToUse, salaryType === 'hourly' ? breakDuration : undefined)

                if (!res.success) {
                    setMessageType('error')
                    setMessage(`❌ ${res.error?.message}`)
                } else {
                    setMessageType('success')
                    setMessage('✅ 下班打卡成功')
                    setAttendanceRecord(res.data) // Immediate Update
                }
            } catch (e) {
                setMessageType('error')
                setMessage('❌ 發生錯誤')
            }
        })
    }

    const handleCancelClockOutClick = () => setShowCancelConfirm(true)

    const handleConfirmCancelClockOut = async () => {
        setShowCancelConfirm(false)
        setMessage('')
        startTransition(async () => {
            try {
                const res = await cancelClockOut(userId)
                if (!res.success) {
                    setMessageType('error')
                    setMessage(`❌ ${res.error?.message}`)
                } else {
                    setMessageType('success')
                    setMessage('✅ 已取消下班打卡')
                    setAttendanceRecord(res.data) // Immediate Update
                }
            } catch (e) {
                setMessageType('error')
                setMessage('❌ 發生錯誤')
            }
        })
    }

    // --- UI Helpers ---

    const formatTime = (date: Date) => date.toLocaleTimeString('zh-TW', { hour12: false })
    const getStatusInfo = (status: string | undefined | null) => {
        if (!status) return STATUS_CONFIG.normal
        return (STATUS_CONFIG as any)[status] || STATUS_CONFIG.normal
    }
    const isClockedIn = !!attendanceRecord?.clock_in_time
    const isClockedOut = !!attendanceRecord?.clock_out_time

    const statusInfo = getStatusInfo(attendanceRecord?.status)

    return (
        <>
            <div className="w-full max-w-lg bg-[var(--color-card-light)] bg-white dark:bg-slate-900 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-200 dark:border-slate-700 p-8 md:p-10 text-center transition-all duration-300">
                {/* Header Info */}
                <div className="space-y-4 mb-10">
                    <p className="text-slate-500 dark:text-slate-400 font-medium tracking-wide">
                        {mounted && time ? time.toLocaleDateString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric' }) : 'Loading...'}
                    </p>
                    <div className="font-mono text-6xl md:text-7xl font-bold text-slate-900 dark:text-white tabular-nums tracking-tight">
                        {mounted && time ? formatTime(time) : '00:00:00'}
                    </div>
                    {salaryType === 'monthly' && (
                        <div className="flex items-center justify-center space-x-2 text-sm text-slate-400 dark:text-slate-500">
                            <span>規定工時: {userSettings.work_start_time?.slice(0, 5)} - {userSettings.work_end_time?.slice(0, 5)}</span>
                        </div>
                    )}
                </div>

                {/* Divider */}
                <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent mb-10"></div>

                {/* Main Action Area */}

                {/* Hourly: Slot Selection */}
                {salaryType === 'hourly' && !isClockedOut && time && (
                    <div className="mb-8">
                        <div className="text-sm text-slate-500 mb-4">{isClockedIn ? '選擇下班時間' : '選擇上班時間'}</div>
                        <div className="grid grid-cols-2 gap-4">
                            {(() => {
                                const { prevSlot, nextSlot } = calculateTimeSlots(time)
                                const isSelected = (slot: Date) => selectedTimeSlot?.getTime() === slot.getTime()
                                return [prevSlot, nextSlot].map((slot, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setSelectedTimeSlot(slot)}
                                        className={`py-4 px-2 rounded-xl border-2 transition-all ${isSelected(slot)
                                            ? 'border-primary bg-orange-50/50 text-primary'
                                            : 'border-slate-100 dark:border-slate-800 hover:border-primary/30 text-slate-600'
                                            }`}
                                    >
                                        <div className="text-2xl font-bold">{slot.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
                                        <div className="text-[10px] uppercase tracking-wider opacity-60">{idx === 0 ? 'Previous' : 'Next'}</div>
                                    </button>
                                ))
                            })()}
                        </div>
                    </div>
                )}

                {/* Hourly: Break Selection (Only when clocked in and about to clock out) */}
                {salaryType === 'hourly' && isClockedIn && !isClockedOut && (
                    <div className="mb-8">
                        <div className="text-sm text-slate-500 mb-2">午休時數</div>
                        <div className="flex justify-center gap-2">
                            {[1.0, 1.5, 2.0].map(d => (
                                <button
                                    key={d}
                                    onClick={() => setBreakDuration(d)}
                                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${breakDuration === d
                                        ? 'bg-primary text-white shadow-lg shadow-primary/30'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                >
                                    {d} hr
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Result / Status Display */}
                <div className="mb-8 min-h-[80px] flex flex-col items-center justify-center">
                    {isPending ? (
                        <div className="text-primary animate-pulse font-bold text-xl">處理中...</div>
                    ) : message ? (
                        <div className={`text-lg font-bold ${messageType === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>{message}</div>
                    ) : isClockedIn ? (
                        <div className="animate-in fade-in zoom-in duration-300">
                            <div className="text-sm text-slate-400 mb-1">上班時間</div>
                            <div className="text-3xl font-bold text-slate-800 dark:text-slate-100 font-mono mb-2">
                                {attendanceRecord?.clock_in_time
                                    ? new Date(attendanceRecord.clock_in_time).toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false, hour: '2-digit', minute: '2-digit' })
                                    : '--:--'}
                            </div>
                            {/* Status Label (Hide for hourly if flag is off) */}
                            {(!attendanceRecord?.status || attendanceRecord.status === 'normal' || salaryType !== 'hourly' || features.showHourlyStatus) && (
                                <span className={`inline-flex items-center px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${statusInfo.color}`}>
                                    {statusInfo.label}
                                </span>
                            )}
                        </div>
                    ) : (
                        <div className="text-slate-400">尚未打卡</div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="space-y-4">
                    {!isClockedIn ? (
                        <button
                            onClick={handleClockIn}
                            disabled={isPending}
                            className="w-full group relative overflow-hidden bg-slate-800 text-white text-lg font-bold py-5 px-8 rounded-2xl shadow-xl shadow-slate-800/20 hover:shadow-slate-800/30 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            上班打卡
                        </button>
                    ) : !isClockedOut ? (
                        <button
                            onClick={handleClockOut}
                            disabled={isPending}
                            className="w-full group relative overflow-hidden bg-[var(--color-primary)] text-white text-lg font-bold py-5 px-8 rounded-2xl shadow-xl shadow-orange-500/20 hover:shadow-orange-500/30 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            下班打卡
                        </button>
                    ) : (
                        <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                            <div className="p-6 bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800 rounded-2xl">
                                <div className="flex justify-center gap-8 mb-4">
                                    <div>
                                        <div className="text-xs text-slate-400 uppercase">Start</div>
                                        <div className="font-mono font-bold text-slate-700 dark:text-slate-300">
                                            {attendanceRecord?.clock_in_time ? new Date(attendanceRecord.clock_in_time).toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                        </div>
                                    </div>
                                    <div className="w-px bg-slate-200 dark:bg-slate-700"></div>
                                    <div>
                                        <div className="text-xs text-slate-400 uppercase">End</div>
                                        <div className="font-mono font-bold text-slate-700 dark:text-slate-300">
                                            {attendanceRecord?.clock_out_time ? new Date(attendanceRecord.clock_out_time).toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                        </div>
                                    </div>
                                </div>
                                {attendanceRecord?.work_hours !== undefined && (
                                    <div className="text-center">
                                        <div className="inline-block text-3xl font-bold font-mono text-emerald-600">
                                            {Number(attendanceRecord.work_hours).toFixed(1)}
                                            <span className="text-sm font-sans ml-1 text-emerald-600/60">hr</span>
                                        </div>
                                        {(attendanceRecord as any).break_duration > 0 && (
                                            <div className="text-xs text-emerald-600/50 mt-1">
                                                (扣除午休 {(attendanceRecord as any).break_duration}h)
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={handleCancelClockOutClick}
                                disabled={isPending}
                                className="text-slate-400 hover:text-red-500 text-sm transition-colors decoration-slice hover:underline"
                            >
                                取消下班 / 重新計算
                            </button>
                        </div>
                    )}
                </div>

            </div>

            {/* Confirmation Modal */}
            <Dialog isOpen={showCancelConfirm} onClose={() => setShowCancelConfirm(false)} maxWidth="sm">
                <DialogHeader title="確認取消下班？" onClose={() => setShowCancelConfirm(false)} />
                <DialogContent>
                    <p className="text-slate-600 dark:text-slate-300">
                        這將清除您的下班時間並重新計算工時，您確定要繼續嗎？
                    </p>
                </DialogContent>
                <DialogFooter>
                    <button
                        onClick={() => setShowCancelConfirm(false)}
                        className="px-4 py-2 rounded-md text-slate-500 hover:text-slate-700 transition-colors"
                        disabled={isPending}
                    >
                        取消
                    </button>
                    <button
                        onClick={handleConfirmCancelClockOut}
                        disabled={isPending}
                        className="px-4 py-2 rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors shadow-sm disabled:opacity-50"
                    >
                        {isPending ? '處理中...' : '確定取消'}
                    </button>
                </DialogFooter>
            </Dialog>
        </>
    )
}
