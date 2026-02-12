
'use client'

import React, { useState, useEffect } from 'react'
import { PageContainer } from '@/components/ui/PageContainer'
import { ControlBar } from './components/ControlBar'
import { EmployeeCard } from './components/EmployeeCard'
import { SalarySettingsDialog } from './components/SalarySettingsDialog'
import { BonusDialog } from './components/BonusDialog'
import { Dialog, DialogContent, DialogHeader, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import {
    getAllUsers,
    calculateMonthlySalary,
    saveSalaryRecord,
    settleSalary,
    resettleSalary,
    type SalaryRecordData
} from './actions'

export default function AdminSalaryPage() {
    // --- State ---
    const [yearMonth, setYearMonth] = useState('')
    const [loading, setLoading] = useState(true)
    const [records, setRecords] = useState<SalaryRecordData[]>([])
    const [processingId, setProcessingId] = useState<string | null>(null)

    // Dialogs
    const [showSettings, setShowSettings] = useState(false)
    const [bonusTarget, setBonusTarget] = useState<SalaryRecordData | null>(null)
    const [resettleTarget, setResettleTarget] = useState<SalaryRecordData | null>(null)
    const [resettleError, setResettleError] = useState<string | null>(null)
    const [usersList, setUsersList] = useState<any[]>([])

    // --- Effects ---

    // 1. Init Month
    useEffect(() => {
        const now = new Date()
        setYearMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
    }, [])

    // 2. Fetch Data
    useEffect(() => {
        if (yearMonth) {
            loadData()
        }
    }, [yearMonth])

    // --- Logic ---

    const loadData = async (silent = false) => {
        if (!silent) setLoading(true)
        try {
            // 1. Get All Users (Employees)
            const usersRes = await getAllUsers()
            if (usersRes.error) {
                console.error(usersRes.error)
                return
            }
            setUsersList(usersRes.data || [])

            // 2. Calculate Salary for each user (Live calculation)
            const promises = (usersRes.data || []).map(async (user: any) => {
                const calc = await calculateMonthlySalary(user.id, yearMonth)
                if (calc.success && calc.data) {
                    // Auto-save to ensure DB has latest record (optional but good for persistence)
                    await saveSalaryRecord(calc.data)
                    return calc.data
                }
                return null
            })

            const results = await Promise.all(promises)
            setRecords(results.filter(r => r !== null) as SalaryRecordData[])

        } catch (e) {
            console.error(e)
        } finally {
            if (!silent) setLoading(false)
        }
    }

    // Helper to update a single record in the local state
    const updateLocalRecord = (updatedRecord: SalaryRecordData) => {
        setRecords(prev => prev.map(r => r.userId === updatedRecord.userId ? updatedRecord : r))
    }

    const handleSettle = async (userId: string) => {
        setProcessingId(userId)
        try {
            const res = await settleSalary(userId, yearMonth)
            if (res.success) {
                // Fetch just this user or rely on returned data? 
                // The action doesn't return the data, but we know it's settled.
                // Best practice: Fetch fresh data for this user to be sure.
                const fresh = await calculateMonthlySalary(userId, yearMonth)
                if (fresh.data) {
                    updateLocalRecord(fresh.data)
                }
            } else {
                console.error('結算失敗:', res.error)
                // Ideally show a toast here, but for now just log
            }
        } finally {
            setProcessingId(null)
        }
    }

    const handleResettleConfirm = async () => {
        if (!resettleTarget) return
        setProcessingId(resettleTarget.userId)
        setResettleError(null)

        try {
            const res = await resettleSalary(resettleTarget.userId, yearMonth)
            if (res.success) {
                // Close dialog first
                setResettleTarget(null)

                // Get fresh data which should be UNSETTLED now
                const fresh = await calculateMonthlySalary(resettleTarget.userId, yearMonth)
                if (fresh.data) {
                    updateLocalRecord(fresh.data)
                }
            } else {
                setResettleError(res.error || '重新結算失敗')
            }
        } catch (e) {
            setResettleError('發生未預期錯誤')
        } finally {
            setProcessingId(null)
        }
    }

    return (
        <PageContainer title="薪資管理" description="管理員工每月薪資、獎金與發放狀態" className="p-4 md:p-8">
            <ControlBar
                selectedMonth={yearMonth}
                onMonthChange={setYearMonth}
                onOpenSettings={() => setShowSettings(true)}
            />

            {loading ? (
                <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 card-root">
                    <div className="animate-spin w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full mx-auto mb-4"></div>
                    <div className="text-slate-500 font-bold">正在計算薪資數據...</div>
                </div>
            ) : (
                <div className="space-y-4">
                    {records.length > 0 ? (
                        records.map(record => (
                            <EmployeeCard
                                key={record.userId}
                                data={record}
                                onSettle={handleSettle}
                                onResettle={() => {
                                    setResettleTarget(record)
                                    setResettleError(null)
                                }}
                                onEditBonus={setBonusTarget}
                                isProcessing={processingId === record.userId}
                            />
                        ))
                    ) : (
                        <div className="text-center py-20 text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 card-root">
                            無資料
                        </div>
                    )}
                </div>
            )}

            {/* --- Dialogs --- */}

            <SalarySettingsDialog
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                onSuccess={() => loadData(true)} // Silent refresh
                users={usersList}
            />

            {bonusTarget && (
                <BonusDialog
                    isOpen={!!bonusTarget}
                    userId={bonusTarget.userId}
                    displayName={bonusTarget.displayName}
                    yearMonth={yearMonth}
                    currentBonus={bonusTarget.bonus}
                    currentNotes={bonusTarget.notes || ''}
                    onClose={() => setBonusTarget(null)}
                    onSuccess={() => loadData(true)} // Silent refresh
                />
            )}

            {/* Custom Resettle Confirm Dialog */}
            <Dialog isOpen={!!resettleTarget} onClose={() => setResettleTarget(null)} maxWidth="sm">
                <DialogHeader title="確認取消結算" onClose={() => setResettleTarget(null)} />
                <DialogContent>
                    <div className="text-slate-600 dark:text-slate-300">
                        <p className="mb-2">您確定要取消 <strong>{resettleTarget?.displayName}</strong> 的結算嗎？</p>
                        <p className="text-sm text-slate-500 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                            這將會解除鎖定，並取消員工的薪資記錄，稍後你可以再重新結算
                        </p>
                        {resettleError && (
                            <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">error</span>
                                {resettleError}
                            </div>
                        )}
                    </div>
                </DialogContent>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setResettleTarget(null)} disabled={!!processingId}>取消</Button>
                    <Button
                        onClick={handleResettleConfirm}
                        variant="danger"
                        disabled={!!processingId}
                        isLoading={!!processingId}
                    >
                        {processingId ? '處理中...' : '確定取消結算'}
                    </Button>
                </DialogFooter>
            </Dialog>
        </PageContainer>
    )
}
