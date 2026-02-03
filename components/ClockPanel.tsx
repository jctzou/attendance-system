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
                {isClockedOut ? (
                    <div className="bg-green-50 text-green-700 px-6 py-4 rounded-lg flex flex-col items-center">
                        <span className="font-bold text-xl">🎉 今日已完工</span>
                        <span className="text-sm mt-1">
                            工時: {todayRecord?.clock_in_time ?
                                ((new Date(todayRecord.clock_out_time!).getTime() - new Date(todayRecord.clock_in_time).getTime()) / 3600000).toFixed(2)
                                : 0} 小時
                        </span>
                    </div>
                ) : isClockedIn ? (
                    <>
                        <div className="text-center mb-2">
                            <span className="block text-gray-500 text-sm">上班時間</span>
                            <span className="font-bold text-lg">
                                {new Date(todayRecord!.clock_in_time!).toLocaleTimeString('zh-TW', { hour12: false })}
                            </span>
                            <span className={`ml-2 text-xs px-2 py-0.5 rounded ${todayRecord?.status === 'late' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                {todayRecord?.status === 'late' ? '遲到' : '正常'}
                            </span>
                        </div>
                        <button
                            onClick={handleClockOut}
                            disabled={loading}
                            className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold text-lg transition-all active:scale-95 disabled:opacity-50"
                        >
                            {loading ? '處理中...' : '下班打卡'}
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
                    <div className="mt-2 text-sm font-medium animate-pulse text-gray-700">
                        {message}
                    </div>
                )}
            </div>
        </div>
    )
}
