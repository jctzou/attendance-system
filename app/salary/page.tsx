'use client'

import { useEffect, useState } from 'react'
import { getMySalaryRecords } from './actions'
import dynamic from 'next/dynamic'
import SalaryPDF from '@/components/SalaryPDF'

const PDFDownloadLink = dynamic(
    () => import('@react-pdf/renderer').then((mod) => mod.PDFDownloadLink),
    {
        ssr: false,
        loading: () => <button className="text-sm text-gray-400">載入 PDF...</button>,
    }
)

const LEAVE_MAP: Record<string, { name: string; weight: number }> = {
    'personal_leave': { name: '事假', weight: 1 },
    'sick_leave': { name: '病假（未住院）', weight: 0.5 },
    'family_care_leave': { name: '家庭照顧假', weight: 1 },
    'menstrual_leave': { name: '生理假', weight: 0.5 },
    'annual_leave': { name: '特休假', weight: 0 },
    'other': { name: '其他假', weight: 1 },
}

function formatMoney(val: number | undefined | null): string {
    if (val === undefined || val === null) return '$0'
    return '$' + Math.ceil(val).toLocaleString()
}

function formatHM(minutes: number | undefined | null): string {
    if (!minutes) return '-'
    const h = Math.floor(minutes / 60)
    const m = Math.round(minutes % 60)
    if (h === 0) return `${m}分`
    if (m === 0) return `${h}小時`
    return `${h}小時${m}分`
}

export default function MySalaryPage() {
    const [records, setRecords] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchRecords = async () => {
            setLoading(true)
            const res = await getMySalaryRecords()
            if (res.success) setRecords(res.data)
            setLoading(false)
        }
        fetchRecords()
    }, [])

    return (
        <div className="max-w-3xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-slate-800 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">payments</span>
                我的薪資單
            </h1>

            {loading ? (
                <div className="text-center py-10 text-slate-500">載入中...</div>
            ) : records.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-neutral-900 rounded-xl shadow text-slate-500 border border-slate-100 dark:border-neutral-800">
                    目前沒有已發放的薪資記錄
                </div>
            ) : (
                <div className="space-y-6">
                    {records.map((record) => {
                        const s = record.settled_data as any
                        const isHourly = (record.user?.salary_type || s?.salaryType) === 'hourly'
                        const baseSalary: number = s?.base_salary ?? record.base_salary ?? 0
                        const bonus: number = s?.bonus ?? record.bonus ?? 0
                        const deduction: number = s?.details?.deduction ?? record.deduction ?? 0
                        const totalSalary: number = s?.total_salary ?? record.total_salary ?? 0
                        const workMinutes: number = s?.work_minutes ?? record.work_minutes ?? 0
                        const rate: number = s?.rate ?? record.rate ?? baseSalary
                        const leaveDetails: Record<string, number> = s?.details?.leaveDetails ?? record.details?.leaveDetails ?? {}
                        const leaveDays: number = s?.details?.leaveDays ?? 0
                        const dailyRate = isHourly ? 0 : rate / 30

                        return (
                            <div key={record.id} className="bg-white dark:bg-neutral-900 rounded-2xl border border-slate-100 dark:border-neutral-800 shadow-sm overflow-hidden">

                                {/* Card Header */}
                                <div className="px-5 py-4 bg-slate-50/60 dark:bg-neutral-800/60 border-b border-slate-100 dark:border-neutral-800 flex flex-wrap justify-between items-center gap-3">
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-primary">receipt_long</span>
                                        <div>
                                            <h3 className="font-bold text-base text-slate-800 dark:text-white">
                                                {record.year_month.replace('-', ' 年 ')} 月薪資單
                                            </h3>
                                            <p className="text-xs text-slate-400 mt-0.5">
                                                結算日：{record.paid_at ? new Date(record.paid_at).toLocaleDateString('zh-TW') : '-'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${isHourly ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'}`}>
                                            {isHourly ? '鐘點制' : '月薪制'}
                                        </span>
                                        <PDFDownloadLink
                                            document={<SalaryPDF record={record} user={record.user} />}
                                            fileName={`salary_${record.year_month}.pdf`}
                                            className="text-xs px-3 py-1.5 border border-primary/30 text-primary rounded-lg hover:bg-primary/5 transition-colors flex items-center gap-1"
                                        >
                                            {/* @ts-ignore */}
                                            {({ loading: pdfLoading }) => pdfLoading ? '生成中...' : '📥 下載 PDF'}
                                        </PDFDownloadLink>
                                    </div>
                                </div>

                                {/* ===== 薪資公式拆解 ===== */}
                                <div className="p-5 space-y-3">

                                    {/* 基本薪資 */}
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500 dark:text-neutral-400 flex items-center gap-1.5">
                                            <span className="material-symbols-outlined text-base text-slate-400">work</span>
                                            {isHourly
                                                ? `基本計算（$${rate.toLocaleString()} × ${formatHM(workMinutes)}）`
                                                : '月薪基本薪資'
                                            }
                                        </span>
                                        <span className="font-mono font-medium text-slate-800 dark:text-white">{formatMoney(baseSalary)}</span>
                                    </div>

                                    {/* 獎金 */}
                                    {bonus > 0 && (
                                        <div className="flex justify-between items-start text-sm">
                                            <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                                                <span className="material-symbols-outlined text-base">redeem</span>
                                                獎金 / 補貼
                                                {record.notes && (
                                                    <span className="ml-1 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[10px] px-1.5 py-0.5 rounded border border-amber-100 dark:border-amber-900/30 max-w-[140px] truncate">
                                                        {record.notes}
                                                    </span>
                                                )}
                                            </span>
                                            <span className="font-mono font-medium text-amber-500">+{formatMoney(bonus)}</span>
                                        </div>
                                    )}

                                    {/* 假勤扣除 + 明細 */}
                                    {deduction > 0 && (
                                        <div className="flex flex-col gap-1.5">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-red-500 dark:text-red-400 flex items-center gap-1.5">
                                                    <span className="material-symbols-outlined text-base">event_busy</span>
                                                    假勤扣除{leaveDays > 0 ? `（共 ${leaveDays} 天）` : ''}
                                                </span>
                                                <span className="font-mono font-medium text-red-500">-{formatMoney(deduction)}</span>
                                            </div>

                                            {/* 假別明細 */}
                                            {!isHourly && Object.keys(leaveDetails).length > 0 && (
                                                <div className="ml-5 pl-3 border-l-2 border-red-100 dark:border-red-900/30 space-y-1">
                                                    {Object.entries(leaveDetails).map(([type, count]) => {
                                                        const info = LEAVE_MAP[type]
                                                        if (!info || info.weight === 0) return null
                                                        const deductVal = Math.ceil(dailyRate * (count as number) * info.weight)
                                                        return (
                                                            <div key={type} className="flex justify-between text-xs text-red-400/80">
                                                                <span>↳ {info.name} {count as number} 天 × {info.weight} 係數</span>
                                                                <span className="font-mono">-{formatMoney(deductVal)}</span>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* 實領合計 */}
                                    <div className="border-t border-slate-100 dark:border-neutral-800 pt-3 mt-1 flex justify-between items-center">
                                        <span className="font-bold text-slate-700 dark:text-neutral-200 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-emerald-500">payments</span>
                                            實領薪資
                                        </span>
                                        <span className="font-mono text-3xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
                                            {formatMoney(totalSalary)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
