'use client'

import { useState, useEffect } from 'react'
import { clockIn, clockOut } from '@/app/attendance/actions'

interface Props {
    userId: string
    userName: string
    userSettings: {
        work_start_time: string
        work_end_time: string
    }
    todayRecord: {
        clock_in_time: string | null
        clock_out_time: string | null
        status: string
        work_hours: number | string | null
    } | null
}

export default function ClockPanel({ userId, userName, userSettings, todayRecord }: Props) {
    const [time, setTime] = useState(new Date())
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')

    // 時鐘跳動
    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    const handleClockIn = async () => {
        setLoading(true)
        setMessage('')
        try {
            const res = await clockIn(userId)
            if (res.error) {
                setMessage(`❌ ${res.error}`)
            } else {
                setMessage(res.status === 'late' ? '⚠️ 上班打卡成功 (遲到)' : '✅ 上班打卡成功')
            }
        } catch (e) {
            setMessage('❌ 發生錯誤')
        } finally {
            setLoading(false)
        }
    }

    const handleClockOut = async () => {
        setLoading(true)
        setMessage('')
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
    }

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('zh-TW', { hour12: false })
    }

    // 判斷按鈕狀態
    const isClockedIn = !!todayRecord?.clock_in_time
    const isClockedOut = !!todayRecord?.clock_out_time

    return (
        <div className="flex flex-col items-center gap-6 p-8 rounded-xl bg-white border shadow-sm w-full max-w-md">
            <div className="text-center">
                <h2 className="text-xl text-gray-500 mb-2">{time.toLocaleDateString('zh-TW')}</h2>
                <div className="text-5xl font-mono font-bold text-gray-800 tracking-wider">
                    {formatTime(time)}
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
                                {new Date(todayRecord!.clock_in_time!).toLocaleTimeString('zh-TW', { hour12: false })}
                            </span>
                            <div className="flex gap-1 mt-1">
                                {todayRecord?.status.split(' ').map((s) => {
                                    const statusMap: Record<string, { label: string, color: string }> = {
                                        'normal': { label: '正常', color: 'bg-green-100 text-green-600' },
                                        'late': { label: '遲到', color: 'bg-orange-100 text-orange-600' },
                                        'early_leave': { label: '早退', color: 'bg-red-100 text-red-600' },
                                    }
                                    const info = statusMap[s] || { label: s, color: 'bg-gray-100 text-gray-600' }
                                    return (
                                        <span key={s} className={`text-xs px-2 py-0.5 rounded ${info.color}`}>
                                            {info.label}
                                        </span>
                                    )
                                })}
                            </div>
                        </div>

                        {isClockedOut && (
                            <div className="bg-green-50 text-green-700 px-6 py-2 rounded-lg flex flex-col items-center w-full mb-2">
                                <span className="font-bold">✨ 下班時間: {new Date(todayRecord!.clock_out_time!).toLocaleTimeString('zh-TW', { hour12: false })}</span>
                                <span className="text-xs">今日工時: {todayRecord?.work_hours} 小時</span>
                            </div>
                        )}

                        <button
                            onClick={handleClockOut}
                            disabled={loading}
                            className={`w-full py-4 text-white rounded-lg font-bold text-lg transition-all active:scale-95 disabled:opacity-50 ${isClockedOut ? 'bg-gray-400 hover:bg-gray-500' : 'bg-orange-500 hover:bg-orange-600'}`}
                        >
                            {loading ? '處理中...' : isClockedOut ? '重新下班打卡' : '下班打卡'}
                        </button>
                    </>
                ) : (
                    <button
                        onClick={handleClockIn}
                        disabled={loading}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-lg transition-all active:scale-95 disabled:opacity-50"
                    >
                        {loading ? '處理中...' : '上班打卡'}
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
