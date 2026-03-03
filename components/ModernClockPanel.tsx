'use client'

import { useState, useEffect, useTransition } from 'react'
import { clockIn, clockOut, cancelClockOut } from '@/app/attendance/actions'
import { getDailyFortune } from '@/app/attendance/fortune'
import { Database } from '@/types/supabase'
import { Dialog, DialogHeader, DialogContent, DialogFooter } from '@/components/ui/Dialog'
import { ATTENDANCE_STATUS_MAP } from '@/app/attendance/constants'
import { features } from '@/utils/features'
import { getTaipeiDateString } from '@/utils/timezone'

// --- Types ---
type AttendanceRow = Database['public']['Tables']['attendance']['Row']

interface Props {
    userId: string
    userName: string | null
    salaryType: 'monthly' | 'hourly'
    userSettings: {
        work_start_time: string
        work_end_time: string
        break_hours: number | null
    }
    todayRecord: AttendanceRow | null
}

const STATUS_CONFIG = {
    normal: { label: '正常', color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' },
    late: { label: '遲到', color: 'bg-orange-100 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400' },
    early_leave: { label: '早退', color: 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400' },
    absent: { label: '缺席', color: 'bg-slate-100 text-slate-600 dark:bg-neutral-700 dark:text-neutral-400' },
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

    // 上班狀態控制
    const isClockedIn = !!attendanceRecord?.clock_in_time
    const isClockedOut = !!attendanceRecord?.clock_out_time

    // --- Hourly Related State ---
    const [breakDuration, setBreakDuration] = useState<number>(1.0)

    // AI Fortune State
    const [fortune, setFortune] = useState<string>('')
    const [fortuneLoading, setFortuneLoading] = useState(false)

    // Confirmation Modal State
    const [showCancelConfirm, setShowCancelConfirm] = useState(false)

    // Sync with initial record & Initialize Scheduled Clock Out
    useEffect(() => {
        if (initialRecord) {
            setAttendanceRecord(initialRecord)
            if (salaryType === 'hourly' && initialRecord.break_duration !== undefined) {
                setBreakDuration(initialRecord.break_duration ?? 1.0)
            }
        }
    }, [initialRecord, salaryType])

    useEffect(() => {
        if (salaryType === 'monthly') {
            // 月薪制初始化午休時數
            const defaultBreak = userSettings.break_hours ?? 1.0
            setBreakDuration(defaultBreak)
        }
    }, [salaryType, userSettings.break_hours])

    // Timer Logic
    useEffect(() => {
        setMounted(true)
        const updateTime = () => setTime(new Date())
        updateTime()
        const timer = setInterval(updateTime, 1000)
        return () => clearInterval(timer)
    }, [])

    // AI Fortune Logic (Cache for same day, supports manual refresh)
    const fetchFortune = async (force: boolean = false) => {
        if (!mounted || fortuneLoading) return

        const todayStr = getTaipeiDateString()
        const cacheKey = 'niizo_daily_fortune'

        if (!force) {
            const cached = localStorage.getItem(cacheKey)
            if (cached) {
                try {
                    const parsed = JSON.parse(cached)
                    if (parsed.date === todayStr && parsed.content) {
                        setFortune(parsed.content)
                        return
                    }
                } catch (e) {
                    console.error('Failed to parse fortune cache', e)
                }
            }
        }

        // Fetch from API
        setFortuneLoading(true)
        try {
            const result = await getDailyFortune(userName)
            if (result) {
                setFortune(result)
                localStorage.setItem(cacheKey, JSON.stringify({
                    date: todayStr,
                    content: result
                }))
            }
        } catch (e) {
            setFortune('今天也是充滿希望的一天！')
        } finally {
            setFortuneLoading(false)
        }
    }

    useEffect(() => {
        if (isClockedIn && !isClockedOut && mounted && !fortune) {
            fetchFortune()
        }
    }, [isClockedIn, isClockedOut, mounted, fortune])

    // --- Actions ---

    const handleClockIn = async () => {
        setMessage('')
        setMessageType('success')
        startTransition(async () => {
            try {
                const res = await clockIn(userId)
                if (!res.success) {
                    setMessageType('error')
                    setMessage(res.error?.code === 'DUPLICATE_ENTRY' ? '⚠️ 今日已完成上班打卡' : `❌ ${res.error?.message}`)
                } else {
                    setAttendanceRecord(res.data)
                    // 鐘點制不再顯示提示，直接進入上班中狀態
                    if (salaryType !== 'hourly') setMessage('✅ 上班打卡成功')
                }
            } catch (e) {
                setMessageType('error')
                setMessage('❌ 發生未知錯誤')
            }
        })
    }

    const handleClockOut = async () => {
        setMessage('')
        setMessageType('success')
        startTransition(async () => {
            try {
                // 統一使用當前伺服器時間 (即 server 端 new Date())
                const res = await clockOut(userId, undefined, salaryType === 'hourly' ? breakDuration : undefined)

                if (!res.success) {
                    setMessageType('error')
                    setMessage(`❌ ${res.error?.message}`)
                } else {
                    setAttendanceRecord(res.data)
                    // 鐘點制不顯示提示，直接進入已下班狀態
                    if (salaryType !== 'hourly') setMessage('✅ 下班打卡成功')
                }
            } catch (e) {
                setMessageType('error')
                setMessage('❌ 發生錯誤')
            }
        })
    }

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
                    setAttendanceRecord(res.data)
                    // 直接回復狀態，不顯示提示
                }
            } catch (e) {
                setMessageType('error')
                setMessage('❌ 發生錯誤')
            }
        })
    }

    // --- UI Helpers ---

    const formatTime = (date: Date) => date.toLocaleTimeString('zh-TW', { hour12: false })
    const formatHHmm = (date: Date) => date.toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit' })
    const getStatusInfo = (status: string | undefined | null) => {
        if (!status) return STATUS_CONFIG.normal
        return (STATUS_CONFIG as any)[status] || STATUS_CONFIG.normal
    }

    const formatWorkTime = (minutes: number | null | undefined) => {
        if (minutes === null || minutes === undefined) return '-'
        const h = Math.floor(minutes / 60)
        const m = Math.round(minutes % 60)
        return `${h}小時${m}分`
    }

    const statusInfo = getStatusInfo(attendanceRecord?.status)

    return (
        <>
            <div className="w-full max-w-lg bg-[var(--color-card-light)] bg-white dark:bg-neutral-900 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-200 dark:border-neutral-700 p-6 md:p-7 text-center transition-all duration-300">
                {/* Header Info */}
                <div className="space-y-0.5 mb-4">
                    <p className="text-slate-500 dark:text-neutral-400 font-medium tracking-wide text-sm">
                        {mounted && time ? time.toLocaleDateString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric' }) : 'Loading...'}
                    </p>
                    <div className="font-mono text-[34px] md:text-[42px] font-bold text-slate-900 dark:text-white tabular-nums tracking-tight leading-tight">
                        {mounted && time ? formatTime(time) : '00:00:00'}
                    </div>
                    {salaryType === 'monthly' && (
                        <div className="flex items-center justify-center space-x-2 text-[13px] text-slate-400 dark:text-neutral-500">
                            <span>表定工時: {userSettings.work_start_time?.slice(0, 5)} - {userSettings.work_end_time?.slice(0, 5)}</span>
                        </div>
                    )}
                </div>

                {/* Divider */}
                <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent mb-6"></div>

                {/* Result / Action Area */}
                <div className="space-y-6">
                    {isPending ? (
                        <div className="py-10 flex flex-col items-center justify-center">
                            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mb-3"></div>
                            <div className="text-primary font-bold text-xl">處理中...</div>
                        </div>
                    ) : (
                        <>
                            {/* Message Display (Only for error or non-hourly success hint) */}
                            {message && (
                                <div className={`mb-4 text-center font-bold ${messageType === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>
                                    {message}
                                </div>
                            )}

                            {!isClockedIn ? (
                                // --- STATUS: NOT CLOCKED IN ---
                                <div className="space-y-6">
                                    <div className="text-[18px] text-slate-400 py-1 font-bold uppercase tracking-widest">
                                        尚未打卡
                                    </div>

                                    <button
                                        onClick={handleClockIn}
                                        disabled={isPending}
                                        className="w-full group relative overflow-hidden bg-slate-800 text-white text-lg font-bold py-3.5 px-8 rounded-2xl shadow-xl shadow-slate-800/20 hover:shadow-slate-800/30 active:scale-[0.98] transition-all disabled:opacity-70"
                                    >
                                        上班打卡
                                    </button>
                                </div>
                            ) : !isClockedOut ? (
                                // --- STATUS: WORKING (CLOCKED IN) ---
                                <div className="space-y-6 animate-in fade-in zoom-in duration-300">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-50 dark:bg-neutral-800 p-4 rounded-2xl border border-slate-100 dark:border-neutral-700">
                                            <div className="text-[14px] text-slate-400 uppercase mb-1">今日上班時間</div>
                                            <div className="font-mono font-bold text-[26px] text-slate-700 dark:text-neutral-200">
                                                {formatHHmm(new Date(attendanceRecord.clock_in_time!))}
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-neutral-800 p-4 rounded-2xl border border-slate-100 dark:border-neutral-700">
                                            <div className="text-[14px] text-slate-400 uppercase mb-1">狀態</div>
                                            <div className="py-1 text-center flex justify-center">
                                                <span className={`inline-flex px-3 py-0.5 rounded-full text-[13px] font-bold uppercase ${statusInfo.color}`}>
                                                    {statusInfo.label}
                                                </span>
                                            </div>
                                        </div>
                                    </div>


                                    {salaryType === 'hourly' && (
                                        <div className="bg-slate-50 dark:bg-neutral-800 p-4 rounded-2xl border border-slate-100 dark:border-neutral-700">
                                            <div className="text-[14px] text-slate-400 uppercase mb-3">午休時數</div>
                                            <div className="flex justify-center gap-2">
                                                {[0, 1.0, 1.5].map(d => (
                                                    <button
                                                        key={d}
                                                        onClick={() => setBreakDuration(d)}
                                                        className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all ${breakDuration === d
                                                            ? 'bg-primary text-white shadow-lg shadow-primary/30'
                                                            : 'bg-white dark:bg-neutral-700 text-slate-600 dark:text-neutral-300 border border-slate-200 dark:border-neutral-600'
                                                            }`}
                                                    >
                                                        {d} hr
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* AI Fortune Card */}
                                    <div
                                        onClick={() => fetchFortune(true)}
                                        className="relative group mx-auto max-w-[95%] transform transition-all hover:scale-[1.02] cursor-pointer active:scale-[0.98]"
                                        title="點擊刷新今日運勢"
                                    >
                                        <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500/20 to-amber-500/20 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                                        <div className="relative bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm border border-slate-100 dark:border-neutral-800 p-4 rounded-2xl shadow-sm group-hover:bg-white dark:group-hover:bg-neutral-800 transition-colors">
                                            {fortuneLoading ? (
                                                <div className="flex flex-col items-center gap-2 py-2">
                                                    <div className="w-5 h-5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
                                                    <div className="text-[13px] text-slate-400 animate-pulse">正在為你捕捉今日好運...</div>
                                                </div>
                                            ) : (
                                                <div className="flex items-start gap-3">
                                                    <span className="text-xl shrink-0 group-hover:animate-pulse">✨</span>
                                                    <p className="text-[14px] text-slate-600 dark:text-neutral-300 leading-relaxed text-left flex-1 italic font-medium">
                                                        {fortune || '準備好迎接充滿活力的一天了嗎？'}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleClockOut}
                                        disabled={isPending}
                                        className="w-full group relative overflow-hidden bg-[var(--color-primary)] text-white text-lg font-bold py-3.5 px-8 rounded-2xl shadow-xl shadow-orange-500/20 hover:shadow-orange-500/30 active:scale-[0.98] transition-all"
                                    >
                                        下班打卡
                                    </button>
                                </div>
                            ) : (
                                // --- STATUS: CLOCKED OUT ---
                                <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                                    <div className="p-6 bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800 rounded-2xl">
                                        <div className="flex justify-center gap-8 mb-4">
                                            <div>
                                                <div className="text-[14px] text-slate-400 uppercase mb-1 font-bold">上班</div>
                                                <div className="font-mono font-bold text-[26px] text-slate-700 dark:text-neutral-300">
                                                    {formatHHmm(new Date(attendanceRecord.clock_in_time!))}
                                                </div>
                                            </div>
                                            <div className="w-px bg-slate-200 dark:bg-neutral-700"></div>
                                            <div>
                                                <div className="text-[14px] text-slate-400 uppercase mb-1 font-bold">下班</div>
                                                <div className="font-mono font-bold text-[26px] text-slate-700 dark:text-neutral-300">
                                                    {formatHHmm(new Date(attendanceRecord.clock_out_time!))}
                                                </div>
                                            </div>
                                        </div>

                                        {attendanceRecord.work_hours !== undefined && attendanceRecord.work_hours !== null && (
                                            <div className="text-center pt-2 border-t border-emerald-100/50 dark:border-emerald-800/30">
                                                <div className="text-[14px] text-slate-400 uppercase mb-1 font-bold">實收工時</div>
                                                <div className="inline-block text-3xl font-bold font-mono text-emerald-600">
                                                    {formatWorkTime(Number(attendanceRecord.work_hours))}
                                                </div>
                                                {attendanceRecord.break_duration !== undefined && attendanceRecord.break_duration !== null && Number(attendanceRecord.break_duration) > 0 && (
                                                    <div className="text-[14px] text-emerald-600/50 mt-1">
                                                        (已扣午休 {formatWorkTime(Number(attendanceRecord.break_duration))})
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => setShowCancelConfirm(true)}
                                        disabled={isPending}
                                        className="text-slate-400 hover:text-red-500 text-[14px] transition-colors hover:underline"
                                    >
                                        取消下班
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>


            {/* Confirmation Modal */}
            <Dialog isOpen={showCancelConfirm} onClose={() => setShowCancelConfirm(false)} maxWidth="sm">
                <DialogHeader title="確認取消下班？" onClose={() => setShowCancelConfirm(false)} />
                <DialogContent>
                    <p className="text-slate-600 dark:text-neutral-300">
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
