import React from 'react'
import { type LeaveSummary } from '../actions'

// ── SVG 甜甜圈圖 ──
const R = 26
const CX = 32
const CY = 32
const STROKE = 6
const CIRCUMFERENCE = 2 * Math.PI * R  // ≈ 163.4

interface DonutProps {
    used: number
    total: number
    label: string
    sublabel: string
    color: string        // stroke color (tailwind class 替代，直接用 hex)
}

function Donut({ used, total, label, sublabel, color }: DonutProps) {
    const pct = total > 0 ? Math.min(used / total, 1) : 0
    const dash = CIRCUMFERENCE * pct
    const isExhausted = total > 0 && used >= total

    return (
        <div className="flex flex-col items-center gap-1.5 min-w-0">
            {/* 圓形圖 */}
            <div className="relative">
                <svg width={64} height={64} viewBox={`0 0 ${CX * 2} ${CY * 2}`}>
                    {/* 軌道圈：深色模式下改為較暗顏色 */}
                    <circle
                        cx={CX} cy={CY} r={R}
                        fill="none"
                        className="stroke-slate-100 dark:stroke-neutral-800"
                        strokeWidth={STROKE}
                    />
                    {/* 進度弧：使用亮色 */}
                    <circle
                        cx={CX} cy={CY} r={R}
                        fill="none"
                        stroke={isExhausted ? '#ef4444' : color}
                        strokeWidth={STROKE}
                        strokeLinecap="round"
                        strokeDasharray={`${dash} ${CIRCUMFERENCE}`}
                        strokeDashoffset={0}
                        transform={`rotate(-90 ${CX} ${CY})`}
                        style={{ transition: 'stroke-dasharray 0.5s ease' }}
                    />
                    {/* 中心數字：適配深淺色模式 */}
                    <text
                        x={CX} y={CY - 3}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="10"
                        fontWeight="700"
                        className={isExhausted ? 'fill-red-500' : 'fill-slate-700 dark:fill-neutral-200'}
                    >
                        {used}
                    </text>
                    <text
                        x={CX} y={CY + 9}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="8"
                        className="fill-slate-400 dark:fill-neutral-500"
                    >
                        /{total}
                    </text>
                </svg>
            </div>
            {/* 標籤 */}
            <div className="text-center">
                <div className="text-[11px] font-semibold text-slate-700 dark:text-neutral-200 leading-tight">{label}</div>
                <div className="text-[9px] text-slate-400 dark:text-neutral-500 leading-tight mt-0.5">{sublabel}</div>
            </div>
        </div>
    )
}

// ── 主元件 ──
interface Props {
    summary: LeaveSummary
}

export const LeaveSummaryBlock: React.FC<Props> = ({ summary }) => {
    const al = summary.annual_leave
    const pl = summary.personal_leave
    const fc = summary.family_care_leave
    const sl = summary.sick_leave
    const ml = summary.menstrual_leave

    const items: DonutProps[] = [
        {
            label: '特休假',
            sublabel: al?.grantDate ? al.grantDate : '週年制',
            used: al?.used ?? 0,
            total: al?.total ?? 0,
            color: '#818cf8',
        },
        {
            label: '事假',
            sublabel: '年上限 14 天',
            used: pl?.used ?? 0,
            total: 14,
            color: '#fbbf24',
        },
        {
            label: '家庭照顧假',
            sublabel: '年上限 7 天',
            used: fc?.used ?? 0,
            total: 7,
            color: '#a78bfa',
        },
        {
            label: '病假',
            sublabel: '年上限 30 天',
            used: sl?.used ?? 0,
            total: 30,
            color: '#22d3ee',
        },
        {
            label: '生理假',
            sublabel: '月上限 1 天',
            used: ml?.used ?? 0,
            total: 1,
            color: '#f472b6',
        },
    ]

    return (
        <div className="bg-white dark:bg-neutral-900 rounded-xl p-4 border border-slate-200 dark:border-neutral-800 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-neutral-200 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-500">event_available</span>
                假別餘額
            </h3>
            <div className="flex justify-between gap-2">
                {items.map(item => (
                    <Donut key={item.label} {...item} />
                ))}
            </div>
        </div>
    )
}
