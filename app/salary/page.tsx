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

export default function MySalaryPage() {
    const [records, setRecords] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchRecords()
    }, [])

    const fetchRecords = async () => {
        setLoading(true)
        const res = await getMySalaryRecords()
        if (res.data) {
            setRecords(res.data)
        }
        setLoading(false)
    }

    // 渲染出勤統計詳情
    const renderDetails = (details: any) => {
        if (!details) return null
        return (
            <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                {details.lateCount > 0 && <div>遲到: {details.lateCount} 次</div>}
                {details.earlyLeaveCount > 0 && <div>早退: {details.earlyLeaveCount} 次</div>}
                {details.leaveDays > 0 && <div>請假: {details.leaveDays} 天</div>}
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-slate-800 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">payments</span>
                我的薪資單
            </h1>

            {loading ? (
                <div className="text-center py-10 text-slate-500">載入中...</div>
            ) : (
                <div className="space-y-6">
                    {records.length > 0 ? (
                        records.map((record) => (
                            <div key={record.id} className="bg-white dark:bg-slate-900 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-slate-300/50 dark:border-slate-700/50 overflow-hidden">
                                <div className="bg-primary/5 dark:bg-primary/10 px-6 py-4 flex justify-between items-center border-b border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center gap-3">
                                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">
                                            {record.year_month} 薪資單
                                        </h3>
                                        <span className="text-sm text-primary bg-white dark:bg-slate-800 px-2 py-1 rounded border border-primary/20">
                                            {record.user?.salary_type === 'hourly' ? '鐘點薪資' : '月薪'}
                                        </span>
                                    </div>

                                    {/* PDF 下載按鈕 */}
                                    <PDFDownloadLink
                                        document={<SalaryPDF record={record} user={record.user} />}
                                        fileName={`salary_${record.year_month}.pdf`}
                                        className="px-3 py-1 bg-white dark:bg-slate-800 border border-primary/30 text-primary rounded-lg text-sm hover:bg-primary/5 transition-colors"
                                    >
                                        {/* @ts-ignore */}
                                        {({ loading }) =>
                                            loading ? '生成中...' : '📥 下載 PDF'
                                        }
                                    </PDFDownloadLink>
                                </div>
                                <div className="p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">出勤統計 / 工時</label>
                                            <div className="text-slate-900 dark:text-white">
                                                {record.user?.salary_type === 'hourly' ? (
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-lg">{((record.settled_data as any)?.work_hours || record.work_hours || 0)} 小時</span>
                                                        {((record.settled_data as any)?.details?.totalBreakHours || (record.details as any)?.totalBreakHours) > 0 && (
                                                            <span className="text-xs text-slate-500 font-normal">
                                                                (已扣除 {((record.settled_data as any)?.details?.totalBreakHours || (record.details as any)?.totalBreakHours)} 小時午休)
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div>
                                                        {((record.settled_data as any)?.details || record.details) ? renderDetails((record.settled_data as any)?.details || record.details) : <span className="text-slate-400">-</span>}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">基本薪資</label>
                                            <div className="text-slate-900 dark:text-white text-lg font-medium">
                                                ${((record.settled_data as any)?.base_salary || record.base_salary)?.toLocaleString()}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 獎金區域 - 僅當有獎金時顯示 */}
                                    {(((record.settled_data as any)?.bonus || record.bonus) > 0) && (
                                        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 mb-6 border border-green-200 dark:border-green-800">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <label className="block text-sm font-medium text-green-700 dark:text-green-400 mb-1">額外獎金</label>
                                                    {record.notes && (
                                                        <p className="text-sm text-green-600 dark:text-green-500 mt-1">{record.notes}</p>
                                                    )}
                                                </div>
                                                <div className="text-green-700 dark:text-green-400 font-bold text-lg">
                                                    +${((record.settled_data as any)?.bonus || record.bonus)?.toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="border-t border-slate-200 dark:border-slate-700 pt-4 flex justify-between items-center">
                                        <div className="text-slate-500 dark:text-slate-400 text-sm">
                                            發放日期: {record.paid_at ? new Date(record.paid_at).toLocaleDateString() : '-'}
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">實領薪資</div>
                                            <div className="text-2xl font-bold text-primary">
                                                ${((record.settled_data as any)?.total_salary || record.total_salary)?.toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-16 bg-card-light dark:bg-card-dark rounded-xl shadow text-slate-500">
                            目前沒有已發放的薪資記錄
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
