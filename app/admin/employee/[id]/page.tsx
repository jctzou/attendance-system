'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { getEmployeeDetails, getEmployeeAttendance, getEmployeeLeaves } from '../actions'
import Link from 'next/link'

export default function EmployeeDetailPage() {
    const params = useParams()
    const searchParams = useSearchParams()
    const userId = params.id as string
    const monthParam = searchParams.get('month')

    const [yearMonth, setYearMonth] = useState(monthParam || '')
    const [employee, setEmployee] = useState<any>(null)
    const [attendance, setAttendance] = useState<any[]>([])
    const [leaves, setLeaves] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [viewMode, setViewMode] = useState<'day' | 'week'>('day')

    useEffect(() => {
        if (!yearMonth) {
            const now = new Date()
            const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
            setYearMonth(currentMonth)
        }
    }, [])

    useEffect(() => {
        if (userId && yearMonth) {
            fetchData()
        }
    }, [userId, yearMonth])

    const fetchData = async () => {
        setLoading(true)

        const [empRes, attRes, leaveRes] = await Promise.all([
            getEmployeeDetails(userId),
            getEmployeeAttendance(userId, yearMonth),
            getEmployeeLeaves(userId, yearMonth)
        ])

        if (empRes.data) setEmployee(empRes.data)
        if (attRes.data) setAttendance(attRes.data)
        if (leaveRes.data) setLeaves(leaveRes.data)

        setLoading(false)
    }

    const getDaysInMonth = () => {
        const [year, month] = yearMonth.split('-')
        return new Date(parseInt(year), parseInt(month), 0).getDate()
    }

    const getAttendanceForDate = (date: string) => {
        return attendance.find(a => a.work_date === date)
    }

    const getLeaveForDate = (date: string) => {
        return leaves.find(l => {
            const leaveStart = new Date(l.start_date)
            const leaveEnd = new Date(l.end_date)
            const checkDate = new Date(date)
            return checkDate >= leaveStart && checkDate <= leaveEnd
        })
    }

    const renderDayView = () => {
        const daysInMonth = getDaysInMonth()
        const [year, month] = yearMonth.split('-')
        const days = []

        for (let day = 1; day <= daysInMonth; day++) {
            const date = `${year}-${month}-${String(day).padStart(2, '0')}`
            const att = getAttendanceForDate(date)
            const leave = getLeaveForDate(date)
            const dayOfWeek = new Date(date).getDay()
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

            days.push(
                <div key={date} className={`border p-3 rounded ${isWeekend ? 'bg-gray-50' : 'bg-white'}`}>
                    <div className="font-bold text-sm mb-2">{day}日</div>
                    {leave ? (
                        <div className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                            🏖️ {leave.leave_type}
                        </div>
                    ) : att ? (
                        <div className="text-xs space-y-1">
                            <div className="text-green-600">✓ 已打卡</div>
                            <div>上班: {att.clock_in_time ? new Date(att.clock_in_time).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : '-'}</div>
                            <div>下班: {att.clock_out_time ? new Date(att.clock_out_time).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : '-'}</div>
                            <div>工時: {att.work_hours || '-'} hr</div>
                            {att.status !== 'normal' && (
                                <div className="text-red-600">{att.status === 'late' ? '遲到' : att.status === 'early_leave' ? '早退' : '遲到早退'}</div>
                            )}
                        </div>
                    ) : (
                        <div className="text-xs text-gray-400">無記錄</div>
                    )}
                </div>
            )
        }

        return <div className="grid grid-cols-7 gap-2">{days}</div>
    }

    const renderWeekView = () => {
        // 簡化版週視圖，顯示每週總工時
        const daysInMonth = getDaysInMonth()
        const [year, month] = yearMonth.split('-')
        const weeks: any[] = []
        let currentWeek: any[] = []

        for (let day = 1; day <= daysInMonth; day++) {
            const date = `${year}-${month}-${String(day).padStart(2, '0')}`
            const dayOfWeek = new Date(date).getDay()

            currentWeek.push({ date, dayOfWeek })

            if (dayOfWeek === 0 || day === daysInMonth) {
                weeks.push([...currentWeek])
                currentWeek = []
            }
        }

        return (
            <div className="space-y-4">
                {weeks.map((week, idx) => {
                    const weekHours = week.reduce((sum: number, day: any) => {
                        const att = getAttendanceForDate(day.date)
                        return sum + (att?.work_hours ? parseFloat(att.work_hours) : 0)
                    }, 0)

                    return (
                        <div key={idx} className="border rounded-lg p-4 bg-white">
                            <div className="font-bold mb-2">第 {idx + 1} 週 - 總工時: {weekHours.toFixed(2)} hr</div>
                            <div className="grid grid-cols-7 gap-2">
                                {week.map((day: any) => {
                                    const att = getAttendanceForDate(day.date)
                                    const leave = getLeaveForDate(day.date)
                                    return (
                                        <div key={day.date} className="text-center text-sm">
                                            <div className="text-gray-500">{day.date.split('-')[2]}</div>
                                            {leave ? (
                                                <div className="text-yellow-600">🏖️</div>
                                            ) : att ? (
                                                <div className="text-green-600">{att.work_hours || '-'}</div>
                                            ) : (
                                                <div className="text-gray-300">-</div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}
            </div>
        )
    }

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center">載入中...</div>
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white border-b shadow-sm h-16 flex items-center justify-between px-6">
                <div className="font-bold text-lg text-blue-600">👤 員工詳細記錄</div>
                <Link href="/admin/salary" className="text-sm text-gray-600 hover:text-gray-900">
                    ← 返回薪資管理
                </Link>
            </nav>

            <div className="max-w-7xl mx-auto py-10 px-4">
                {employee && (
                    <div className="bg-white rounded-lg shadow p-6 mb-6">
                        <h2 className="text-2xl font-bold mb-2">{employee.display_name}</h2>
                        <div className="text-gray-600 space-y-1">
                            <div>員工編號: {employee.employee_id}</div>
                            <div>Email: {employee.email}</div>
                            <div>類型: {employee.salary_type === 'hourly' ? '鐘點人員' : '月薪人員'}</div>
                        </div>
                    </div>
                )}

                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <label className="font-bold text-gray-700">選擇月份：</label>
                        <input
                            type="month"
                            value={yearMonth}
                            onChange={(e) => setYearMonth(e.target.value)}
                            className="px-4 py-2 border rounded-md"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setViewMode('day')}
                            className={`px-4 py-2 rounded-md ${viewMode === 'day' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                        >
                            日視圖
                        </button>
                        <button
                            onClick={() => setViewMode('week')}
                            className={`px-4 py-2 rounded-md ${viewMode === 'week' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                        >
                            週視圖
                        </button>
                    </div>
                </div>

                {viewMode === 'day' ? renderDayView() : renderWeekView()}
            </div>
        </div>
    )
}
