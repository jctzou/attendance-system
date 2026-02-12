
'use client'

import React, { useState, useEffect } from 'react'
import { updateUserSalarySettings } from '../actions'
import { Dialog, DialogContent, DialogHeader, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input, Label } from '@/components/ui/Input'

interface User {
    id: string
    display_name: string
    salary_type: 'monthly' | 'hourly'
    salary_amount: number
    employee_id?: string
}

interface Props {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void // Trigger re-fetch
    users: User[]
}

export const SalarySettingsDialog: React.FC<Props> = ({ isOpen, onClose, onSuccess, users }) => {
    const [view, setView] = useState<'LIST' | 'EDIT'>('LIST')
    const [editingUser, setEditingUser] = useState<User | null>(null)

    // Edit Form State
    const [salaryType, setSalaryType] = useState<'monthly' | 'hourly'>('monthly')
    const [amount, setAmount] = useState<string>('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (isOpen) {
            setView('LIST')
            setEditingUser(null)
            setSaving(false)
        }
    }, [isOpen])

    const handleEditClick = (user: User) => {
        setEditingUser(user)
        setSalaryType(user.salary_type || 'monthly')
        setAmount(user.salary_amount?.toString() || '')
        setView('EDIT')
    }

    const handleSave = async () => {
        if (!editingUser) return

        const numAmount = parseFloat(amount)
        if (isNaN(numAmount) || numAmount < 0) {
            alert('請輸入有效的金額')
            return
        }

        setSaving(true)
        try {
            const res = await updateUserSalarySettings(editingUser.id, salaryType, numAmount)
            if (res.error) {
                alert('更新失敗: ' + res.error)
            } else {
                // local update
                editingUser.salary_type = salaryType
                editingUser.salary_amount = numAmount

                setView('LIST')
                onSuccess()
            }
        } catch (e) {
            alert('系統錯誤')
            console.error(e)
        } finally {
            setSaving(false)
        }
    }

    // LIST VIEW CONTENT
    const ListView = (
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase text-xs tracking-wider font-bold">
                    <tr>
                        <th className="px-4 py-3 rounded-l-lg">員工姓名</th>
                        <th className="px-4 py-3">類型</th>
                        <th className="px-4 py-3">金額</th>
                        <th className="px-4 py-3 rounded-r-lg text-right">操作</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {users.map(user => (
                        <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 group transition-colors">
                            <td className="px-4 py-4 font-bold text-slate-700 dark:text-slate-200">
                                {user.display_name}
                                <div className="text-xs text-slate-400 font-normal">{user.employee_id}</div>
                            </td>
                            <td className="px-4 py-4">
                                <span className={`px-2 py-1 text-xs rounded-lg font-bold ${user.salary_type === 'hourly'
                                    ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
                                    : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                                    }`}>
                                    {user.salary_type === 'hourly' ? '鐘點' : '月薪'}
                                </span>
                            </td>
                            <td className="px-4 py-4 font-mono text-slate-600 dark:text-slate-300">
                                ${user.salary_amount?.toLocaleString()}
                            </td>
                            <td className="px-4 py-4 text-right">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleEditClick(user)}
                                >
                                    修改
                                </Button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )

    // EDIT VIEW CONTENT
    const EditView = (
        <div className="space-y-6">
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 text-center">
                <div className="text-sm text-slate-400 mb-1">正在編輯</div>
                <div className="text-xl font-bold text-slate-800 dark:text-slate-200">{editingUser?.display_name}</div>
            </div>

            <div>
                <Label>薪資類型</Label>
                <div className="grid grid-cols-2 gap-4">
                    <button
                        type="button"
                        onClick={() => setSalaryType('monthly')}
                        className={`p-4 rounded-xl border text-center transition-all ${salaryType === 'monthly'
                            ? 'border-[var(--color-primary)] bg-orange-50 dark:bg-orange-900/20 text-[var(--color-primary)] ring-1 ring-[var(--color-primary)]'
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                    >
                        <div className="font-bold">月薪制</div>
                        <div className="text-xs opacity-70">固定月薪</div>
                    </button>
                    <button
                        type="button"
                        onClick={() => setSalaryType('hourly')}
                        className={`p-4 rounded-xl border text-center transition-all ${salaryType === 'hourly'
                            ? 'border-[var(--color-primary)] bg-orange-50 dark:bg-orange-900/20 text-[var(--color-primary)] ring-1 ring-[var(--color-primary)]'
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                    >
                        <div className="font-bold">鐘點制</div>
                        <div className="text-xs opacity-70">時薪計算</div>
                    </button>
                </div>
            </div>

            <Input
                label={salaryType === 'monthly' ? '月薪金額' : '每小時工資'}
                value={amount}
                onChange={(e) => {
                    const val = e.target.value
                    if (val === '' || /^\d*\.?\d*$/.test(val)) setAmount(val)
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
                placeholder="0"
                autoFocus
            />
        </div>
    )

    return (
        <Dialog isOpen={isOpen} onClose={onClose} maxWidth={view === 'LIST' ? '2xl' : 'md'}>
            <DialogHeader
                title={view === 'LIST' ? '員工薪資設定' : '修改設定'}
                onClose={onClose}
            />

            <DialogContent className={view === 'LIST' ? 'p-0' : ''}>
                {view === 'LIST' ? ListView : EditView}
            </DialogContent>

            {view === 'EDIT' && (
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setView('LIST')}>返回</Button>
                    <Button onClick={handleSave} isLoading={saving}>確認儲存</Button>
                </DialogFooter>
            )}
        </Dialog>
    )
}
