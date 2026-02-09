'use client'

import { useState, useEffect, useTransition } from 'react'
import { clockIn, clockOut } from '@/app/attendance/actions'
import { Database } from '@/types/supabase'

type AttendanceRow = Database['public']['Tables']['attendance']['Row']

interface Props {
    userId: string
    userName: string | null
    userSettings: {
        work_start_time: string
        work_end_time: string
    }
    todayRecord: AttendanceRow | null
}

export default function ClockPanel({
    userId,
    userName,
    userSettings,
    todayRecord: initialRecord,
}: Props) {
    const [time, setTime] = useState<Date | null>(null)
    const [mounted, setMounted] = useState(false)
    const [loading, setLoading] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [message, setMessage] = useState('')

    useEffect(() => {
        setMounted(true)
        setTime(new Date())
        const timer = setInterval(() => setTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    const handleClockIn = async () => {
        setLoading(true)
        setMessage('')
        startTransition(async () => {
            try {
                const res = await clockIn(userId)
                if (res.error) {
                    setMessage(`❌ ${res.error}`)
                } else {
                    setMessage('✅ 上班打卡成功')
                }
            } catch (e) {
                setMessage('❌ 發生錯誤')
            } finally {
                setLoading(false)
            }
        })
    }

    const handleClockOut = async () => {
        setLoading(true)
        setMessage('')
        startTransition(async () => {
            try {
                const res = await clockOut(userId)
                if (res.error) {
                    setMessage(`❌ ${res.error}`)
                } else {
                    setMessage('✅ 下班打卡成功')
                }
            } catch (e) {
                setMessage('❌ 發生錯誤')
            } finally {
                setLoading(false)
            }
        })
    }

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('zh-TW', { hour12: false })
    }

    // 判斷按鈕狀態
    const isClockedIn = !!initialRecord?.clock_in_time
    const isClockedOut = !!initialRecord?.clock_out_time

    // Custom status logic
    const recordAny = initialRecord as any
    const showLate = recordAny?.is_late || recordAny?.status === 'late'
    const showEarly = recordAny?.is_early_leave

    return (
        <div className="flex flex-col items-center gap-6 p-8 rounded-xl bg-white border shadow-sm w-full max-w-md transition-all">
            <div className="text-center">
                <h2 className="text-xl text-gray-500 mb-2">
                    {mounted && time ? time.toLocaleDateString('zh-TW') : <span className="opacity-0">Loading...</span>}
                </h2>
                <div className="text-5xl font-mono font-bold text-gray-800 tracking-wider min-h-[48px]">
                    {mounted && time ? formatTime(time) : <span className="opacity-0">00:00:00</span>}
                </div>
                <div className="text-sm text-gray-400 mt-2">
                    規定上下班: {userSettings.work_start_time?.slice(0, 5)} - {userSettings.work_end_time?.slice(0, 5)}
                </div>
            </div>

            <div className="w-full h-px bg-gray-100" />

            <div className="flex flex-col items-center gap-4 w-full">
                {isClockedIn ? (
                    <>
                        <div className="text-center mb-2">
                            <span className="block text-gray-500 text-sm">上班時間</span>
                            <span className="font-bold text-lg">
                                {initialRecord?.clock_in_time ? new Date(initialRecord.clock_in_time).toLocaleTimeString('zh-TW', { hour12: false }) : '--:--:--'}
                            </span>
                            <div className="flex gap-1 mt-1 justify-center">
                                {showLate && (
                                    <span className="text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-600">遲到</span>
                                )}
                                {showEarly && (
                                    <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-600">早退</span>
                                )}
                                {!showLate && !showEarly && (
                                    <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-600">正常</span>
                                )}
                            </div>
                        </div>

                        {isClockedOut && (
                            <div className="bg-green-50 text-green-700 px-6 py-2 rounded-lg flex flex-col items-center w-full mb-2 animate-in fade-in slide-in-from-bottom-2">
                                <span className="font-bold">✨ 下班時間: {initialRecord?.clock_out_time ? new Date(initialRecord.clock_out_time).toLocaleTimeString('zh-TW', { hour12: false }) : ''}</span>
                                <span className="text-xs">今日工時: {initialRecord?.work_hours} 小時</span>
                            </div>
                        )}

                        <button
                            onClick={handleClockOut}
                            disabled={loading || isPending}
                            className={`w-full py-4 text-white rounded-lg font-bold text-lg transition-all active:scale-95 disabled:opacity-50 ${isClockedOut ? 'bg-gray-400 hover:bg-gray-500' : 'bg-orange-500 hover:bg-orange-600'}`}
                        >
                            {loading || isPending ? '處理中...' : isClockedOut ? '重新下班打卡' : '下班打卡'}
                        </button>
                    </>
                ) : (
                    <button
                        onClick={handleClockIn}
                        disabled={loading || isPending}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-lg transition-all active:scale-95 disabled:opacity-50"
                    >
                        {loading || isPending ? '處理中...' : '上班打卡'}
                    </button>
                )}

                {message && (
                    <div className="mt-2 text-sm font-medium animate-pulse text-gray-700 text-center">
                        {message}
                    </div>
                )}
            </div>
        </div>
    )
}
