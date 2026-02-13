'use client'

import { useState, useEffect } from 'react'
import { getEmployees, updateEmployee, type EmployeeData } from './actions'
import { PageContainer } from '@/components/ui/PageContainer'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Dialog, DialogContent, DialogHeader, DialogFooter } from '@/components/ui/Dialog'

export default function AdminEmployeesPage() {
    const [employees, setEmployees] = useState<EmployeeData[]>([])
    const [loading, setLoading] = useState(true)
    const [editingUser, setEditingUser] = useState<EmployeeData | null>(null)
    const [message, setMessage] = useState('')

    // Edit Form State
    const [formData, setFormData] = useState({
        displayName: '',
        employeeId: '',
        role: 'employee',
        onboardDate: '',
        annualLeaveTotal: 0
    })

    const fetchEmployees = async () => {
        setLoading(true)
        const res = await getEmployees()
        if (res.data) {
            setEmployees(res.data)
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchEmployees()
    }, [])

    const handleEdit = (employee: EmployeeData) => {
        setEditingUser(employee)
        setFormData({
            displayName: employee.display_name || '',
            employeeId: employee.employee_id || '',
            role: employee.role,
            onboardDate: employee.onboard_date || '',
            annualLeaveTotal: employee.annual_leave_total || 0
        })
        setMessage('')
    }

    const handleSave = async () => {
        if (!editingUser) return

        const data = new FormData()
        data.append('userId', editingUser.id)
        data.append('displayName', formData.displayName)
        data.append('employeeId', formData.employeeId)
        data.append('role', formData.role)
        if (formData.onboardDate) data.append('onboardDate', formData.onboardDate)
        data.append('annualLeaveTotal', String(formData.annualLeaveTotal))

        const res = await updateEmployee(null, data)

        if (res.success) {
            setEditingUser(null)
            fetchEmployees()
        } else {
            setMessage(res.error || '更新失敗')
        }
    }

    return (
        <PageContainer title="員工資料管理" description="設定員工基本資料、到職日與特休額度">
            <Card>
                {loading ? (
                    <div className="p-8 text-center text-slate-500">載入中...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800">
                                <tr>
                                    <th className="px-6 py-3">員工</th>
                                    <th className="px-6 py-3">角色</th>
                                    <th className="px-6 py-3">到職日</th>
                                    <th className="px-6 py-3">特休 (總/已用)</th>
                                    <th className="px-6 py-3">操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {employees.map((emp) => (
                                    <tr key={emp.id} className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                            <div>{emp.display_name || '未命名'}</div>
                                            <div className="text-xs text-slate-500">{emp.email}</div>
                                            {emp.employee_id && <div className="text-xs text-slate-400 font-mono">{emp.employee_id}</div>}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold 
                                                ${emp.role === 'super_admin' ? 'bg-purple-100 text-purple-700' :
                                                    emp.role === 'manager' ? 'bg-indigo-100 text-indigo-700' :
                                                        'bg-slate-100 text-slate-600'}`}>
                                                {emp.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                                            {emp.onboard_date || <span className="text-red-400 text-xs">未設定</span>}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-slate-700 dark:text-slate-300">
                                                    {emp.annual_leave_total}
                                                </span>
                                                <span className="text-slate-400">/</span>
                                                <span className="text-slate-500">
                                                    {emp.annual_leave_used}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <Button size="sm" variant="secondary" onClick={() => handleEdit(emp)}>
                                                編輯
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* Edit Dialog */}
            <Dialog isOpen={!!editingUser} onClose={() => setEditingUser(null)} maxWidth="md">
                <DialogHeader title="編輯員工資料" onClose={() => setEditingUser(null)} />
                <DialogContent>
                    <div className="grid gap-6 py-4">
                        {message && (
                            <div className="p-3 bg-red-50 text-red-600 rounded text-sm mb-2">{message}</div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">姓名</label>
                                <Input
                                    value={formData.displayName}
                                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">員工編號</label>
                                <Input
                                    value={formData.employeeId}
                                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                                    placeholder="EMP001"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">角色</label>
                                <select
                                    className="w-full flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-50"
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                >
                                    <option value="employee">Employee</option>
                                    <option value="manager">Manager</option>
                                    <option value="super_admin">Super Admin</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">到職日 (Onboard Date)</label>
                                <input
                                    type="date"
                                    className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-50"
                                    value={formData.onboardDate}
                                    onChange={(e) => setFormData({ ...formData, onboardDate: e.target.value })}
                                />
                                <p className="text-[10px] text-slate-500">特休計算的基準日期</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">本年度特休總天數 (Annual Leave Total)</label>
                            <Input
                                type="number"
                                step="0.5"
                                value={formData.annualLeaveTotal}
                                onChange={(e) => setFormData({ ...formData, annualLeaveTotal: parseFloat(e.target.value) })}
                            />
                            <p className="text-[10px] text-slate-500">可手動調整。系統亦會根據到職日自動計算(未來功能)。</p>
                        </div>
                    </div>
                </DialogContent>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setEditingUser(null)}>取消</Button>
                    <Button variant="primary" onClick={handleSave}>儲存變更</Button>
                </DialogFooter>
            </Dialog>
        </PageContainer>
    )
}
