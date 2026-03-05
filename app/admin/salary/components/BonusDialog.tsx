
'use client'

import React, { useState, useEffect } from 'react'
import { updateBonus } from '../actions'
import { Dialog, DialogContent, DialogHeader, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input, Label } from '@/components/ui/Input'

interface Props {
    isOpen: boolean
    userId: string
    displayName: string
    yearMonth: string
    currentBonus: number
    currentNotes: string
    onClose: () => void
    onSuccess: () => void
}

export const BonusDialog: React.FC<Props> = ({
    isOpen, userId, displayName, yearMonth, currentBonus, currentNotes, onClose, onSuccess
}) => {
    const [amount, setAmount] = useState('')
    const [notes, setNotes] = useState('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [saved, setSaved] = useState(false)

    useEffect(() => {
        if (isOpen) {
            setAmount(currentBonus.toString())
            setNotes(currentNotes || '')
            setSaving(false)
            setError(null)
            setSaved(false)
        }
    }, [isOpen, currentBonus, currentNotes])

    const handleSave = async () => {
        const numAmount = parseFloat(amount)
        if (isNaN(numAmount) || numAmount < 0) {
            setError('請輸入有效的獎金金額（不可為負數）')
            return
        }

        setSaving(true)
        setError(null)
        setSaved(false)
        try {
            const res = await updateBonus(userId, yearMonth, numAmount, notes)
            if (res.error) {
                setError(res.error)
            } else {
                setSaved(true)  // 顯示成功提示，不關閉 Dialog
                onSuccess()     // 通知 parent 刷新資料
            }
        } catch (e) {
            setError('發生系統錯誤，請稍後再試')
            console.error(e)
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog isOpen={isOpen} onClose={onClose} maxWidth="sm">
            <DialogHeader title="設定獎金" onClose={onClose} />

            <DialogContent className="space-y-4">
                <div className="bg-slate-50 dark:bg-neutral-800 p-3 rounded-xl border border-slate-100 dark:border-neutral-700">
                    <Label className="mb-1">員工</Label>
                    <div className="text-lg font-bold text-slate-700 dark:text-neutral-200">{displayName}</div>
                </div>

                <Input
                    label="獎金金額"
                    value={amount}
                    onChange={(e) => {
                        const val = e.target.value
                        if (val === '' || /^\d*\.?\d*$/.test(val)) setAmount(val)
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
                    placeholder="0"
                    autoFocus
                />

                <div>
                    <Label className="mb-2">備註</Label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full px-4 py-3 border border-slate-200 dark:border-neutral-700 rounded-xl focus:border-[var(--color-primary)] focus:ring-2 focus:ring-orange-500/20 outline-none bg-white dark:bg-neutral-800 resize-none h-24 text-slate-800 dark:text-neutral-100"
                        placeholder="選填..."
                    />
                </div>

                {error && (
                    <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                        <span className="material-symbols-outlined text-base">error</span>
                        {error}
                    </div>
                )}
                {saved && (
                    <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-3 py-2">
                        <span className="material-symbols-outlined text-base">check_circle</span>
                        獎金已成功更新！
                    </div>
                )}
            </DialogContent>

            <DialogFooter>
                <Button variant="ghost" onClick={onClose} disabled={saving}>關閉</Button>
                {!saved && (
                    <Button onClick={handleSave} isLoading={saving}>確認儲存</Button>
                )}
            </DialogFooter>
        </Dialog>
    )
}
