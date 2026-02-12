'use client'

import { useMemo } from 'react'

interface Props {
    value: string  // datetime-local format: "2026-02-11T09:30"
    onChange: (value: string) => void
    label: string
    required?: boolean
}

export default function TimeSlotSelector({ value, onChange, label, required = false }: Props) {
    // 解析 value 為日期、上午/下午、時間
    const { date, period, time12 } = useMemo(() => {
        if (!value) return { date: '', period: 'AM' as 'AM' | 'PM', time12: '09:00' }

        try {
            // 直接從 ISO 字串 (YYYY-MM-DDTHH:mm) 解析，避免 new Date() 時區偏移
            const [datePart, timePart] = value.split('T')
            const dateStr = datePart
            const [hStr, mStr] = timePart.split(':')
            const hours = parseInt(hStr, 10)
            const minutes = parseInt(mStr, 10)

            // 四捨五入到最近的30分鐘
            const roundedMinutes = minutes >= 15 && minutes < 45 ? 30 : minutes >= 45 ? 0 : 0
            let roundedHours = minutes >= 45 ? (hours + 1) % 24 : hours

            // 轉換為12小時制
            const period: 'AM' | 'PM' = roundedHours >= 12 ? 'PM' : 'AM'
            let hours12 = roundedHours % 12
            if (hours12 === 0) hours12 = 12  // 0點和12點顯示為12

            const time12Str = `${String(hours12).padStart(2, '0')}:${roundedMinutes === 30 ? '30' : '00'}`

            return { date: dateStr, period, time12: time12Str }
        } catch (e) {
            return { date: '', period: 'AM' as 'AM' | 'PM', time12: '09:00' }
        }
    }, [value])

    // 生成12小時制時間選項（12:00, 12:30, 01:00, ..., 11:30）
    const timeSlots = useMemo(() => {
        const slots: string[] = []
        // 12:00, 12:30
        slots.push('12:00')
        slots.push('12:30')
        // 01:00 到 11:30
        for (let h = 1; h <= 11; h++) {
            slots.push(`${String(h).padStart(2, '0')}:00`)
            slots.push(`${String(h).padStart(2, '0')}:30`)
        }
        return slots
    }, [])

    // 將12小時制轉換為24小時制
    const convert12to24 = (time12: string, period: 'AM' | 'PM'): string => {
        const [hoursStr, minutesStr] = time12.split(':')
        let hours = parseInt(hoursStr)

        if (period === 'AM') {
            if (hours === 12) hours = 0  // 12 AM = 00:00
        } else { // PM
            if (hours !== 12) hours += 12  // PM 加12，但12 PM保持12
        }

        return `${String(hours).padStart(2, '0')}:${minutesStr}`
    }

    // Helper to get today's date in Local YYYY-MM-DD format
    const getTodayDateStr = () => {
        const now = new Date()
        const year = now.getFullYear()
        const month = String(now.getMonth() + 1).padStart(2, '0')
        const day = String(now.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
    }

    // 處理上午/下午變更
    const handlePeriodChange = (newPeriod: 'AM' | 'PM') => {
        // 如果沒有日期，使用今天 (Local)
        const targetDate = date || getTodayDateStr()
        const hours24 = convert12to24(time12, newPeriod)
        const newValue = `${targetDate}T${hours24}`
        onChange(newValue)
    }

    // 處理時間變更
    const handleTimeChange = (newTime12: string) => {
        // 如果沒有日期，使用今天 (Local)
        const targetDate = date || getTodayDateStr()
        const hours24 = convert12to24(newTime12, period)
        const newValue = `${targetDate}T${hours24}`
        onChange(newValue)
    }

    return (
        <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="grid grid-cols-2 gap-2">
                {/* 上午/下午選擇 */}
                <select
                    value={period}
                    onChange={(e) => handlePeriodChange(e.target.value as 'AM' | 'PM')}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-md p-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent hover:border-slate-400 dark:hover:border-slate-500"
                    required={required}
                >
                    <option value="AM">上午 (AM)</option>
                    <option value="PM">下午 (PM)</option>
                </select>

                {/* 時間選擇（12小時制下拉選單）*/}
                <select
                    value={time12}
                    onChange={(e) => handleTimeChange(e.target.value)}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-md p-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent hover:border-slate-400 dark:hover:border-slate-500"
                    required={required}
                >
                    {timeSlots.map(slot => (
                        <option key={slot} value={slot}>{slot}</option>
                    ))}
                </select>
            </div>
        </div>
    )
}
