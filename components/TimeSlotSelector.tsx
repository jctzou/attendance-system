'use client'

import { useMemo } from 'react'

interface Props {
    value: string  // datetime-local format: "2026-02-11T09:30"
    onChange: (value: string) => void
    label: string
    required?: boolean
    workDate?: string  // 強制綁定日期，避免 value 為空時 fallback 到今日
    allowAnyMinute?: boolean // 是否允許設定每一分鐘
}

export default function TimeSlotSelector({ value, onChange, label, required = false, workDate, allowAnyMinute = false }: Props) {
    // 解析 value 為日期、上午/下午、時間
    const { date, period, hours12, minutes } = useMemo(() => {
        if (!value) return { date: '', period: 'AM' as 'AM' | 'PM', hours12: 9, minutes: 0 }

        try {
            // 直接從 ISO 字串 (YYYY-MM-DDTHH:mm) 解析，避免 new Date() 時區偏移
            const [datePart, timePartRaw] = value.split('T')
            const dateStr = datePart
            // 處理可能有秒數或 'Z' 的狀況 (e.g. 09:30:00.000Z)
            const timePart = timePartRaw.split('.')[0].replace('Z', '')
            const [hStr, mStr] = timePart.split(':')
            const hours24 = parseInt(hStr, 10)
            let rawMinutes = parseInt(mStr, 10)

            // 如果不允許每一分，則進行四捨五入到最近的30分鐘
            let finalHours24 = hours24
            let finalMinutes = rawMinutes

            if (!allowAnyMinute) {
                finalMinutes = rawMinutes >= 15 && rawMinutes < 45 ? 30 : 0
                if (rawMinutes >= 45) {
                    finalHours24 = (hours24 + 1) % 24
                    finalMinutes = 0
                }
            }

            // 轉換為12小時制
            const period: 'AM' | 'PM' = finalHours24 >= 12 ? 'PM' : 'AM'
            let h12 = finalHours24 % 12
            if (h12 === 0) h12 = 12

            return { date: dateStr, period, hours12: h12, minutes: finalMinutes }
        } catch (e) {
            return { date: '', period: 'AM' as 'AM' | 'PM', hours12: 9, minutes: 0 }
        }
    }, [value, allowAnyMinute])

    // 生成12小時制「時」選項 (12, 01, 02, ..., 11)
    const hourSlots = useMemo(() => {
        const slots: string[] = ['12']
        for (let h = 1; h <= 11; h++) {
            slots.push(String(h).padStart(2, '0'))
        }
        return slots
    }, [])

    // 生成「分」選項
    const minuteSlots = useMemo(() => {
        if (!allowAnyMinute) {
            return ['00', '30']
        }
        const slots: string[] = []
        for (let m = 0; m < 60; m++) {
            slots.push(String(m).padStart(2, '0'))
        }
        return slots
    }, [allowAnyMinute])

    // 將12小時制轉換為24小時制
    const convert12to24 = (h12: number, min: number, period: 'AM' | 'PM'): string => {
        let h24 = h12
        if (period === 'AM') {
            if (h24 === 12) h24 = 0  // 12 AM = 00:00
        } else { // PM
            if (h24 !== 12) h24 += 12  // PM 加12，但12 PM保持12
        }
        return `${String(h24).padStart(2, '0')}:${String(min).padStart(2, '0')}`
    }

    // Helper to get today's date in Local YYYY-MM-DD format
    const getTodayDateStr = () => {
        const now = new Date()
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    }

    // 統一處理變更
    const emitChange = (newPeriod: 'AM' | 'PM', newH12: number, newMin: number) => {
        const targetDate = workDate || date || getTodayDateStr()
        const hours24 = convert12to24(newH12, newMin, newPeriod)
        onChange(`${targetDate}T${hours24}`)
    }

    return (
        <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="grid grid-cols-3 gap-2">
                {/* 上午/下午選擇 */}
                <select
                    value={period}
                    onChange={(e) => emitChange(e.target.value as 'AM' | 'PM', hours12, minutes)}
                    className="w-full border border-slate-300 dark:border-neutral-600 rounded-md p-2 text-sm bg-white dark:bg-neutral-800 text-slate-900 dark:text-neutral-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent hover:border-slate-400 dark:hover:border-neutral-500"
                    required={required}
                >
                    <option value="AM">上午</option>
                    <option value="PM">下午</option>
                </select>

                {/* 小時選擇 */}
                <select
                    value={String(hours12).padStart(2, '0')}
                    onChange={(e) => emitChange(period, parseInt(e.target.value, 10), minutes)}
                    className="w-full border border-slate-300 dark:border-neutral-600 rounded-md p-2 text-sm bg-white dark:bg-neutral-800 text-slate-900 dark:text-neutral-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent hover:border-slate-400 dark:hover:border-neutral-500"
                    required={required}
                >
                    {hourSlots.map(slot => (
                        <option key={slot} value={slot}>{slot} 點</option>
                    ))}
                </select>

                {/* 分鐘選擇 */}
                <select
                    value={String(minutes).padStart(2, '0')}
                    onChange={(e) => emitChange(period, hours12, parseInt(e.target.value, 10))}
                    className="w-full border border-slate-300 dark:border-neutral-600 rounded-md p-2 text-sm bg-white dark:bg-neutral-800 text-slate-900 dark:text-neutral-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent hover:border-slate-400 dark:hover:border-neutral-500"
                    required={required}
                >
                    {minuteSlots.map(slot => (
                        <option key={slot} value={slot}>{slot} 分</option>
                    ))}
                </select>
            </div>
        </div>
    )
}
