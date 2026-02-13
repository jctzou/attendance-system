'use client'

import { useState, useEffect, useTransition } from 'react'
import { clockIn, clockOut, cancelClockOut } from '@/app/attendance/actions'
import { Database } from '@/types/supabase'
import { Dialog, DialogHeader, DialogContent, DialogFooter } from '@/components/ui/Dialog'
import { ATTENDANCE_STATUS_MAP } from '@/app/attendance/constants'

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

    // Local state for immediate feedback
    // Initialize with server data, but allow client updates
    const [attendanceRecord, setAttendanceRecord] = useState<AttendanceRow | null>(initialRecord)

    // Hourly: Pre-clock-in slot selection
    const [selectedTimeSlot, setSelectedTimeSlot] = useState<Date | null>(null)

    // Hourly: Post-clock-in break duration selection (1.0, 1.5, 2.0)
    // Default to 1.0 hr
    const [breakDuration, setBreakDuration] = useState<number>(1.0)

    // Validation (Optimistic UI state is integrated into attendanceRecord now)
    // We can still use optimisticClockIn for very fast "button click" feedback if needed, 
    // but updating attendanceRecord immediately upon return is cleaner.

    // Confirmation Modal State
    const [showCancelConfirm, setShowCancelConfirm] = useState(false)

    // Helper functions moved inside component body
    const getStatusStyle = (status: string | undefined | null) => {
        if (!status || status === 'normal') return 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
        if (status === 'late') return 'bg-orange-100 text-orange-600'
        return 'bg-red-100 text-red-600'
    }

    const getStatusLabel = (status: string | undefined | null) => {
        if (!status) return '正常'
        return ATTENDANCE_STATUS_MAP[status] || status
    }

    // Sync with initial record (server revalidation)
    useEffect(() => {
        if (initialRecord) {
            setAttendanceRecord(initialRecord)
        }

        // If user already clocked out, and is hourly, try to restore break duration if available
        if (initialRecord && salaryType === 'hourly' && (initialRecord as any).break_duration) {
            setBreakDuration((initialRecord as any).break_duration)
        }
    }, [initialRecord, salaryType])

    // 計算時間段（前後30分鐘）
    const calculateTimeSlots = (currentTime: Date) => {
        const minutes = currentTime.getMinutes()
        const hours = currentTime.getHours()

        // 前30分鐘時間段（向下取整）
        const prevMinutes = Math.floor(minutes / 30) * 30
        const prevSlot = new Date(currentTime)
        prevSlot.setMinutes(prevMinutes, 0, 0)

        // 後30分鐘時間段（向上取整）
        let nextMinutes = Math.ceil(minutes / 30) * 30
        const nextSlot = new Date(currentTime)
        if (nextMinutes === 60) {
            nextSlot.setHours(hours + 1, 0, 0, 0)
        } else {
            nextSlot.setMinutes(nextMinutes, 0, 0)
        }

        return { prevSlot, nextSlot }
    }

    useEffect(() => {
        setMounted(true)
        const now = new Date()
        setTime(now)

        // 鐘點人員：預設選擇前30分鐘時間段
        if (salaryType === 'hourly') {
            const { prevSlot } = calculateTimeSlots(now)
            setSelectedTimeSlot(prevSlot)
        }

        const timer = setInterval(() => {
            const currentTime = new Date()
            setTime(currentTime)

            // 鐘點人員：每秒更新時間段選項
            if (salaryType === 'hourly' && selectedTimeSlot) {
                const { prevSlot, nextSlot } = calculateTimeSlots(currentTime)
                // 確保選中的時間仍在可選範圍內
                const selectedTimeStr = selectedTimeSlot.toTimeString().slice(0, 5)
                const prevSlotStr = prevSlot.toTimeString().slice(0, 5)
                const nextSlotStr = nextSlot.toTimeString().slice(0, 5)

                if (selectedTimeStr !== prevSlotStr && selectedTimeStr !== nextSlotStr) {
                    setSelectedTimeSlot(prevSlot)
                }
            }
        }, 1000)

        return () => clearInterval(timer)
    }, [salaryType])

    const handleClockIn = async () => {
        setMessage('')

        startTransition(async () => {
            try {
                // 鐘點人員使用選中的時間，月薪人員使用當前時間
                const timeToUse = salaryType === 'hourly' && selectedTimeSlot ? selectedTimeSlot : undefined

                // Optimistic Update (Can be refined, but let's wait for server response for accuracy on status)
                // Or set a temp loading state? isPending handles loading UI.

                const res = await clockIn(userId, timeToUse)
                if (res.error) {
                    setMessage(`❌ ${res.error}`)
                } else if (res.data) {
                    setMessage('✅ 上班打卡成功')
                    setAttendanceRecord(res.data) // Immediate Update
                }
            } catch (e) {
                setMessage('❌ 發生錯誤')
            }
        })
    }

    const handleClockOut = async () => {
        setMessage('')
        startTransition(async () => {
            try {
                // 鐘點人員傳入選擇的午休時間
                // 鐘點人員也需要傳入選擇的下班時間 (selectedTimeSlot)
                const timeToUse = salaryType === 'hourly' && selectedTimeSlot ? selectedTimeSlot : undefined
                const res = await clockOut(userId, timeToUse, salaryType === 'hourly' ? breakDuration : undefined)
                if (res.error) {
                    setMessage(`❌ ${res.error}`)
                } else if (res.data) {
                    setMessage('✅ 下班打卡成功')
                    setAttendanceRecord(res.data) // Immediate Update
                }
            } catch (e) {
                setMessage('❌ 發生錯誤')
            }
        })
    }

    const handleCancelClockOutClick = () => {
        setShowCancelConfirm(true)
    }

    const handleConfirmCancelClockOut = async () => {
        setShowCancelConfirm(false)
        setMessage('')
        startTransition(async () => {
            try {
                const res = await cancelClockOut(userId)
                if (res.error) {
                    setMessage(`❌ ${res.error}`)
                } else if (res.data) {
                    setMessage('✅ 已取消下班打卡')
                    setAttendanceRecord(res.data) // Immediate Update
                }
            } catch (e) {
                setMessage('❌ 發生錯誤')
            }
        })
    }

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('zh-TW', { hour12: false })
    }

    const isClockedIn = !!attendanceRecord?.clock_in_time
    const isClockedOut = !!attendanceRecord?.clock_out_time

    return (
        <>
            <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.05)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-slate-200/60 dark:border-slate-700/50 p-10 text-center transform transition-all">
                <div className="space-y-2 mb-10">
                    <p className="text-slate-500 dark:text-slate-400 font-medium tracking-wide">
                        {mounted && time ? time.toLocaleDateString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric' }) : 'Loading...'}
                    </p>
                    <div className="font-mono text-6xl md:text-7xl font-bold text-slate-900 dark:text-white tabular-nums">
                        {mounted && time ? formatTime(time) : '00:00:00'}
                    </div>
                    {salaryType === 'monthly' && (
                        <div className="flex items-center justify-center space-x-2 text-sm text-slate-400 dark:text-slate-500">
                            <span className="text-base">🕒</span>
                            <span>規定上下班: {userSettings.work_start_time?.slice(0, 5)} - {userSettings.work_end_time?.slice(0, 5)}</span>
                        </div>
                    )}
                </div>

                <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent mb-10"></div>

                {/* 鐘點人員：上班前選時段 (上班打卡) OR 上班中選時段 (下班打卡) */}
                {salaryType === 'hourly' && !isClockedOut && time && (
                    <>
                        <div className="flex items-center justify-center gap-2 mb-6">
                            <span className="text-sm text-slate-500 dark:text-slate-400">
                                {isClockedIn ? '⏰ 選擇下班時間' : '⏰ 選擇上班時間'}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            {(() => {
                                const { prevSlot, nextSlot } = calculateTimeSlots(time)
                                const formatSlotTime = (date: Date) => {
                                    return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
                                }

                                return (
                                    <>
                                        <button
                                            onClick={() => setSelectedTimeSlot(prevSlot)}
                                            className={`py-6 rounded-2xl border-2 transition-all ${selectedTimeSlot && selectedTimeSlot.toTimeString().slice(0, 5) === prevSlot.toTimeString().slice(0, 5)
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                                : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600'
                                                }`}
                                        >
                                            <div className="text-3xl font-bold">
                                                {formatSlotTime(prevSlot)}
                                            </div>
                                            <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">PREVIOUS SLOT</div>
                                        </button>

                                        <button
                                            onClick={() => setSelectedTimeSlot(nextSlot)}
                                            className={`py-6 rounded-2xl border-2 transition-all ${selectedTimeSlot && selectedTimeSlot.toTimeString().slice(0, 5) === nextSlot.toTimeString().slice(0, 5)
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                                : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600'
                                                }`}
                                        >
                                            <div className="text-3xl font-bold">
                                                {formatSlotTime(nextSlot)}
                                            </div>
                                            <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">NEXT SLOT</div>
                                        </button>
                                    </>
                                )
                            })()}
                        </div>

                        <p className="text-xs text-slate-400 dark:text-slate-500 text-center mb-6">
                            * 提醒：時薪人員需依照實際排班時段進行打卡
                        </p>
                    </>
                )}

                {/* 鐘點人員：上班中選午休時間 */}
                {salaryType === 'hourly' && isClockedIn && !isClockedOut && (
                    <div className="mb-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-center gap-2 mb-4">
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">🍽️ 午休時數 (Break Time)</span>
                        </div>
                        <div className="flex justify-center gap-2">
                            {[1.0, 1.5, 2.0].map((duration) => (
                                <button
                                    key={duration}
                                    onClick={() => setBreakDuration(duration)}
                                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${breakDuration === duration
                                        ? 'bg-primary text-white shadow-md shadow-primary/30'
                                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-primary/50'
                                        }`}
                                >
                                    {duration} hr
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="mb-10 min-h-[100px]">
                    {isPending ? (
                        <div className="text-primary animate-pulse font-bold text-xl">處理中...</div>
                    ) : message ? (
                        <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{message}</div>
                    ) : isClockedIn ? (
                        <>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">上班時間</p>
                            <p className="text-3xl font-bold text-slate-800 dark:text-slate-100 font-mono mb-3">
                                {attendanceRecord?.clock_in_time ? new Date(attendanceRecord.clock_in_time).toLocaleTimeString('zh-TW', { hour12: false }) : '--:--:--'}
                            </p>
                            <span className={`inline-flex items-center px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusStyle(attendanceRecord?.status)}`}>
                                {getStatusLabel(attendanceRecord?.status)}
                            </span>
                        </>
                    ) : (
                        <div className="text-slate-400">尚未打卡</div>
                    )}
                </div>

                <div className="space-y-6">
                    {isClockedIn ? (
                        isClockedOut ? (
                            <div className="space-y-4">
                                <div className="text-green-600 font-bold text-lg border border-green-200 bg-green-50 rounded-xl py-4 flex flex-col items-center gap-1">
                                    <div className="flex items-center gap-3 text-base">
                                        <span className="text-slate-500 font-normal">上班: {attendanceRecord?.clock_in_time ? new Date(attendanceRecord.clock_in_time).toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}</span>
                                        <span className="text-slate-300">|</span>
                                        <span>下班: {attendanceRecord?.clock_out_time ? new Date(attendanceRecord.clock_out_time).toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}</span>
                                    </div>
                                    {salaryType === 'hourly' && (attendanceRecord as any).break_duration && (
                                        <span className="text-sm text-green-700/70 mt-1 font-medium bg-green-100/50 px-3 py-0.5 rounded-full">
                                            午休扣除: {(attendanceRecord as any).break_duration} hr
                                        </span>
                                    )}
                                    {attendanceRecord?.work_hours !== undefined && attendanceRecord?.work_hours !== null && (
                                        <div className="mt-2 text-2xl font-bold font-mono text-green-700">
                                            工時: {Number(attendanceRecord.work_hours).toFixed(1)} hr
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={handleCancelClockOutClick}
                                    disabled={isPending}
                                    className="w-full text-sm text-slate-500 hover:text-red-500 underline"
                                >
                                    取消下班打卡
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={handleClockOut}
                                disabled={isPending}
                                className="w-full group relative overflow-hidden bg-primary text-white text-lg font-bold py-5 px-8 rounded-2xl shadow-lg shadow-primary/30 hover:shadow-primary/40 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                下班打卡
                            </button>
                        )
                    ) : (
                        <button
                            onClick={handleClockIn}
                            disabled={isPending}
                            className="w-full group relative overflow-hidden bg-slate-800 text-white text-lg font-bold py-5 px-8 rounded-2xl shadow-lg shadow-slate-800/30 hover:shadow-slate-800/40 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            上班打卡
                        </button>
                    )}

                    {/* 狀態切換模擬 (視覺用，或可保留用作 Checkbox 功能) */}
                    {isClockedOut && (
                        <div className="flex items-center justify-center space-x-3">
                            <label className="relative flex items-center cursor-pointer select-none">
                                <div className="w-5 h-5 border-2 border-emerald-500 rounded bg-emerald-500 flex items-center justify-center">
                                    <span className="text-white text-[16px] font-bold">✓</span>
                                </div>
                                <span className="ml-2 text-slate-500 dark:text-slate-400 text-sm font-medium">今日已完工</span>
                            </label>
                        </div>
                    )}
                </div>
            </div>

            {/* Confirmation Modal for Cancel Clock Out */}
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
                        className="px-4 py-2 rounded-md text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
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
