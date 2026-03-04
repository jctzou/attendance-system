'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ControlBar } from './components/ControlBar'
import { EmployeeCard } from './components/EmployeeCard'
import { SalarySettingsDialog } from './components/SalarySettingsDialog'
import { BonusDialog } from './components/BonusDialog'
import { AuditDrawer } from './components/AuditDrawer'
import { Dialog, DialogContent, DialogHeader, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { settleSalary, resettleSalary, type SalaryRecordData } from './actions'

interface Props {
    initialRecords: SalaryRecordData[]
    initialYearMonth: string
    usersList: any[]
}

export default function SalaryClient({ initialRecords, initialYearMonth, usersList }: Props) {
    const router = useRouter()
    const [processingId, setProcessingId] = useState<string | null>(null)

    // Dialogs & Drawers
    const [showSettings, setShowSettings] = useState(false)
    const [selectedAuditRecord, setSelectedAuditRecord] = useState<SalaryRecordData | null>(null)
    const [bonusTarget, setBonusTarget] = useState<SalaryRecordData | null>(null)
    const [resettleTarget, setResettleTarget] = useState<SalaryRecordData | null>(null)
    const [resettleError, setResettleError] = useState<string | null>(null)

    // 切換月份：URL-based navigation，觸發 Server Component 重新取資料
    const handleMonthChange = (month: string) => {
        router.push(`/admin/salary?month=${month}`)
    }

    const handleSettle = async (userId: string) => {
        setProcessingId(userId)
        try {
            const res = await settleSalary(userId, initialYearMonth)
            if (res.success) {
                router.refresh() // 重新觸發 SSR 計算，取得最新快照
            } else {
                console.error('結算失敗:', res.error)
                alert('結算失敗: ' + res.error)
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
            const res = await resettleSalary(resettleTarget.userId, initialYearMonth)
            if (res.success) {
                setResettleTarget(null)
                router.refresh()
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
        <>
            <ControlBar
                selectedMonth={initialYearMonth}
                onMonthChange={handleMonthChange}
                onOpenSettings={() => setShowSettings(true)}
            />

            <div className="space-y-4">
                {initialRecords.length > 0 ? (
                    initialRecords.map(record => (
                        <EmployeeCard
                            key={record.userId}
                            data={record}
                            onClick={(r) => setSelectedAuditRecord(r)}
                            isProcessing={processingId === record.userId}
                        />
                    ))
                ) : (
                    <div className="text-center py-20 text-slate-400 bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200 dark:border-neutral-800 card-root">
                        無資料
                    </div>
                )}
            </div>

            {/* --- Dialogs --- */}

            <SalarySettingsDialog
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                onSuccess={() => router.refresh()}
                users={usersList}
            />

            {bonusTarget && (
                <BonusDialog
                    isOpen={!!bonusTarget}
                    userId={bonusTarget.userId}
                    displayName={bonusTarget.displayName}
                    yearMonth={initialYearMonth}
                    currentBonus={bonusTarget.bonus}
                    currentNotes={bonusTarget.notes || ''}
                    onClose={() => setBonusTarget(null)}
                    onSuccess={() => {
                        setBonusTarget(null)
                        router.refresh()
                    }}
                />
            )}

            <Dialog isOpen={!!resettleTarget} onClose={() => setResettleTarget(null)} maxWidth="sm">
                <DialogHeader title="確認取消結算" onClose={() => setResettleTarget(null)} />
                <DialogContent>
                    <div className="text-slate-600 dark:text-neutral-300">
                        <p className="mb-2">您確定要取消 <strong>{resettleTarget?.displayName}</strong> 的結算嗎？</p>
                        <p className="text-sm text-slate-500 bg-slate-50 dark:bg-neutral-800 p-3 rounded-lg border border-slate-100 dark:border-neutral-700">
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

            <AuditDrawer
                isOpen={!!selectedAuditRecord}
                record={selectedAuditRecord}
                onClose={() => setSelectedAuditRecord(null)}
                onEditBonus={setBonusTarget}
                onSettle={handleSettle}
                onResettle={(userId) => {
                    const rec = initialRecords.find(r => r.userId === userId)
                    if (rec) {
                        setResettleTarget(rec)
                        setResettleError(null)
                    }
                }}
                isProcessing={!!processingId}
            />
        </>
    )
}
