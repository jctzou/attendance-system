import React from 'react'
import { Card } from '@/components/ui/Card'
import { type SalaryRecordData } from '../actions'

interface Props {
    data: SalaryRecordData
    onClick: (record: SalaryRecordData) => void
    isProcessing?: boolean
}

export const EmployeeCard: React.FC<Props> = ({ data, onClick, isProcessing = false }) => {
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
        if (h > 0 && m === 0) return `${h}小時`
        if (h > 0 && m > 0) return `${h}小時${m}分`
        return `${m}分`
    }

    // 計算異常標籤
    const alerts = []
    if (data.lateCount > 0) alerts.push(`遲到 ${data.lateCount} 次`)
    if (data.earlyLeaveCount > 0) alerts.push(`早退 ${data.earlyLeaveCount} 次`)
    if (data.leaveDays > 0) alerts.push(`請假 ${data.leaveDays} 天`)
    if (data.deduction > 0) alerts.push(`扣款 ${formatMoney(data.deduction)}`)

    const theme = isSettled
        ? {
            card: 'bg-emerald-50/30 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800',
            text: 'text-slate-900 dark:text-neutral-100',
            subText: 'text-emerald-700 dark:text-emerald-400',
            badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
            iconBg: 'bg-emerald-100/50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
        }
        : {
            card: 'bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 hover:border-primary/40 dark:hover:border-primary/40',
            text: 'text-slate-900 dark:text-neutral-100',
            subText: 'text-slate-500 dark:text-neutral-400',
            badge: 'bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-400',
            iconBg: 'bg-slate-100 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400'
        }

    return (
        <Card
            className={`transition-all duration-300 overflow-hidden border cursor-pointer hover:shadow-md ${theme.card} ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
            onClick={() => onClick(data)}
        >
            <div className="p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">

                {/* 1. 身份列 */}
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className={`shrink-0 h-12 w-12 md:h-14 md:w-14 rounded-full overflow-hidden flex items-center justify-center shadow-sm border border-slate-100 dark:border-neutral-700 ${theme.iconBg} relative`}>
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
                    <div className="flex flex-col">
                        <div className={`font-bold text-lg md:text-xl ${theme.text}`}>{data.displayName || 'Unknown'}</div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] md:text-xs font-bold tracking-wide
                                ${isHourly ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'}`}>
                                {isHourly ? '時薪制' : '月薪制'}
                            </span>
                            {isSettled && (
                                <span className={`flex items-center gap-1 text-[10px] md:text-xs font-bold px-2 py-0.5 rounded-full ${theme.badge}`}>
                                    <span className="material-symbols-outlined text-[12px]">check_circle</span>
                                    已發放
                                </span>
                            )}
                            {data.bonus > 0 && (
                                <span className="flex items-center gap-1 text-[10px] md:text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                                    <span className="material-symbols-outlined text-[12px]">redeem</span>
                                    含獎金
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* 2. 核心數據 + 警示 列 */}
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-8 w-full md:w-auto">

                    {/* 警示標籤區 (若有異常) */}
                    {alerts.length > 0 && !isSettled && (
                        <div className="flex flex-wrap md:flex-col gap-1.5 md:items-end justify-start w-full md:w-auto">
                            {alerts.map((alert, idx) => (
                                <span key={idx} className="bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 text-xs px-2 py-1 rounded-md border border-red-100 dark:border-red-900/30 flex items-center gap-1 font-medium">
                                    <span className="material-symbols-outlined text-[14px]">warning</span>
                                    {alert}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* 收算總金額與工時 */}
                    <div className="flex items-center justify-between md:flex-col md:items-end w-full md:w-auto mt-2 md:mt-0 pt-3 md:pt-0 border-t md:border-none border-slate-100 dark:border-neutral-800">
                        <div className="text-sm md:text-xs text-slate-500 dark:text-neutral-400 font-medium md:mb-1">
                            {isHourly ? '累計工時' : '本月總額'} {isHourly && <span className="font-mono text-slate-700 dark:text-neutral-300 ml-1">{formatHM(data.workHours)}</span>}
                        </div>
                        <div className={`text-2xl md:text-3xl font-bold tracking-tight font-mono
                            ${isSettled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                            {formatMoney(data.totalSalary)}
                        </div>
                    </div>

                    {/* 箭頭指示 */}
                    <div className="hidden md:flex text-slate-300 dark:text-neutral-600">
                        <span className="material-symbols-outlined">chevron_right</span>
                    </div>
                </div>

            </div>
        </Card>
    )
}
