'use client'

import { useState } from 'react'
import { getMyLeaves, getMyLeaveBalances, LeaveRow, LeaveBalanceSummary } from './actions'
import LeaveTable from '@/components/LeaveTable'
import ApplyLeaveDialog from '@/components/ApplyLeaveDialog'
import { PageContainer } from '@/components/ui/PageContainer'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

// ── SVG 甜甜圈圖 ──
const _R = 26, _CX = 32, _CY = 32, _STROKE = 6
const _CIRC = 2 * Math.PI * _R

interface DonutItem {
    label: string
    sublabel: string
    used: number
    total: number
    color: string
    trackColor: string
}

function Donut({ label, sublabel, used, total, color, trackColor }: DonutItem) {
    const pct = total > 0 ? Math.min(used / total, 1) : 0
    const dash = _CIRC * pct
    const exhausted = total > 0 && used >= total

    return (
        <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
            <svg width={60} height={60} viewBox={`0 0 ${_CX * 2} ${_CY * 2}`}>
                <circle cx={_CX} cy={_CY} r={_R} fill="none" stroke={trackColor} strokeWidth={_STROKE} />
                <circle
                    cx={_CX} cy={_CY} r={_R}
                    fill="none"
                    stroke={exhausted ? '#f87171' : color}
                    strokeWidth={_STROKE}
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${_CIRC}`}
                    strokeDashoffset={0}
                    transform={`rotate(-90 ${_CX} ${_CY})`}
                />
                <text x={_CX} y={_CY - 3} textAnchor="middle" dominantBaseline="middle" fontSize="10" fontWeight="700" fill={exhausted ? '#ef4444' : '#334155'}>
                    {used}
                </text>
                <text x={_CX} y={_CY + 9} textAnchor="middle" dominantBaseline="middle" fontSize="8" fill="#94a3b8">
                    /{total}
                </text>
            </svg>
            <div className="text-center leading-tight">
                <div className="text-[11px] font-semibold text-slate-700 dark:text-neutral-200">{label}</div>
                <div className="text-[9px] text-slate-400 dark:text-neutral-500 mt-0.5">{sublabel}</div>
            </div>
        </div>
    )
}

function LeaveBalanceChart({ summary }: { summary: LeaveBalanceSummary }) {
    const items: DonutItem[] = [
        { label: '特休假', sublabel: summary.annual_leave.grantDate || '週年制', used: summary.annual_leave.used, total: summary.annual_leave.total, color: '#6366f1', trackColor: '#e0e7ff' },
        { label: '事假', sublabel: '年上限 14 天', used: summary.personal_leave.used, total: 14, color: '#f59e0b', trackColor: '#fef3c7' },
        { label: '家庭照顧假', sublabel: '年上限 7 天', used: summary.family_care_leave.used, total: 7, color: '#8b5cf6', trackColor: '#ede9fe' },
        { label: '病假', sublabel: '年上限 30 天', used: summary.sick_leave.used, total: 30, color: '#06b6d4', trackColor: '#cffafe' },
        { label: '生理假', sublabel: '月上限 1 天', used: summary.menstrual_leave.used, total: 1, color: '#ec4899', trackColor: '#fce7f3' },
    ]

    return (
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-slate-100 dark:border-neutral-800 shadow-sm p-5 mb-6">
            <h3 className="text-sm font-bold text-slate-700 dark:text-neutral-200 flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-indigo-500">event_available</span>
                假別餘額（{new Date().getFullYear()} 年）
            </h3>
            <div className="flex justify-between gap-2">
                {items.map(item => <Donut key={item.label} {...item} />)}
            </div>
        </div>
    )
}

// ── AnnualLeaveBalance（傳給 ApplyLeaveDialog 用）──
interface AnnualLeaveBalance {
    total_days: number
    used_days: number
    remaining_days: number
}

interface Props {
    initialLeaves: LeaveRow[]
    initialBalance: AnnualLeaveBalance | null
    initialSalaryType: string
    initialLeaveBalances: LeaveBalanceSummary | null
}

export default function LeavesClient({ initialLeaves, initialBalance, initialSalaryType, initialLeaveBalances }: Props) {
    const [leaves, setLeaves] = useState<LeaveRow[]>(initialLeaves)
    const [balance] = useState<AnnualLeaveBalance | null>(initialBalance)
    const [leaveBalances, setLeaveBalances] = useState<LeaveBalanceSummary | null>(initialLeaveBalances)
    const [showApplyDialog, setShowApplyDialog] = useState(false)
    const [refreshing, setRefreshing] = useState(false)

    const salaryType = initialSalaryType
    const isMonthly = salaryType !== 'hourly'

    const fetchData = async () => {
        setRefreshing(true)
        try {
            const [leavesRes, leaveBalancesRes] = await Promise.all([
                getMyLeaves(),
                isMonthly ? getMyLeaveBalances() : Promise.resolve(null),
            ])
            if (leavesRes.success) setLeaves(leavesRes.data)
            if (leaveBalancesRes && leaveBalancesRes.success) setLeaveBalances(leaveBalancesRes.data)
        } finally {
            setRefreshing(false)
        }
    }

    return (
        <PageContainer
            title="請假管理"
            description="查看您的請假記錄與假別餘額，並可在此申請新的休假。"
            action={
                <Button onClick={() => setShowApplyDialog(true)}>
                    + 申請請假
                </Button>
            }
        >
            {/* 五圓形假別餘額圖（月薪制才顯示） */}
            {isMonthly && leaveBalances && (
                <LeaveBalanceChart summary={leaveBalances} />
            )}

            <Card title="我的請假記錄" className="overflow-hidden">
                {refreshing ? (
                    <div className="p-8 text-center text-slate-500">更新中...</div>
                ) : (
                    <LeaveTable data={leaves} onRefresh={fetchData} />
                )}
            </Card>

            {showApplyDialog && (
                <ApplyLeaveDialog
                    onClose={() => setShowApplyDialog(false)}
                    onSuccess={() => {
                        setShowApplyDialog(false)
                        fetchData()
                    }}
                    annualLeaveBalance={balance}
                    salaryType={salaryType}
                />
            )}
        </PageContainer>
    )
}
