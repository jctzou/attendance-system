
import React, { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { type SalaryRecordData, calculateMonthlySalary } from '../actions'
import { features } from '@/utils/features'

interface Props {
    data: SalaryRecordData
    onSettle: (userId: string) => void
    onResettle: (userId: string) => void
    onEditBonus: (record: SalaryRecordData) => void
    isProcessing?: boolean
}

export const EmployeeCard: React.FC<Props> = ({ data, onSettle, onResettle, onEditBonus, isProcessing = false }) => {
    const [isExpanded, setIsExpanded] = useState(false)
    const [liveData, setLiveData] = useState<SalaryRecordData | null>(null)
    const [loadingLive, setLoadingLive] = useState(false)

    const isSettled = data.status === 'SETTLED'
    const isHourly = data.type === 'hourly'

    const formatMoney = (val: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(val).replace('USD', '$')
    }

    const formatHM = (hours: number | undefined) => {
        if (hours === undefined) return '-'
        const totalMinutes = Math.round(hours * 60)
        const h = Math.floor(totalMinutes / 60)
        const m = totalMinutes % 60
        return `${h}小時${m}分`
    }

    const handleExpand = async () => {
        if (!isExpanded && !liveData) {
            setLoadingLive(true)
            const res = await calculateMonthlySalary(data.userId, data.yearMonth, true) // forceLive = true
            if (res.success && res.data) {
                setLiveData(res.data)
            }
            setLoadingLive(false)
        }
        setIsExpanded(!isExpanded)
    }

    // --- Theme Classes ---
    // Unsettled: White (Default)
    // Settled: White with Emerald Border (Updated Spec)
    const theme = isSettled
        ? {
            card: 'bg-slate-50 dark:bg-neutral-800 border-slate-300 dark:border-neutral-700 shadow-sm',
            text: 'text-slate-900 dark:text-neutral-100',
            subText: 'text-slate-500 dark:text-neutral-400',
            badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
            iconBg: 'bg-slate-100 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400'
        }
        : {
            card: 'bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-800',
            text: 'text-slate-900 dark:text-neutral-100',
            subText: 'text-slate-500 dark:text-neutral-400',
            badge: 'bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-400',
            iconBg: 'bg-slate-100 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400'
        }

    return (
        <Card className={`transition-all duration-300 overflow-hidden border ${theme.card}`}>
            {/* Header */}
            <div className="p-6 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className={`h-12 w-12 rounded-full overflow-hidden flex items-center justify-center shadow-sm border border-slate-100 dark:border-neutral-700 ${theme.iconBg} relative`}>
                        {data.avatarUrl ? (
                            <img
                                src={data.avatarUrl}
                                alt={data.displayName}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <span className="text-xl font-bold">{(data.displayName || '?')[0]}</span>
                        )}
                    </div>
                    <div>
                        <div className={`font-bold text-lg ${theme.text}`}>{data.displayName || 'Unknown'}</div>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide
                                ${isHourly ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'}`}>
                                {isHourly ? '鐘點' : '月薪'}
                            </span>
                            {isSettled && (
                                <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${theme.badge}`}>
                                    <span className="material-symbols-outlined text-[10px]">lock</span>
                                    已結算
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Main Stats (Visible on desktop) */}
                {/* Main Stats (Visible on mobile and desktop) */}
                <div className="flex flex-col md:flex-row items-end md:items-center gap-4 md:gap-8 ml-auto mr-0 md:mr-8 w-full md:w-auto mt-4 md:mt-0 px-6 pb-2 md:p-0">
                    <div className="text-right w-full md:w-auto flex justify-between md:block items-center">
                        <span className="md:hidden text-sm text-slate-500 font-medium">
                            {isHourly ? '工時/時薪' : '假勤/月薪'}
                        </span>
                        <div className="text-right">
                            <div className={`hidden md:block text-xs font-medium uppercase tracking-wider ${theme.subText}`}>
                                {isHourly ? '工時/時薪' : '假勤/月薪'}
                            </div>
                            <div className={`font-mono font-bold ${theme.text}`}>
                                {isHourly ? (
                                    <>
                                        <div>
                                            {formatHM(data.workHours)}
                                            {data.totalBreakHours !== undefined && data.totalBreakHours > 0 && (
                                                <span className="text-[10px] text-slate-400 block -mt-1 font-normal">
                                                    (已扣 {formatHM(data.totalBreakHours)})
                                                </span>
                                            )}
                                        </div>
                                        <span className="opacity-30 mx-1">/</span>
                                        {formatMoney(data.rate)}
                                    </>
                                ) : (
                                    <div className="flex items-center justify-end gap-2">
                                        <span className="text-xs font-normal opacity-80">
                                            遲{data.lateCount}/早{data.earlyLeaveCount}/假{data.leaveDays}
                                        </span>
                                        <span className="opacity-30">|</span>
                                        <span>{formatMoney(data.baseSalary)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="text-right w-full md:w-auto flex justify-between md:block items-center">
                        <span className="md:hidden text-sm text-slate-500 font-medium">獎金 / 扣項</span>
                        <div className="text-right flex flex-col items-end">
                            <div className={`hidden md:block text-xs font-medium uppercase tracking-wider ${theme.subText}`}>獎金 / 扣項</div>
                            <div className="flex flex-col items-end">
                                <div className={`font-mono font-bold ${data.bonus > 0 ? 'text-amber-500' : theme.text}`}>
                                    {data.bonus > 0 ? `+${formatMoney(data.bonus)}` : '$0'}
                                </div>
                                {data.bonus > 0 && data.notes && (
                                    <span className="text-[10px] text-slate-400 max-w-[80px] truncate" title={data.notes}>
                                        {data.notes}
                                    </span>
                                )}
                                {data.deduction > 0 && (
                                    <div className="font-mono font-bold text-red-500 text-sm mt-0.5">
                                        -{formatMoney(data.deduction)}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="text-right w-full md:w-auto flex justify-between md:block items-center pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-neutral-800">
                        <span className="md:hidden text-sm text-slate-500 font-medium">實發金額</span>
                        <div className="text-right">
                            <div className={`hidden md:block text-xs font-medium uppercase tracking-wider ${theme.subText}`}>實發金額</div>
                            <div className={`text-2xl font-bold font-mono ${theme.text}`}>
                                {formatMoney(data.totalSalary)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                    {!isSettled && (
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => onEditBonus(data)}
                            disabled={isProcessing}
                        >
                            編輯獎金
                        </Button>
                    )}

                    <Button
                        size="sm"
                        variant={isSettled ? 'outline-danger' : 'primary'}
                        onClick={() => isSettled ? onResettle(data.userId) : onSettle(data.userId)}
                        disabled={isProcessing}
                        isLoading={isProcessing}
                    >
                        {isSettled ? '取消結算' : '結算薪資'}
                    </Button>

                    {isSettled && (
                        <button
                            onClick={handleExpand}
                            className={`p-1 rounded-full transition-colors ${isExpanded ? 'bg-emerald-200 dark:bg-emerald-800' : 'hover:bg-emerald-100 dark:hover:bg-emerald-900/30'}`}
                        >
                            <span className={`material-symbols-outlined transform transition-transform ${isExpanded ? 'rotate-180' : ''} text-emerald-600 dark:text-emerald-400`}>
                                expand_more
                            </span>
                        </button>
                    )}
                </div>
            </div>

            {/* Expanded Live Data Section */}
            {isSettled && isExpanded && (
                <div className="bg-slate-50 dark:bg-neutral-900/50 border-t border-emerald-100 dark:border-emerald-900/30 p-6 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="font-bold text-slate-700 dark:text-neutral-300 flex items-center gap-2">
                            <span className="material-symbols-outlined text-amber-500">sync</span>
                            目前實時計算數據 (Live Calculation)
                        </h4>
                        <span className="text-xs text-slate-400">這是若現在重新結算的金額預覽</span>
                    </div>

                    {loadingLive ? (
                        <div className="py-8 flex justify-center">
                            <div className="animate-spin w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full"></div>
                        </div>
                    ) : liveData ? (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {/* Col 1: Base */}
                            <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-slate-200 dark:border-neutral-700">
                                <span className="text-xs text-slate-500 block mb-1">
                                    {isHourly ? '工時/時薪' : '月薪基數'}
                                </span>
                                <div className="font-mono font-bold text-slate-900 dark:text-neutral-100">
                                    {isHourly ? (
                                        <>
                                            <div>
                                                {liveData.workHours}h
                                                {liveData.totalBreakHours !== undefined && liveData.totalBreakHours > 0 && (
                                                    <span className="text-[10px] text-slate-400 block -mt-1 font-normal">
                                                        (已扣 {liveData.totalBreakHours}h)
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-sm text-slate-400 font-normal ml-1">x {formatMoney(liveData.rate)}</span>
                                        </>
                                    ) : (
                                        formatMoney(liveData.baseSalary)
                                    )}
                                </div>
                            </div>

                            {/* Col 2: Bonus */}
                            <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-slate-200 dark:border-neutral-700">
                                <span className="text-xs text-slate-500 block mb-1">獎金 (未結算)</span>
                                <div className="font-mono font-bold text-amber-600 dark:text-amber-400">
                                    <div className="flex flex-col">
                                        <span>+{formatMoney(liveData.bonus)}</span>
                                        {liveData.bonus > 0 && liveData.notes && (
                                            <span className="text-[10px] font-normal opacity-70 truncate max-w-[120px]" title={liveData.notes}>
                                                {liveData.notes}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Col 3: Deduction */}
                            <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-slate-200 dark:border-neutral-700">
                                <span className="text-xs text-slate-500 block mb-1">請假扣款</span>
                                <div className="font-mono font-bold text-red-600 dark:text-red-400">
                                    <div className="flex flex-col">
                                        <span>-{formatMoney(liveData.deduction)}</span>
                                        <div className="flex flex-col gap-1 mt-1 text-slate-500 dark:text-neutral-400 text-[10px] font-sans font-normal">
                                            <span>遲{liveData.lateCount}/早{liveData.earlyLeaveCount}/假{liveData.leaveDays}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Col 4: Total */}
                            <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-slate-200 dark:border-neutral-700 ring-1 ring-emerald-500/20">
                                <span className="text-xs text-emerald-600 dark:text-emerald-400 block mb-1">預估實發金額</span>
                                <div className="font-mono font-bold text-xl text-emerald-600 dark:text-emerald-400">
                                    {formatMoney(liveData.totalSalary)}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-red-500 text-sm">無法取得實時數據</div>
                    )}
                </div>
            )}
        </Card>
    )
}
