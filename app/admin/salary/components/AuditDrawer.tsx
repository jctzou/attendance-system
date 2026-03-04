import React, { useEffect, useState, useMemo } from 'react'
import { type SalaryRecordData } from '../actions'
import { getEmployeeAttendanceRecords, getEmployeeLeaveRecords } from '@/app/attendance/actions'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { getLeaveTypeName, getLeaveDeductionWeight } from '@/utils/leave-policies'

function timeStrToMinutes(timeStr: string): number {
    if (!timeStr) return 0;
    const [h, m, s] = timeStr.split(':').map(Number);
    return Math.round((h || 0) * 60 + (m || 0) + ((s || 0) / 60));
}

interface Props {
    isOpen: boolean
    record: SalaryRecordData | null
    onClose: () => void
    onEditBonus: (record: SalaryRecordData) => void
    onSettle: (userId: string) => void
    onResettle: (userId: string) => void
    isProcessing: boolean
}

export const AuditDrawer: React.FC<Props> = ({ isOpen, record, onClose, onEditBonus, onSettle, onResettle, isProcessing }) => {
    const [attendance, setAttendance] = useState<any[]>([])
    const [leaves, setLeaves] = useState<any[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const fetchData = async () => {
            if (!isOpen || !record) return
            setLoading(true)
            try {
                const [attRes, leaveRes] = await Promise.all([
                    getEmployeeAttendanceRecords(record.userId, record.yearMonth),
                    getEmployeeLeaveRecords(record.userId, record.yearMonth)
                ])
                if (attRes.success && attRes.data) setAttendance(attRes.data)
                if (leaveRes.success && leaveRes.data) setLeaves(leaveRes.data)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [isOpen, record])

    // O(1) Dictionaries for rendering
    const attendanceMap = useMemo(() => {
        const map: Record<string, any> = {}
        attendance.forEach(a => { if (a.work_date) map[a.work_date] = a })
        return map
    }, [attendance])

    const leaveMap = useMemo(() => {
        const map: Record<string, any> = {}
        leaves.forEach(l => {
            const leaveDate = new Date(l.start_date).toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
            const leaveEndDate = new Date(l.end_date).toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
            if (leaveDate !== leaveEndDate) {
                const start = new Date(leaveDate)
                const end = new Date(leaveEndDate)
                for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                    map[d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })] = l
                }
            } else {
                map[leaveDate] = l
            }
        })
        return map
    }, [leaves])

    if (!record) return null

    const isSettled = record.status === 'SETTLED'
    const isHourly = record.type === 'hourly'

    const formatMoney = (val: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(val).replace('USD', '$')
    }

    const formatHM = (hours: number | undefined) => {
        if (hours === undefined) return '-'
        const totalMinutes = Math.round(hours * 60)
        const h = Math.floor(totalMinutes / 60)
        const m = totalMinutes % 60
        if (h > 0 && m === 0) return `${h}小時`
        if (h > 0 && m > 0) return `${h}小時${m}分`
        return `${m}分`
    }

    const formatTime = (isoString: string) => {
        if (!isoString) return ''
        return new Date(isoString).toLocaleTimeString('zh-TW', { hour: 'numeric', minute: '2-digit', hour12: false })
    }

    const renderLedger = () => {
        if (loading) return <LoadingSpinner message="載入明細紀錄中..." />

        const [year, month] = record.yearMonth.split('-')
        const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate()
        const rows = []

        const weekMap = ['日', '一', '二', '三', '四', '五', '六']

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${month}-${String(day).padStart(2, '0')}`
            const dateObj = new Date(dateStr)
            const dayOfWeek = dateObj.getDay()
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

            const att = attendanceMap[dateStr]
            const leave = leaveMap[dateStr]

            // Skipping days without any records if we want to show everything, we show everything.
            // But showing 31 days might be long, let's keep it compact.
            let statusMarkup = null
            let timeMarkup = null
            let diffMarkup = null
            let isAbnormal = false

            if (att) {
                // 有打卡
                const clockIn = formatTime(att.clock_in_time)
                const clockOut = formatTime(att.clock_out_time)
                timeMarkup = clockIn && clockOut ? `${clockIn} ~ ${clockOut}` : (clockIn ? `${clockIn} ~ ?` : '?')
                // 計算總停留時間 (Gross Time)
                let grossMins = 0
                if (clockIn && clockOut) {
                    const inDate = new Date(att.clock_in_time)
                    const outDate = new Date(att.clock_out_time)
                    inDate.setSeconds(0, 0)
                    outDate.setSeconds(0, 0)
                    grossMins = Math.round((outDate.getTime() - inDate.getTime()) / 60000)
                }

                // 月薪制：看 Gross Time (不扣午休)。時薪制：看 Net Time (扣除午休)
                const displayMins = isHourly ? (Number(att.work_minutes) || 0) : grossMins
                const displayHrs = displayMins / 60

                statusMarkup = (
                    <div className="flex flex-col items-end">
                        <span className="font-mono">{formatHM(displayHrs)}</span>
                        {isHourly && att.break_duration > 0 && (
                            <span className="text-[10px] text-slate-400">已扣休 {formatHM(att.break_duration / 60)}</span>
                        )}
                    </div>
                )

                if (att.status && att.status !== 'normal') {
                    isAbnormal = true
                    diffMarkup = <span className="text-red-500 font-medium text-xs bg-red-50 dark:bg-red-900/20 px-1 py-0.5 rounded border border-red-200 dark:border-red-900/50">打卡異常</span>
                } else {
                    // 遵循與下班打卡(ModernClockPanel) 完全一致的判斷規則
                    const schedStart = record.workStartTime || '09:00:00'
                    const schedEnd = record.workEndTime || '18:00:00'

                    const scheduledGross = timeStrToMinutes(schedEnd) - timeStrToMinutes(schedStart)
                    const scheduledNet = scheduledGross - (Number(att.break_duration) || 0)

                    if (clockIn && clockOut) {
                        // 月薪看 Gross vs scheduledGross，時薪看 Net vs scheduledNet
                        const expectedMins = isHourly ? scheduledNet : scheduledGross
                        const diffMinutes = displayMins - expectedMins

                        // 誤差超過 11 分鐘才顯示 (與 ModernClockPanel 相同)
                        if (diffMinutes <= -11) {
                            isAbnormal = true
                            diffMarkup = <span className="text-red-500 text-xs font-mono">不足 {formatHM(Math.abs(diffMinutes) / 60)}</span>
                        } else if (diffMinutes >= 11) {
                            diffMarkup = <span className="text-emerald-600 text-xs font-mono">超時 {formatHM(diffMinutes / 60)}</span>
                        }
                    }
                }
            } else if (leave) {
                // 全天請假
                const leaveName = getLeaveTypeName(leave.leave_type)
                const weight = getLeaveDeductionWeight(leave.leave_type)
                const deductionText = weight === 1.0 ? '扣全薪' : weight === 0.5 ? '扣半薪' : '不扣薪'

                statusMarkup = (
                    <div className="flex flex-col items-end">
                        <span className="text-amber-600 text-sm">{leaveName} ({leave.days}天)</span>
                        <span className="text-[10px] text-amber-600/70">{deductionText}</span>
                    </div>
                )
                timeMarkup = <span className="text-slate-400 text-xs">無需打卡</span>
            } else {
                // 無記錄
                if (!isWeekend && new Date() >= dateObj) {
                    isAbnormal = true
                    statusMarkup = <span className="text-red-500 text-xs font-bold">缺勤</span>
                } else {
                    statusMarkup = <span className="text-slate-400 text-xs">{isWeekend ? '例假日' : '-'}</span>
                }
            }

            rows.push(
                <div key={dateStr} className={`flex items-center justify-between p-3 border-b border-slate-100 dark:border-neutral-800/80 hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors ${isAbnormal ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`}>
                    <div className="flex items-center gap-3 w-[60px] sm:w-[80px] shrink-0">
                        <div className="flex flex-col">
                            <span className={`font-mono font-medium ${isWeekend ? 'text-red-400' : 'text-slate-700 dark:text-neutral-300'}`}>{String(day).padStart(2, '0')}</span>
                            <span className={`text-[10px] ${isWeekend ? 'text-red-400/80' : 'text-slate-400'}`}> 週{weekMap[dayOfWeek]}</span>
                        </div>
                    </div>

                    <div className="flex-1 min-w-[90px] sm:min-w-[120px]">
                        <div className="text-sm text-slate-700 dark:text-neutral-200 font-mono">
                            {timeMarkup}
                        </div>
                    </div>

                    <div className="flex-1 min-w-[60px] sm:min-w-[80px] text-right flex flex-col justify-center">
                        {statusMarkup}
                    </div>

                    <div className="w-[90px] sm:w-[110px] shrink-0 text-right flex flex-col justify-center items-end whitespace-nowrap pl-2">
                        {diffMarkup}
                    </div>
                </div>
            )
        }

        return <div className="border border-slate-200 dark:border-neutral-700 rounded-lg overflow-hidden bg-white dark:bg-neutral-900">{rows}</div>
    }

    return (
        <div className={`fixed inset-0 z-50 flex justify-end ${!isOpen ? 'pointer-events-none' : ''}`}>
            <div
                className={`absolute inset-0 bg-slate-900/30 backdrop-blur-[2px] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
                onClick={onClose}
            />

            <div className={`relative w-full md:w-[600px] h-full bg-slate-50 dark:bg-neutral-950 shadow-2xl flex flex-col transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>

                {/* Header */}
                <div className="px-6 py-4 bg-white dark:bg-neutral-900 border-b border-slate-200 dark:border-neutral-800 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center">
                            {record.avatarUrl ? <img src={record.avatarUrl} alt="" className="w-full h-full object-cover" /> : <span className="font-bold">{(record.displayName || '?')[0]}</span>}
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 dark:text-neutral-100">{record.displayName}</h2>
                            <p className="text-xs text-slate-500">{record.yearMonth.replace('-', '年')}月考勤盤查</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-full transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto w-full p-4 md:p-6 space-y-6">

                    {/* Section 1: Financial Computation Breakdown */}
                    <div className="bg-white dark:bg-neutral-900 rounded-xl p-5 border border-slate-200 dark:border-neutral-800 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-neutral-200 mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-emerald-500">account_balance_wallet</span>
                            薪資公式拆解
                        </h3>

                        <div className="flex flex-col gap-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">基本計算 ({isHourly ? `${formatMoney(record.rate)} x ${formatHM(record.workHours)}` : '月薪'})</span>
                                <span className="font-mono">{formatMoney(record.baseSalary)}</span>
                            </div>

                            {(record.bonus > 0 || !isSettled) && (
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500 flex items-center gap-1">
                                        獎金/補貼
                                        {record.notes && <span className="bg-slate-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-[10px] truncate max-w-[150px]">{record.notes}</span>}
                                    </span>
                                    <span className="font-mono text-amber-500 font-medium">+{formatMoney(record.bonus)}</span>
                                </div>
                            )}

                            {record.deduction > 0 && (
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500">假勤扣除 (無薪假)</span>
                                        <span className="font-mono text-red-500 font-medium">-{formatMoney(record.deduction)}</span>
                                    </div>
                                    {/* 展開假別扣除明細 */}
                                    {!isHourly && record.leaveDetails && Object.keys(record.leaveDetails).length > 0 && (
                                        <div className="pl-3 py-1.5 border-l-2 border-slate-100 dark:border-neutral-800 space-y-1">
                                            {Object.entries(record.leaveDetails).map(([leaveType, count]) => {
                                                const leaveName = getLeaveTypeName(leaveType)
                                                const weight = getLeaveDeductionWeight(leaveType)
                                                if (weight === 0) return null
                                                const dailyWage = record.rate / 30
                                                const deductionM = count * weight * dailyWage
                                                return (
                                                    <div key={leaveType} className="flex justify-between items-center text-xs text-slate-400">
                                                        <span>↳ {leaveName} {count}天 × {weight}係數</span>
                                                        <span className="font-mono text-red-400">-{formatMoney(Math.ceil(deductionM))}</span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="border-t border-slate-100 dark:border-neutral-800 pt-3 mt-1 flex justify-between items-center">
                                <span className="font-bold text-slate-700 dark:text-neutral-300">實領總額</span>
                                <span className="font-mono text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                                    {formatMoney(Math.ceil(record.totalSalary))}
                                </span>
                            </div>
                        </div>

                        {/* Manager Actions - Bonus */}
                        {!isSettled && (
                            <div className="mt-5">
                                <Button
                                    variant="outline"
                                    className="w-full text-amber-600 border-amber-200 hover:bg-amber-50 dark:border-amber-900 dark:hover:bg-amber-900/20"
                                    onClick={() => onEditBonus(record)}
                                >
                                    <span className="material-symbols-outlined text-sm mr-2">redeem</span>
                                    編輯獎金備註
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Section 2: Ledger */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-neutral-200 mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-sky-500">calendar_month</span>
                            每日打卡流水帳
                        </h3>
                        {renderLedger()}
                    </div>

                    {/* Padding for bottom */}
                    <div className="h-10"></div>
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 bg-white dark:bg-neutral-900 border-t border-slate-200 dark:border-neutral-800 shrink-0">
                    {!isSettled ? (
                        <Button
                            onClick={() => onSettle(record.userId)}
                            isLoading={isProcessing}
                            disabled={isProcessing}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-6"
                        >
                            <span className="material-symbols-outlined mr-2">check_circle</span>
                            確認無誤，結算薪資
                        </Button>
                    ) : (
                        <div className="flex items-center justify-between w-full">
                            <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                                <span className="material-symbols-outlined">lock</span>
                                此紀錄已發放凍結
                            </span>
                            <Button
                                onClick={() => onResettle(record.userId)}
                                disabled={isProcessing}
                                variant="outline"
                                size="sm"
                                className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-900/30"
                            >
                                取消結算
                            </Button>
                        </div>
                    )}
                </div>

            </div>
        </div>
    )
}
