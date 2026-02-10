'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
    getMyMonthlyAttendance,
    getMyMonthlyLeaves,
    getEmployeeAttendanceRecords,
    getEmployeeLeaveRecords,
    getAllEmployees,
    getUserProfile
} from './actions'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'

export default function AttendancePage() {
    const searchParams = useSearchParams()
    const employeeParam = searchParams.get('employee')
    const monthParam = searchParams.get('month')

    const [yearMonth, setYearMonth] = useState('')
    const [currentUser, setCurrentUser] = useState<any>(null)
    const [selectedEmployee, setSelectedEmployee] = useState<string>('')
    const [employees, setEmployees] = useState<any[]>([])
    const [attendance, setAttendance] = useState<any[]>([])
    const [leaves, setLeaves] = useState<any[]>([])
    const [viewMode, setViewMode] = useState<'day' | 'week'>('day')
    const [loading, setLoading] = useState(true)
    const [isManager, setIsManager] = useState(false)

    useEffect(() => {
        initPage()
    }, [])

    useEffect(() => {
        if (yearMonth && currentUser) {
            fetchData()
        }
    }, [yearMonth, selectedEmployee, currentUser])

    const initPage = async () => {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) return

        // 獲取當前使用者資料
        const profileRes = await getUserProfile()
        if (profileRes.data) {
            setCurrentUser(profileRes.data)
            const isManagerRole = ['manager', 'super_admin'].includes(profileRes.data.role)
            setIsManager(isManagerRole)

            // 如果是管理員，獲取員工列表
            if (isManagerRole) {
                const empRes = await getAllEmployees()
                if (empRes.data) {
                    setEmployees(empRes.data)
                }
            }

            // 設定選擇的員工
            if (employeeParam && isManagerRole) {
                setSelectedEmployee(employeeParam)
            } else {
                setSelectedEmployee(user.id)
            }
        }

        // 設定月份
        if (monthParam) {
            setYearMonth(monthParam)
        } else {
            const now = new Date()
            const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
            setYearMonth(currentMonth)
        }
    }

    const fetchData = async () => {
        setLoading(true)

        let attRes, leaveRes

        if (isManager && selectedEmployee !== currentUser?.id) {
            // 管理員查看其他員工
            attRes = await getEmployeeAttendanceRecords(selectedEmployee, yearMonth)
            leaveRes = await getEmployeeLeaveRecords(selectedEmployee, yearMonth)
        } else {
            // 查看自己
            attRes = await getMyMonthlyAttendance(yearMonth)
            leaveRes = await getMyMonthlyLeaves(yearMonth)
        }

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

    const selectedEmployeeData = employees.find(e => e.id === selectedEmployee) || currentUser

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white border-b shadow-sm h-16 flex items-center justify-between px-6">
                <div className="font-bold text-lg text-blue-600">📋 打卡記錄</div>
                <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
                    ← 回首頁
                </Link>
            </nav>

            <div className="max-w-7xl mx-auto py-10 px-4">
                {selectedEmployeeData && (
                    <div className="bg-white rounded-lg shadow p-6 mb-6">
                        <h2 className="text-2xl font-bold mb-2">{selectedEmployeeData.display_name}</h2>
                        <div className="text-gray-600 space-y-1">
                            <div>員工編號: {selectedEmployeeData.employee_id}</div>
                            <div>Email: {selectedEmployeeData.email}</div>
                        </div>
                    </div>
                )}

                <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                        {isManager && (
                            <>
                                <label className="font-bold text-gray-700">員工：</label>
                                <select
                                    value={selectedEmployee}
                                    onChange={(e) => setSelectedEmployee(e.target.value)}
                                    className="px-4 py-2 border rounded-md"
                                >
                                    <option value={currentUser?.id}>我自己</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.display_name} ({emp.employee_id})
                                        </option>
                                    ))}
                                </select>
                            </>
                        )}
                        <label className="font-bold text-gray-700">月份：</label>
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
