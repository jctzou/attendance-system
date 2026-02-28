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
    const [scheduledClockOut, setScheduledClockOut] = useState<Date | null>(null)
    const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false)

    // Confirmation Modal State
    const [showCancelConfirm, setShowCancelConfirm] = useState(false)

    // Sync with initial record & Initialize Scheduled Clock Out
    useEffect(() => {
        if (initialRecord) {
            setAttendanceRecord(initialRecord)
            if (salaryType === 'hourly' && (initialRecord as any).break_duration !== undefined) {
                setBreakDuration((initialRecord as any).break_duration ?? 1.0)
            }
        }
    }, [initialRecord, salaryType])

    // 修正初始化邏輯：若已有下班紀錄（例如頁面重新整理），優先恢復該時間，否則使用預設表定時間
    useEffect(() => {
        if (salaryType === 'hourly') {
            if (attendanceRecord?.clock_out_time) {
                setScheduledClockOut(new Date(attendanceRecord.clock_out_time))
            } else if (userSettings.work_end_time) {
                const [h, m] = userSettings.work_end_time.split(':').map(Number)
                const d = new Date()
                d.setHours(h, m, 0, 0)
                setScheduledClockOut(d)
            }
        }
    }, [salaryType, userSettings.work_end_time, !!attendanceRecord?.clock_out_time])

    // Timer Logic
    useEffect(() => {
        setMounted(true)
        const updateTime = () => setTime(new Date())
        updateTime()
        const timer = setInterval(updateTime, 1000)
        return () => clearInterval(timer)
    }, [])

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
                // 鐘點制：使用表定或調整後的下班時間；月薪：使用 undefined (即 server 端 new Date())
                const timeToUse = salaryType === 'hourly' ? scheduledClockOut || undefined : undefined
                const res = await clockOut(userId, timeToUse, salaryType === 'hourly' ? breakDuration : undefined)

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
    const statusInfo = getStatusInfo(attendanceRecord?.status)

    // 生成調整時間選單：30 分鐘為單位
    const generateTimeOptions = () => {
        const options = []
        for (let h = 0; h < 24; h++) {
            for (let m = 0; m < 60; m += 30) {
                const d = new Date()
                d.setHours(h, m, 0, 0)
                options.push(d)
            }
        }
        return options
    }

    const timeOptions = generateTimeOptions()
    const clockInTimeObj = attendanceRecord?.clock_in_time ? new Date(attendanceRecord.clock_in_time) : null

    // 規格化表定時間為 HH:mm (確保比對基準一致，不論原始格式是 18:00 或 18:00:00)
    const normalizedSettingEndStr = userSettings.work_end_time?.slice(0, 5)

    // 檢查是否與表定時間不同 (HH:mm 格式比遞)
    const currentClockOutStr = scheduledClockOut ? formatHHmm(scheduledClockOut) : null
    const isActuallyAdjusted = salaryType === 'hourly' && currentClockOutStr && currentClockOutStr !== normalizedSettingEndStr

    // 已下班狀態的調整檢查
    const clockOutTimeObj = attendanceRecord?.clock_out_time ? new Date(attendanceRecord.clock_out_time) : null
    const isClockedOutAdjusted = salaryType === 'hourly' && clockOutTimeObj && formatHHmm(clockOutTimeObj) !== normalizedSettingEndStr

    return (
        <>
            <div className="w-full max-w-lg bg-[var(--color-card-light)] bg-white dark:bg-neutral-900 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-200 dark:border-neutral-700 p-6 md:p-7 text-center transition-all duration-300">
                {/* Header Info */}
                <div className="space-y-2 mb-6">
                    <p className="text-slate-500 dark:text-neutral-400 font-medium tracking-wide">
                        {mounted && time ? time.toLocaleDateString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric' }) : 'Loading...'}
                    </p>
                    <div className="font-mono text-5xl md:text-6xl font-bold text-slate-900 dark:text-white tabular-nums tracking-tight">
                        {mounted && time ? formatTime(time) : '00:00:00'}
                    </div>
                    {salaryType === 'monthly' && (
                        <div className="flex items-center justify-center space-x-2 text-sm text-slate-400 dark:text-neutral-500">
                            <span>規定工時: {userSettings.work_start_time?.slice(0, 5)} - {userSettings.work_end_time?.slice(0, 5)}</span>
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
                                    <div className="text-slate-400 py-4">尚未打卡</div>
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
                                            <div className="text-[10px] text-slate-400 uppercase mb-1">今日上班時間</div>
                                            <div className="font-mono font-bold text-xl text-slate-700 dark:text-neutral-200">
                                                {formatHHmm(new Date(attendanceRecord.clock_in_time!))}
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-neutral-800 p-4 rounded-2xl border border-slate-100 dark:border-neutral-700">
                                            {salaryType === 'hourly' ? (
                                                <>
                                                    <div className="text-[10px] text-slate-400 uppercase mb-1">
                                                        {isActuallyAdjusted ? (
                                                            <span>下班時間 <span className="text-orange-500 font-bold ml-1">(已調整)</span></span>
                                                        ) : (
                                                            '表定下班時間'
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col items-center">
                                                        <div className="font-mono font-bold text-xl text-slate-700 dark:text-neutral-200">
                                                            {scheduledClockOut ? formatHHmm(scheduledClockOut) : '--:--'}
                                                        </div>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setIsAdjustDialogOpen(true) }}
                                                            className="text-[10px] text-primary hover:underline mt-1"
                                                        >
                                                            調整時間
                                                        </button>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="text-[10px] text-slate-400 uppercase mb-1">狀態</div>
                                                    <div className="py-1">
                                                        <span className={`inline-flex px-3 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusInfo.color}`}>
                                                            {statusInfo.label}
                                                        </span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {salaryType === 'hourly' && (
                                        <p className="text-[11px] text-slate-400 -mt-2">
                                            若有特殊狀況，可點「調整」修改下班時間。
                                        </p>
                                    )}

                                    {salaryType === 'hourly' && (
                                        <div className="bg-slate-50 dark:bg-neutral-800 p-4 rounded-2xl border border-slate-100 dark:border-neutral-700">
                                            <div className="text-[10px] text-slate-400 uppercase mb-3">午休時數</div>
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
                                                <div className="text-[10px] text-slate-400 uppercase mb-1">上班</div>
                                                <div className="font-mono font-bold text-lg text-slate-700 dark:text-neutral-300">
                                                    {formatHHmm(new Date(attendanceRecord.clock_in_time!))}
                                                </div>
                                            </div>
                                            <div className="w-px bg-slate-200 dark:bg-neutral-700"></div>
                                            <div>
                                                <div className="text-[10px] text-slate-400 uppercase mb-1">
                                                    {isClockedOutAdjusted ? (
                                                        <span>下班 <span className="text-orange-500 font-bold ml-0.5">(已調整)</span></span>
                                                    ) : '下班'}
                                                </div>
                                                <div className="font-mono font-bold text-lg text-slate-700 dark:text-neutral-300">
                                                    {formatHHmm(new Date(attendanceRecord.clock_out_time!))}
                                                </div>
                                            </div>
                                        </div>

                                        {attendanceRecord.work_hours !== undefined && (
                                            <div className="text-center pt-2 border-t border-emerald-100/50 dark:border-emerald-800/30">
                                                <div className="text-[10px] text-slate-400 uppercase mb-1">實收工時</div>
                                                <div className="inline-block text-4xl font-bold font-mono text-emerald-600">
                                                    {Number(attendanceRecord.work_hours).toFixed(1)}
                                                    <span className="text-sm font-sans ml-1 text-emerald-600/60">hr</span>
                                                </div>
                                                {(attendanceRecord as any).break_duration !== undefined && Number((attendanceRecord as any).break_duration) > 0 && (
                                                    <div className="text-[10px] text-emerald-600/50 mt-1">
                                                        (已扣午休 {(attendanceRecord as any).break_duration}h)
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => setShowCancelConfirm(true)}
                                        disabled={isPending}
                                        className="text-slate-400 hover:text-red-500 text-xs transition-colors hover:underline"
                                    >
                                        取消下班
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Time Adjustment Dialog (Hourly only) */}
            <Dialog isOpen={isAdjustDialogOpen} onClose={() => setIsAdjustDialogOpen(false)} maxWidth="sm">
                <DialogHeader title="調整下班時間" onClose={() => setIsAdjustDialogOpen(false)} />
                <DialogContent>
                    <div className="grid grid-cols-4 gap-2">
                        {timeOptions
                            .filter(opt => clockInTimeObj ? opt > clockInTimeObj : true)
                            .map((opt, i) => {
                                const isSelected = scheduledClockOut && formatHHmm(opt) === formatHHmm(scheduledClockOut)
                                return (
                                    <button
                                        key={i}
                                        onClick={() => {
                                            setScheduledClockOut(opt)
                                            setIsAdjustDialogOpen(false)
                                        }}
                                        className={`py-2 text-sm font-mono rounded-lg border transition-all ${isSelected
                                            ? 'bg-primary text-white border-primary shadow-sm'
                                            : 'border-slate-200 hover:border-primary text-slate-600'
                                            }`}
                                    >
                                        {formatHHmm(opt)}
                                    </button>
                                )
                            })}
                    </div>
                </DialogContent>
                <DialogFooter>
                    <button onClick={() => setIsAdjustDialogOpen(false)} className="px-4 py-2 text-slate-500">取消</button>
                </DialogFooter>
            </Dialog>

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
