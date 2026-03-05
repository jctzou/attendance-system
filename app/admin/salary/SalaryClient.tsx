'use client'

import { useState, useEffect } from 'react'
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
    const [settleError, setSettleError] = useState<string | null>(null)

    // Dialogs & Drawers
    const [showSettings, setShowSettings] = useState(false)
    const [selectedAuditRecord, setSelectedAuditRecord] = useState<SalaryRecordData | null>(null)
    const [bonusTarget, setBonusTarget] = useState<SalaryRecordData | null>(null)
    const [resettleTarget, setResettleTarget] = useState<SalaryRecordData | null>(null)
    const [settleTarget, setSettleTarget] = useState<SalaryRecordData | null>(null)
    const [resettleError, setResettleError] = useState<string | null>(null)

    // 🔑 方案一：每次 initialRecords (Server Component) 更新後，自動同步 Drawer 的資料
    // 這讓結算、取消結算、獎金編輯後，Drawer 就地更新，無須關閉再重開
    useEffect(() => {
        if (selectedAuditRecord) {
            const updated = initialRecords.find(r => r.userId === selectedAuditRecord.userId)
            if (updated) setSelectedAuditRecord(updated)
        }
    }, [initialRecords])

    // 切換月份：URL-based navigation，觸發 Server Component 重新取資料
    const handleMonthChange = (month: string) => {
        router.push(`/admin/salary?month=${month}`)
    }

    const handleSettleConfirm = async () => {
        if (!settleTarget) return
        setProcessingId(settleTarget.userId)
        setSettleError(null)
        try {
            const res = await settleSalary(settleTarget.userId, initialYearMonth)
            if (res.success) {
                setSettleTarget(null) // 關閉確認對話框
                router.refresh()      // useEffect 會自動同步 Drawer 到已結算狀態
            } else {
                setSettleError(res.error || '結算失敗，請稍後再試')
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
                setResettleTarget(null) // 關閉確認對話框
                router.refresh()        // useEffect 會自動同步 Drawer 到未結算狀態
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
                        // 不關閉 Drawer，只關閉 BonusDialog，router.refresh 後 useEffect 同步 Drawer
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

            <Dialog isOpen={!!settleTarget} onClose={() => setSettleTarget(null)} maxWidth="sm">
                <DialogHeader title="確認結算薪資" onClose={() => setSettleTarget(null)} />
                <DialogContent>
                    <div className="text-slate-600 dark:text-neutral-300">
                        <p className="mb-2">您確定要結算 <strong>{settleTarget?.displayName}</strong> 的薪資嗎？</p>
                        <p className="text-sm text-slate-500 bg-slate-50 dark:bg-neutral-800 p-3 rounded-lg border border-slate-100 dark:border-neutral-700">
                            這將會凍結本月薪資記錄，並發送通知給員工。結算後若要修改獎金，需先取消結算。
                        </p>
                        {settleError && (
                            <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">error</span>
                                {settleError}
                            </div>
                        )}
                    </div>
                </DialogContent>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setSettleTarget(null)} disabled={!!processingId}>取消</Button>
                    <Button
                        onClick={handleSettleConfirm}
                        variant="primary"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        disabled={!!processingId}
                        isLoading={!!processingId}
                    >
                        {processingId ? '處理中...' : '確定結算'}
                    </Button>
                </DialogFooter>
            </Dialog>

            <AuditDrawer
                isOpen={!!selectedAuditRecord}
                record={selectedAuditRecord}
                onClose={() => setSelectedAuditRecord(null)}
                onEditBonus={setBonusTarget}
                onSettle={(userId) => {
                    const rec = initialRecords.find(r => r.userId === userId)
                    if (rec) {
                        setSettleTarget(rec)
                        setSettleError(null)
                    }
                }}
                onResettle={(userId) => {
                    const rec = initialRecords.find(r => r.userId === userId)
                    if (rec) {
                        setResettleTarget(rec)
                        setResettleError(null)
                    }
                }}
                isProcessing={!!processingId}
                settleError={settleError}
            />
        </>
    )
}
