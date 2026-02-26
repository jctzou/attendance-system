'use client'

import { useState, useEffect } from 'react'
import { getEmployees, updateEmployee, createEmployee, type EmployeeData } from './actions'
import { PageContainer } from '@/components/ui/PageContainer'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Dialog, DialogContent, DialogHeader, DialogFooter } from '@/components/ui/Dialog'
import { AlertDialog } from '@/components/ui/ActionDialogs'

const ROLE_MAP: Record<string, string> = {
    employee: '一般員工 (Employee)',
    manager: '管理員 (Manager)',
    super_admin: '超級管理員 (Super Admin)'
}

export default function AdminEmployeesPage() {
    const [employees, setEmployees] = useState<EmployeeData[]>([])
    const [loading, setLoading] = useState(true)
    const [editingUser, setEditingUser] = useState<EmployeeData | null>(null)
    const [isCreating, setIsCreating] = useState(false)
    const [message, setMessage] = useState('')
    const [alertDialog, setAlertDialog] = useState({ isOpen: false, title: '', message: '' })

    // --- State for Edit Form ---
    const [editFormData, setEditFormData] = useState({
        userId: '',
        email: '',
        displayName: '',
        employeeId: '',
        role: 'employee',
        salaryType: 'monthly',
        salaryAmount: 0,
        workStartTime: '09:00',
        workEndTime: '18:00',
        onboardDate: '',
        resignDate: '',
        isActive: true,
        annualLeaveTotal: 0
    })

    // --- State for Create Form ---
    const [createFormData, setCreateFormData] = useState({
        email: '',
        password: '',
        displayName: '',
        employeeId: '',
        role: 'employee',
        salaryType: 'monthly',
        salaryAmount: 0,
        workStartTime: '09:00',
        workEndTime: '18:00',
        onboardDate: '',
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

    // --- Handlers ---

    const handleCreate = async () => {
        setMessage('')
        const data = new FormData()
        Object.entries(createFormData).forEach(([key, value]) => {
            data.append(key, String(value))
        })

        const res = await createEmployee(null, data)
        if (res.success) {
            setIsCreating(false)
            setCreateFormData({ // Reset
                email: '', password: '', displayName: '', employeeId: '', role: 'employee',
                salaryType: 'monthly', salaryAmount: 0, workStartTime: '09:00', workEndTime: '18:00', onboardDate: ''
            })
            fetchEmployees()
            setAlertDialog({ isOpen: true, title: '建立成功', message: '新員工資料已成功建立。' })
        } else {
            setMessage(res.error || '建立失敗')
        }
    }

    const handleEdit = (employee: EmployeeData) => {
        setEditingUser(employee)
        setEditFormData({
            userId: employee.id,
            email: employee.email || '',
            displayName: employee.display_name || '',
            employeeId: employee.employee_id || '',
            role: employee.role,
            salaryType: employee.salary_type || 'monthly',
            salaryAmount: employee.salary_amount || 0,
            workStartTime: employee.work_start_time?.slice(0, 5) || '09:00',
            workEndTime: employee.work_end_time?.slice(0, 5) || '18:00',
            onboardDate: employee.onboard_date || '',
            resignDate: employee.resign_date || '',
            isActive: employee.is_active,
            annualLeaveTotal: employee.annual_leave_total || 0
        })
        setMessage('')
    }

    const handleSave = async () => {
        if (!editingUser) return
        setMessage('')

        const data = new FormData()
        Object.entries(editFormData).forEach(([key, value]) => {
            data.append(key, String(value))
        })

        const res = await updateEmployee(null, data)

        if (res.success) {
            setEditingUser(null)
            fetchEmployees()
            setAlertDialog({ isOpen: true, title: '更新成功', message: '員工資料已成功儲存！' })
        } else {
            setMessage(res.error || '更新失敗')
        }
    }

    const [activeTab, setActiveTab] = useState<'profile' | 'salary' | 'schedule' | 'status'>('profile')

    return (
        <PageContainer
            title="員工資料管理"
            description="設定員工基本資料、薪資結構、排班與權限"
            action={
                <Button onClick={() => setIsCreating(true)}>
                    <span className="material-symbols-outlined text-sm mr-1">add</span>
                    新增員工
                </Button>
            }
        >
            <Card>
                {loading ? (
                    <div className="p-8 text-center text-slate-500">載入中...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-neutral-800">
                                <tr>
                                    <th className="px-6 py-3">員工 / Email</th>
                                    <th className="px-6 py-3">角色 / 狀態</th>
                                    <th className="px-6 py-3">到職日</th>
                                    <th className="px-6 py-3">薪制</th>
                                    <th className="px-6 py-3">特休</th>
                                    <th className="px-6 py-3">操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {employees.map((emp) => (
                                    <tr key={emp.id} className={`border-b border-slate-100 dark:border-neutral-800 hover:bg-slate-50 dark:hover:bg-neutral-800/50 ${!emp.is_active ? 'opacity-60 bg-slate-50' : 'bg-white dark:bg-neutral-900'}`}>
                                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                            <div className="flex items-center gap-2">
                                                <span>{emp.display_name || '未命名'}</span>
                                                {!emp.is_active && <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded">離職</span>}
                                            </div>
                                            <div className="text-xs text-slate-500">{emp.email}</div>
                                            {emp.employee_id && <div className="text-xs text-slate-400 font-mono">{emp.employee_id}</div>}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold mr-2 
                                                ${emp.role === 'super_admin' ? 'bg-purple-100 text-purple-700' :
                                                    emp.role === 'manager' ? 'bg-indigo-100 text-indigo-700' :
                                                        'bg-slate-100 text-slate-600'}`}>
                                                {ROLE_MAP[emp.role] || emp.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-neutral-400">
                                            {emp.onboard_date || <span className="text-slate-300">-</span>}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs">
                                                {emp.salary_type === 'monthly' ? '月薪' : '時薪'}
                                                <div className="text-slate-500 font-mono">${emp.salary_amount?.toLocaleString()}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-bold text-slate-700 dark:text-neutral-300">{emp.annual_leave_total}</span>
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

            {/* Create Dialog */}
            <Dialog isOpen={isCreating} onClose={() => setIsCreating(false)} maxWidth="lg">
                <DialogHeader title="建立新員工" onClose={() => setIsCreating(false)} />
                <DialogContent>
                    <div className="max-h-[70vh] overflow-y-auto px-1 py-2">
                        {message && <div className="p-3 bg-red-50 text-red-600 rounded text-sm mb-4">{message}</div>}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Account */}
                            <div className="space-y-4 border p-4 rounded-lg bg-slate-50/50">
                                <h3 className="font-bold text-slate-700">帳號設定</h3>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Email <span className="text-red-500">*</span></label>
                                    <Input value={createFormData.email} onChange={e => setCreateFormData({ ...createFormData, email: e.target.value })} placeholder="user@example.com" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">預設密碼 <span className="text-red-500">*</span></label>
                                    <Input type="password" value={createFormData.password} onChange={e => setCreateFormData({ ...createFormData, password: e.target.value })} placeholder="至少 6 碼" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">權限角色</label>
                                    <select className="w-full p-2 border rounded text-sm" value={createFormData.role} onChange={e => setCreateFormData({ ...createFormData, role: e.target.value })}>
                                        <option value="employee">{ROLE_MAP['employee']}</option>
                                        <option value="manager">{ROLE_MAP['manager']}</option>
                                        <option value="super_admin">{ROLE_MAP['super_admin']}</option>
                                    </select>
                                </div>
                            </div>

                            {/* Profile */}
                            <div className="space-y-4 border p-4 rounded-lg bg-white">
                                <h3 className="font-bold text-slate-700">基本資料</h3>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">姓名 <span className="text-red-500">*</span></label>
                                    <Input value={createFormData.displayName} onChange={e => setCreateFormData({ ...createFormData, displayName: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">員工編號</label>
                                    <Input value={createFormData.employeeId} onChange={e => setCreateFormData({ ...createFormData, employeeId: e.target.value })} placeholder="EMP-001" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">到職日</label>
                                    <Input type="date" value={createFormData.onboardDate} onChange={e => setCreateFormData({ ...createFormData, onboardDate: e.target.value })} />
                                </div>
                            </div>

                            {/* Salary & Schedule */}
                            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 border p-4 rounded-lg bg-white">
                                <div className="space-y-4">
                                    <h3 className="font-bold text-slate-700">薪資設定</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">薪制</label>
                                            <select className="w-full p-2 border rounded text-sm" value={createFormData.salaryType} onChange={e => setCreateFormData({ ...createFormData, salaryType: e.target.value })}>
                                                <option value="monthly">月薪</option>
                                                <option value="hourly">時薪</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">金額</label>
                                            <Input type="number" value={createFormData.salaryAmount} onChange={e => setCreateFormData({ ...createFormData, salaryAmount: parseFloat(e.target.value) })} />
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h3 className="font-bold text-slate-700">排班設定</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">上班時間</label>
                                            <Input type="time" value={createFormData.workStartTime} onChange={e => setCreateFormData({ ...createFormData, workStartTime: e.target.value })} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">下班時間</label>
                                            <Input type="time" value={createFormData.workEndTime} onChange={e => setCreateFormData({ ...createFormData, workEndTime: e.target.value })} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsCreating(false)}>取消</Button>
                    <Button variant="primary" onClick={handleCreate}>建立員工</Button>
                </DialogFooter>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog isOpen={!!editingUser} onClose={() => setEditingUser(null)} maxWidth="lg">
                <DialogHeader title="編輯員工資料" onClose={() => setEditingUser(null)} />
                <DialogContent>
                    <div className="flex border-b border-slate-200 dark:border-neutral-700 mb-6">
                        {(['profile', 'salary', 'schedule', 'status'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === tab
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                {tab === 'profile' && '基本資料'}
                                {tab === 'salary' && '薪資與特休'}
                                {tab === 'schedule' && '排班時間'}
                                {tab === 'status' && '在職狀態'}
                            </button>
                        ))}
                    </div>

                    <div className="py-2 min-h-[300px]">
                        {message && <div className="p-3 bg-red-50 text-red-600 rounded text-sm mb-4">{message}</div>}

                        {/* PROFILE TAB */}
                        {activeTab === 'profile' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-left-4 duration-300">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Email (登入帳號)</label>
                                    <Input value={editFormData.email} onChange={e => setEditFormData({ ...editFormData, email: e.target.value })} />
                                    <p className="text-[10px] text-orange-500">注意：修改 Email 會直接變更使用者的登入帳號。</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">權限角色</label>
                                    <select className="w-full p-2 border rounded text-sm bg-transparent" value={editFormData.role} onChange={e => setEditFormData({ ...editFormData, role: e.target.value })}>
                                        <option value="employee">{ROLE_MAP['employee']}</option>
                                        <option value="manager">{ROLE_MAP['manager']}</option>
                                        <option value="super_admin">{ROLE_MAP['super_admin']}</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">姓名</label>
                                    <Input value={editFormData.displayName} onChange={e => setEditFormData({ ...editFormData, displayName: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">員工編號</label>
                                    <Input value={editFormData.employeeId} onChange={e => setEditFormData({ ...editFormData, employeeId: e.target.value })} />
                                </div>
                            </div>
                        )}

                        {/* SALARY TAB */}
                        {activeTab === 'salary' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-left-4 duration-300">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">薪制</label>
                                    <select className="w-full p-2 border rounded text-sm bg-transparent" value={editFormData.salaryType} onChange={e => setEditFormData({ ...editFormData, salaryType: e.target.value })}>
                                        <option value="monthly">月薪</option>
                                        <option value="hourly">時薪</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">金額 (本薪/時薪)</label>
                                    <Input type="number" value={editFormData.salaryAmount} onChange={e => setEditFormData({ ...editFormData, salaryAmount: parseFloat(e.target.value) })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">到職日</label>
                                    <Input type="date" value={editFormData.onboardDate} onChange={e => setEditFormData({ ...editFormData, onboardDate: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">年度特休總額</label>
                                    <Input type="number" step="0.5" value={editFormData.annualLeaveTotal} onChange={e => setEditFormData({ ...editFormData, annualLeaveTotal: parseFloat(e.target.value) })} />
                                </div>
                            </div>
                        )}

                        {/* SCHEDULE TAB */}
                        {activeTab === 'schedule' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-left-4 duration-300">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">上班時間 (Work Start)</label>
                                    <Input type="time" value={editFormData.workStartTime} onChange={e => setEditFormData({ ...editFormData, workStartTime: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">下班時間 (Work End)</label>
                                    <Input type="time" value={editFormData.workEndTime} onChange={e => setEditFormData({ ...editFormData, workEndTime: e.target.value })} />
                                </div>
                                <div className="col-span-2 text-sm text-slate-500 bg-slate-50 p-3 rounded">
                                    <p>說明：系統使用此時間判定遲到與早退。請確保格式為 24 小時制 (HH:mm)。</p>
                                </div>
                            </div>
                        )}

                        {/* STATUS TAB */}
                        {activeTab === 'status' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">離職日期 (Resign Date)</label>
                                    <Input type="date" value={editFormData.resignDate} onChange={e => setEditFormData({ ...editFormData, resignDate: e.target.value })} />
                                    <p className="text-[10px] text-slate-500">設定離職日後，員工將視為離職狀態。</p>
                                </div>

                                <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50">
                                    <div>
                                        <h4 className="font-bold text-slate-700">帳號啟用狀態</h4>
                                        <p className="text-xs text-slate-500">關閉後，該使用者將立即無法登入系統。</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={editFormData.isActive} onChange={e => setEditFormData({ ...editFormData, isActive: e.target.checked })} />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>

                                {activeTab === 'status' && !editFormData.isActive && (
                                    <div className="p-3 bg-red-100 text-red-700 rounded text-sm items-center flex gap-2">
                                        <span className="material-symbols-outlined">warning</span>
                                        此帳號目前處於停用狀態 (Banned)。
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </DialogContent>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setEditingUser(null)}>取消</Button>
                    <Button variant="primary" onClick={handleSave}>儲存變更</Button>
                </DialogFooter>
            </Dialog>

            {/* AlertDialog */}
            <AlertDialog
                isOpen={alertDialog.isOpen}
                title={alertDialog.title}
                message={alertDialog.message}
                onConfirm={() => setAlertDialog(prev => ({ ...prev, isOpen: false }))}
            />
        </PageContainer>
    )
}
