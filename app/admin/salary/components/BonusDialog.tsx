
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

    useEffect(() => {
        if (isOpen) {
            setAmount(currentBonus.toString())
            setNotes(currentNotes || '')
            setSaving(false)
        }
    }, [isOpen, currentBonus, currentNotes])

    const handleSave = async () => {
        const numAmount = parseFloat(amount)
        if (isNaN(numAmount) || numAmount < 0) {
            alert('請輸入有效的獎金金額')
            return
        }

        setSaving(true)
        try {
            const res = await updateBonus(userId, yearMonth, numAmount, notes)
            if (res.error) {
                alert('更新失敗: ' + res.error)
            } else {
                onSuccess()
                onClose()
            }
        } catch (e) {
            alert('系統錯誤')
            console.error(e)
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog isOpen={isOpen} onClose={onClose} maxWidth="sm">
            <DialogHeader title="設定獎金" onClose={onClose} />

            <DialogContent className="space-y-4">
                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                    <Label className="mb-1">員工</Label>
                    <div className="text-lg font-bold text-slate-700 dark:text-slate-200">{displayName}</div>
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
                        className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-[var(--color-primary)] focus:ring-2 focus:ring-orange-500/20 outline-none bg-white dark:bg-slate-800 resize-none h-24 text-slate-800 dark:text-slate-100"
                        placeholder="選填..."
                    />
                </div>
            </DialogContent>

            <DialogFooter>
                <Button variant="ghost" onClick={onClose}>取消</Button>
                <Button onClick={handleSave} isLoading={saving}>確認</Button>
            </DialogFooter>
        </Dialog>
    )
}
