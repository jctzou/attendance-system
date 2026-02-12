'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
    getUserProfile,
    getAllEmployees,
    getMyMonthlyAttendance,
    getMyMonthlyLeaves,
    getEmployeeAttendanceRecords,
    getEmployeeLeaveRecords
} from './actions'
import { createClient } from '@/utils/supabase/client'
import AttendanceActionDialog from '@/components/AttendanceActionDialog'
import AttendanceLogDialog from '@/components/AttendanceLogDialog'
import { PageContainer } from '@/components/ui/PageContainer'
import { Card } from '@/components/ui/Card'
import { DayCard } from '@/components/attendance/DayCard'



export default function AttendancePage() {
    const searchParams = useSearchParams()
    const employeeParam = searchParams.get('employee')
    const monthParam = searchParams.get('month')

    const [currentUser, setCurrentUser] = useState<any>(null)
    const [isManager, setIsManager] = useState(false)
    const [employees, setEmployees] = useState<any[]>([])
    const [selectedEmployee, setSelectedEmployee] = useState<string>('')
    const [yearMonth, setYearMonth] = useState('')
    const [attendance, setAttendance] = useState<any[]>([])
    const [leaves, setLeaves] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // 對話框狀態
    const [dialogState, setDialogState] = useState<{
        isOpen: boolean
        date: string
        record?: any
        leave?: any
    }>({
        isOpen: false,
        date: '',
    })

    // 修改記錄對話框狀態
    const [logDialogState, setLogDialogState] = useState<{
        isOpen: boolean
        attendanceId?: number
    }>({
        isOpen: false,
    })

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

            // 如果是管理員,獲取員工列表
            if (isManagerRole) {
                const empRes = await getAllEmployees()
                if (empRes.data) {
                    // 排序:管理員角色在前,其他員工在後
                    const sortedEmployees = empRes.data.sort((a: any, b: any) => {
                        const aIsManager = ['manager', 'super_admin'].includes(a.role)
                        const bIsManager = ['manager', 'super_admin'].includes(b.role)
                        if (aIsManager && !bIsManager) return -1
                        if (!aIsManager && bIsManager) return 1
                        return 0
                    })
                    setEmployees(sortedEmployees)
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

    const fetchData = async (showLoading = true) => {
        if (showLoading) setLoading(true)
        try {
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
        } finally {
            if (showLoading) setLoading(false)
        }
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

    const handleDateClick = (date: string) => {
        const existingRecord = getAttendanceForDate(date)
        const leaveRecord = getLeaveForDate(date)

        setDialogState({
            isOpen: true,
            date,
            record: existingRecord,
            leave: leaveRecord
        })
    }

    const handleDialogSuccess = () => {
        setDialogState({ isOpen: false, date: '' })
        // Background refresh without spinner for "Real-time" feel
        fetchData(false)
    }



    const renderDayView = () => {
        const daysInMonth = getDaysInMonth()
        const [year, month] = yearMonth.split('-')
        const days = []

        const selectedEmployeeData = employees.find(e => e.id === selectedEmployee) || currentUser
        const isHourly = selectedEmployeeData?.salary_type === 'hourly'

        for (let day = 1; day <= daysInMonth; day++) {
            const date = `${year}-${month}-${String(day).padStart(2, '0')}`
            const att = getAttendanceForDate(date)
            const leave = getLeaveForDate(date)

            days.push(
                <DayCard
                    key={date}
                    date={date}
                    attendance={att}
                    leave={leave}
                    isHourly={isHourly}
                    onClick={handleDateClick}
                    onEditClick={(id) => setLogDialogState({ isOpen: true, attendanceId: id })}
                />
            )
        }

        return <div className="grid grid-cols-1 md:grid-cols-7 gap-3">{days}</div>
    }

    const selectedEmployeeData = employees.find(e => e.id === selectedEmployee) || currentUser

    return (
        <PageContainer title="打卡記錄" description="查看與管理出勤紀錄">
            <Card className="mb-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-2">
                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                        {isManager && (
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <label className="font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">員工：</label>
                                <select
                                    value={selectedEmployee}
                                    onChange={(e) => setSelectedEmployee(e.target.value)}
                                    className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 w-full sm:w-auto focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                                >
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.display_name} ({emp.employee_id})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <label className="font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">月份：</label>
                            <input
                                type="month"
                                value={yearMonth}
                                onChange={(e) => setYearMonth(e.target.value)}
                                className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 w-full sm:w-auto focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                            />
                        </div>
                    </div>
                </div>

                {selectedEmployeeData && isManager && selectedEmployee !== currentUser?.id && (
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 mx-2 mb-4 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                            <span className="font-bold">{selectedEmployeeData.display_name}</span>
                            <span>({selectedEmployeeData.employee_id})</span>
                            {selectedEmployeeData.salary_type === 'hourly' && (
                                <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full">時薪制</span>
                            )}
                        </div>
                    </div>
                )}
            </Card>

            {loading ? (
                <div className="text-center py-20 text-slate-400">載入中...</div>
            ) : (
                renderDayView()
            )}

            {/* 用戶交互 Dialog */}
            {dialogState.isOpen && (
                <AttendanceActionDialog
                    date={dialogState.date}
                    existingRecord={dialogState.record}
                    existingLeave={dialogState.leave}
                    onClose={() => setDialogState({ isOpen: false, date: '' })}
                    onSuccess={handleDialogSuccess}
                    isAdmin={isManager}
                />
            )}

            {/* Log Dialog */}
            {logDialogState.isOpen && logDialogState.attendanceId && (
                <AttendanceLogDialog
                    attendanceId={logDialogState.attendanceId}
                    onClose={() => setLogDialogState({ isOpen: false })}
                />
            )}
        </PageContainer>
    )
}
