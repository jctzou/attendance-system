import React from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface ControlBarProps {
    selectedMonth: string
    onMonthChange: (month: string) => void
    onOpenSettings: () => void
}

export const ControlBar: React.FC<ControlBarProps> = ({ selectedMonth, onMonthChange, onOpenSettings }) => {
    return (
        <Card className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 w-full md:w-auto">
                <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    選擇月份：
                </label>
                <div className="relative w-full sm:w-auto min-w-0">
                    <input
                        className="block w-full max-w-full md:w-64 pl-4 pr-10 py-2.5 text-sm font-bold border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-xl focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] bg-slate-50 shadow-sm transition-colors outline-none"
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => onMonthChange(e.target.value)}
                    />
                </div>
            </div>
            <Button
                onClick={onOpenSettings}
                variant="secondary"
                startIcon={<span className="material-symbols-outlined text-lg">settings</span>}
            >
                員工薪資設定
            </Button>
        </Card>
    )
}
