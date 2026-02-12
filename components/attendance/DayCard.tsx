import { Card } from '@/components/ui/Card'
import { LEAVE_TYPE_MAP, WEEKDAY_MAP } from '@/app/attendance/constants'

interface DayCardProps {
    date: string
    attendance: any
    leave: any
    isHourly: boolean
    onClick: (date: string) => void
    onEditClick: (attendanceId: number) => void
}

export function DayCard({
    date,
    attendance: att,
    leave,
    isHourly,
    onClick,
    onEditClick
}: DayCardProps) {
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
    const dateObj = new Date(date)
    const day = dateObj.getDate()
    const dayOfWeek = dateObj.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const weekdayText = WEEKDAY_MAP[dayOfWeek]
    const isToday = date === today

    const getCardStyle = () => {
        if (isToday) {
            return 'bg-blue-50 dark:bg-blue-900/20 border-blue-400 dark:border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
        }
        if (isWeekend) {
            return 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/20'
        }
        return 'bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700'
    }

    const getHeaderTextStyle = () => {
        if (isToday) return 'text-blue-700 dark:text-blue-400'
        return 'text-slate-700 dark:text-slate-200'
    }

    const getBadgeStyle = () => {
        if (isToday) return 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium'
        if (isWeekend) return 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 font-medium'
        return 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400'
    }

    return (
        <Card
            onClick={() => onClick(date)}
            padding="p-3"
            className={`
                cursor-pointer transition-all duration-200
                hover:shadow-lg hover:scale-105 border
                ${getCardStyle()}
            `}
        >
            <div className="flex items-center justify-between mb-2">
                <div className={`font-bold text-sm ${getHeaderTextStyle()}`}>
                    {day}日
                    {isToday && <span className="ml-1 text-xs text-blue-600 dark:text-blue-400">今天</span>}
                </div>
                <div className={`text-xs px-1.5 py-0.5 rounded ${getBadgeStyle()}`}>
                    {weekdayText}
                </div>
            </div>

            {leave ? (
                <div className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 px-2 py-1 rounded font-medium mb-1">
                    🏖️ {LEAVE_TYPE_MAP[leave.leave_type] || '未定義假別'}
                </div>
            ) : null}

            {att ? (
                <div className="text-xs space-y-1">
                    <div className="flex items-center gap-1">
                        <span className="text-green-600 dark:text-green-400 font-medium">✓ 已打卡</span>
                        {att.break_duration > 0 && (
                            <span className="text-slate-400 text-[10px]">(休{att.break_duration}h)</span>
                        )}
                    </div>
                    <div className="text-slate-600 dark:text-slate-400">
                        上班: {att.clock_in_time ? new Date(att.clock_in_time).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }) : '-'}
                    </div>
                    <div className="text-slate-600 dark:text-slate-400">
                        下班: {att.clock_out_time ? new Date(att.clock_out_time).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }) : '-'}
                    </div>


                    {/* Hourly: Hide Status. Monthly: Show Status */}
                    {!isHourly && att.status !== 'normal' && (
                        <div className="text-red-600 dark:text-red-400 font-medium">
                            {att.status === 'late' ? '遲到' : att.status === 'early_leave' ? '早退' : '遲到早退'}
                        </div>
                    )}

                    {att.is_edited && (
                        <div
                            onClick={(e) => {
                                e.stopPropagation()
                                onEditClick(att.id)
                            }}
                            className="text-blue-600 dark:text-blue-400 text-xs cursor-pointer hover:underline flex items-center gap-1"
                        >
                            ✏️ 已修改
                        </div>
                    )}
                </div>
            ) : !leave ? (
                isWeekend ? (
                    <div className="text-xs text-red-400 dark:text-red-300/70 font-medium">🏖️ 例假日</div>
                ) : (
                    <div className="text-xs text-gray-400 dark:text-slate-500">無記錄</div>
                )
            ) : null}
        </Card>
    )
}
