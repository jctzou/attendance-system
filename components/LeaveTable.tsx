'use client'

import React, { useState, useMemo } from 'react'
import { cancelLeave, cancelLeaveGroup, requestCancelLeave } from '@/app/leaves/actions'
import { ConfirmDialog, AlertDialog } from './ui/ActionDialogs'
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'

interface LeaveApprover {
    display_name: string
    email: string
}

interface LeaveRow {
    id: number
    group_id: string | null
    leave_type: string
    start_date: string
    end_date: string
    days: number
    reason: string | null
    status: string
    created_at: string
    approver_id: string | null
    approved_at: string | null
    cancel_reason: string | null
    approver: LeaveApprover | null
}

interface Props {
    data: LeaveRow[]
    onRefresh?: () => void
}

const LEAVE_TYPE_MAP: Record<string, string> = {
    'sick_leave': '病假',
    'personal_leave': '事假',
    'annual_leave': '特休',
    'other': '其他',
}

interface GroupedLeave {
    groupId: string
    leaveType: string
    reason: string | null
    createdAt: string
    totalDays: number
    startDate: string
    endDate: string
    status: string
    items: LeaveRow[]
}

export default function LeaveTable({ data, onRefresh }: Props) {
    const [loadingId, setLoadingId] = useState<number | string | null>(null)
    const [confirmAction, setConfirmAction] = useState<{ id: number | string, isGroup: boolean } | null>(null)
    const [alertMessage, setAlertMessage] = useState<string>('')
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
    // For cancel request dialog
    const [requestCancelTarget, setRequestCancelTarget] = useState<number | null>(null)
    const [cancelReason, setCancelReason] = useState<string>('')
    const [cancelReasonError, setCancelReasonError] = useState<string>('')

    const groupedData = useMemo(() => {
        const groups = new Map<string, GroupedLeave>()

        data.forEach(leave => {
            const groupId = leave.group_id || `legacy-${leave.id}`

            if (!groups.has(groupId)) {
                groups.set(groupId, {
                    groupId,
                    leaveType: leave.leave_type,
                    reason: leave.reason,
                    createdAt: leave.created_at,
                    totalDays: 0,
                    startDate: leave.start_date,
                    endDate: leave.end_date,
                    status: leave.status,
                    items: []
                })
            }

            const group = groups.get(groupId)!
            group.items.push(leave)
            group.totalDays += Number(leave.days)

            if (new Date(leave.start_date) < new Date(group.startDate)) group.startDate = leave.start_date
            if (new Date(leave.end_date) > new Date(group.endDate)) group.endDate = leave.end_date

            // Status priority: pending > cancel_pending > approved > others
            if (leave.status === 'pending') group.status = 'pending'
            else if (leave.status === 'cancel_pending' && group.status !== 'pending') group.status = 'cancel_pending'
        })

        return Array.from(groups.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }, [data])

    const handleCancelClick = (id: number | string, isGroup: boolean) => {
        setConfirmAction({ id, isGroup })
    }

    const toggleGroup = (groupId: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev)
            if (next.has(groupId)) next.delete(groupId)
            else next.add(groupId)
            return next
        })
    }

    const executeCancel = async () => {
        if (!confirmAction) return
        const { id, isGroup } = confirmAction

        setLoadingId(id)
        try {
            if (isGroup && typeof id === 'string' && !id.startsWith('legacy-')) {
                const res = await cancelLeaveGroup(id)
                if (!res.success) throw new Error(res.error?.message || '取消失敗')
            } else {
                const leaveId = typeof id === 'string' ? Number(id.replace('legacy-', '')) : id
                const res = await cancelLeave(leaveId)
                if (!res.success) throw new Error(res.error?.message || '取消失敗')
            }
            setConfirmAction(null)
            onRefresh?.()
        } catch (e: any) {
            setAlertMessage(e.message || '取消失敗')
            setConfirmAction(null)
        } finally {
            setLoadingId(null)
        }
    }

    const executeRequestCancel = async () => {
        if (!requestCancelTarget) return
        if (!cancelReason.trim()) {
            setCancelReasonError('請填寫取消原因')
            return
        }
        setLoadingId(requestCancelTarget)
        try {
            const res = await requestCancelLeave(requestCancelTarget, cancelReason)
            if (!res.success) throw new Error(res.error?.message || '申請失敗')
            setRequestCancelTarget(null)
            setCancelReason('')
            onRefresh?.()
        } catch (e: any) {
            setAlertMessage(e.message || '申請失敗')
            setRequestCancelTarget(null)
            setCancelReason('')
        } finally {
            setLoadingId(null)
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved':
                return <span className="px-2.5 py-1 text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">已批准</span>
            case 'rejected':
                return <span className="px-2.5 py-1 text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full">遭退回</span>
            case 'cancelled':
                return <span className="px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-neutral-800 dark:text-neutral-400 rounded-full">已取消</span>
            default:
                return <span className="px-2.5 py-1 text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 rounded-full">待審核</span>
        }
    }

    if (data.length === 0) {
        return (
            <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-slate-200 dark:border-neutral-700 overflow-hidden">
                <div className="px-6 py-16 text-center text-slate-500 dark:text-neutral-400">
                    <div className="flex flex-col items-center gap-2">
                        <span className="material-symbols-outlined text-4xl text-slate-300">event_available</span>
                        <p>目前沒有請假記錄</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Mobile Card View (< md) */}
            <div className="block md:hidden space-y-4">
                {groupedData.map((group) => {
                    const isExpanded = expandedGroups.has(group.groupId)
                    return (
                        <div key={group.groupId} className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-slate-200 dark:border-neutral-700 p-5">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex flex-col gap-1">
                                    <div className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                        {LEAVE_TYPE_MAP[group.leaveType] || group.leaveType}
                                    </div>
                                    <div className="mt-1">{getStatusBadge(group.status)}</div>
                                </div>
                                {group.items.length > 1 && (
                                    <button
                                        onClick={() => toggleGroup(group.groupId)}
                                        className="text-xs text-slate-500 flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-300"
                                    >
                                        {isExpanded ? '收起明細' : '展開明細'}
                                        {isExpanded ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />}
                                    </button>
                                )}
                            </div>

                            <div className="space-y-3 mb-4">
                                <div className="bg-slate-50 dark:bg-neutral-900/50 p-3 rounded-lg border border-slate-100 dark:border-neutral-700/50">
                                    <div className="text-sm text-slate-600 dark:text-neutral-300">
                                        <div className="flex justify-between mb-1">
                                            <span className="text-slate-400">日期:</span>
                                            <span className="font-mono">{group.startDate} {group.startDate !== group.endDate && `~ ${group.endDate}`}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">天數:</span>
                                            <span className="font-medium">{group.totalDays} 天</span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <div className="text-xs font-medium text-slate-400 mb-1">事由:</div>
                                    <div className="text-sm text-slate-700 dark:text-neutral-200 leading-relaxed">
                                        {group.reason}
                                    </div>
                                </div>
                                <div className="text-xs text-slate-400 pt-2 border-t border-slate-100 dark:border-neutral-700 space-y-0.5">
                                    <div>申請時間: {new Date(group.createdAt).toLocaleString('zh-TW')}</div>
                                    {(group.status === 'approved' || group.status === 'cancel_pending') && group.items[0]?.approver?.display_name && (
                                        <div className="text-green-600 dark:text-green-400">
                                            ✓ 批准人: {group.items[0].approver.display_name}
                                            {group.items[0].approved_at && (
                                                <span className="ml-1">
                                                    ({new Date(group.items[0].approved_at).toLocaleDateString('zh-TW')})
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {group.status === 'rejected' && group.items[0]?.approver?.display_name && (
                                        <div className="text-red-500 dark:text-red-400">
                                            ✗ 退回人: {group.items[0].approver.display_name}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Expanded Items – mobile */}
                            {isExpanded && group.items.length > 1 && (
                                <div className="mb-4 space-y-2 border-t border-slate-100 dark:border-neutral-700 pt-3">
                                    {group.items.map(item => (
                                        <div key={item.id} className="flex justify-between items-center bg-slate-50 dark:bg-neutral-700/30 p-2 rounded">
                                            <div className="flex items-center gap-2">
                                                <div className="text-[10px]">{getStatusBadge(item.status)}</div>
                                                <div className="text-sm font-mono text-slate-600 dark:text-neutral-300">
                                                    {item.start_date} ({item.days}天)
                                                </div>
                                            </div>
                                            {item.status === 'pending' && (
                                                <button onClick={() => handleCancelClick(item.id, false)}
                                                    disabled={!!loadingId}
                                                    className="text-xs text-red-600 hover:underline disabled:opacity-50">單獨撤銷</button>
                                            )}
                                            {item.status === 'approved' && (
                                                <button onClick={() => { setRequestCancelTarget(item.id); setCancelReason(''); setCancelReasonError('') }}
                                                    disabled={!!loadingId}
                                                    className="text-xs text-amber-600 hover:underline disabled:opacity-50">申請取消</button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Footer: Group Actions — mobile */}
                            <div className="mt-3 flex flex-col gap-2">
                                {group.status === 'pending' && (
                                    <button onClick={() => handleCancelClick(group.groupId, true)}
                                        disabled={!!loadingId}
                                        className="w-full py-2.5 px-4 bg-white dark:bg-neutral-700 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50">
                                        {loadingId === group.groupId ? '處理中...' : '全部撤銷'}
                                    </button>
                                )}
                                {/* For approved single-day groups, show request cancel button */}
                                {group.items.length === 1 && group.status === 'approved' && (
                                    <button onClick={() => { setRequestCancelTarget(group.items[0].id); setCancelReason(''); setCancelReasonError('') }}
                                        disabled={!!loadingId}
                                        className="w-full py-2.5 px-4 bg-white dark:bg-neutral-700 border border-amber-200 dark:border-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-50">
                                        申請取消
                                    </button>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-slate-200 dark:border-neutral-700 overflow-hidden leave-table-root">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-neutral-900/50">
                        <tr>
                            <th className="px-6 py-4 text-left w-8"></th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">假別</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">日期範圍 / 天數</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">原因</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">狀態</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider w-[15%]">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {groupedData.map((group) => {
                            const isExpanded = expandedGroups.has(group.groupId)
                            return (
                                <React.Fragment key={group.groupId}>
                                    <tr
                                        onClick={() => toggleGroup(group.groupId)}
                                        className="hover:bg-slate-50 dark:hover:bg-neutral-700/50 transition-colors cursor-pointer group"
                                    >
                                        <td className="px-6 py-4">
                                            {group.items.length > 1 && (
                                                <div className="text-slate-400 group-hover:text-slate-600 transition-colors">
                                                    {isExpanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">
                                            {LEAVE_TYPE_MAP[group.leaveType] || group.leaveType}
                                            {group.items.length > 1 && <span className="ml-1 opacity-70 text-xs font-normal">({group.items.length} 筆)</span>}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-neutral-300">
                                            <div className="font-mono">{group.startDate} {group.startDate !== group.endDate && `~ ${group.endDate}`}</div>
                                            <div className="text-xs text-slate-400 mt-0.5 font-bold">共 {group.totalDays} 天</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-neutral-300 max-w-xs truncate" title={group.reason ?? ''}>
                                            {group.reason}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col gap-1">
                                                {getStatusBadge(group.status)}
                                                {(group.status === 'approved' || group.status === 'cancel_pending') && group.items[0]?.approver?.display_name && (
                                                    <span className="text-xs text-green-600 dark:text-green-400">
                                                        ✓ {group.items[0].approver.display_name}
                                                        {group.items[0].approved_at && ` · ${new Date(group.items[0].approved_at).toLocaleDateString('zh-TW')}`}
                                                    </span>
                                                )}
                                                {group.status === 'rejected' && group.items[0]?.approver?.display_name && (
                                                    <span className="text-xs text-red-500 dark:text-red-400">
                                                        ✗ {group.items[0].approver.display_name}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                            <div className="flex items-center justify-end gap-2">
                                                {group.status === 'pending' && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleCancelClick(group.groupId, true) }}
                                                        disabled={!!loadingId}
                                                        className="inline-flex px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 rounded-lg transition-colors disabled:opacity-50"
                                                    >
                                                        {loadingId === group.groupId ? '處理中' : '全部撤銷'}
                                                    </button>
                                                )}
                                                {/* Single-day approved group can request cancel directly */}
                                                {group.items.length === 1 && group.status === 'approved' && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setRequestCancelTarget(group.items[0].id); setCancelReason(''); setCancelReasonError('') }}
                                                        disabled={!!loadingId}
                                                        className="inline-flex px-3 py-1 bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50 rounded-lg transition-colors disabled:opacity-50"
                                                    >
                                                        申請取消
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>

                                    {/* Expanded Detail Rows */}
                                    {isExpanded && group.items.length > 1 && group.items.map((item) => (
                                        <tr key={item.id} className="bg-slate-50/50 dark:bg-neutral-800/50 border-t-0">
                                            <td className="px-6 py-2"></td>
                                            <td className="px-6 py-2"></td>
                                            <td className="px-6 py-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></div>
                                                    <span className="text-sm font-mono text-slate-500 dark:text-neutral-400 flex items-center gap-2">
                                                        單日展開: {item.start_date}
                                                        <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-neutral-700 text-slate-600 dark:text-neutral-300">
                                                            {item.days} 天
                                                        </span>
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-2"></td>
                                            <td className="px-6 py-2">
                                                {getStatusBadge(item.status)}
                                            </td>
                                            <td className="px-6 py-2 whitespace-nowrap text-right space-x-2">
                                                {item.status === 'pending' && (
                                                    <button
                                                        onClick={() => handleCancelClick(item.id, false)}
                                                        disabled={!!loadingId}
                                                        className="text-xs text-red-600 hover:text-red-800 dark:hover:text-red-400 underline decoration-red-600/30 underline-offset-4 disabled:opacity-50"
                                                    >
                                                        單獨撤銷
                                                    </button>
                                                )}
                                                {item.status === 'approved' && (
                                                    <button
                                                        onClick={() => { setRequestCancelTarget(item.id); setCancelReason(''); setCancelReasonError('') }}
                                                        disabled={!!loadingId}
                                                        className="text-xs text-amber-600 hover:text-amber-800 dark:hover:text-amber-400 underline decoration-amber-600/30 underline-offset-4 disabled:opacity-50"
                                                    >
                                                        申請取消
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Cancel Request Dialog (for approved leaves) */}
            {requestCancelTarget !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
                        <h3 className="text-lg font-bold mb-1 text-slate-900 dark:text-white">申請取消已批准假單</h3>
                        <p className="text-sm text-slate-500 mb-4">取消申請將送至主管審核，同意後假單才會被撤銷。</p>
                        <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">取消原因 <span className="text-red-500">*</span></label>
                        <textarea
                            value={cancelReason}
                            onChange={e => { setCancelReason(e.target.value); setCancelReasonError('') }}
                            rows={3}
                            className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-800 dark:text-neutral-100 bg-white dark:bg-neutral-700 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 ${cancelReasonError ? 'border-red-400' : 'border-slate-300 dark:border-neutral-600'
                                }`}
                            placeholder="請說明取消原因（必填）"
                        />
                        {cancelReasonError && <p className="text-xs text-red-500 mt-1">{cancelReasonError}</p>}
                        <div className="flex justify-end gap-3 mt-4">
                            <button onClick={() => { setRequestCancelTarget(null); setCancelReason('') }}
                                className="px-4 py-2 text-sm rounded-lg text-slate-600 hover:bg-slate-100 dark:hover:bg-neutral-700 transition-colors">
                                不了
                            </button>
                            <button
                                onClick={executeRequestCancel}
                                disabled={!!loadingId}
                                className="px-4 py-2 text-sm rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50">
                                {loadingId === requestCancelTarget ? '傳送中...' : '確認申請取消'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog
                isOpen={confirmAction !== null}
                title="確認取消請假"
                message={confirmAction?.isGroup ? "確定要撤銷這批請假申請嗎？此操作無法還原。" : "確定要撤銷此單日請假申請嗎？此操作無法還原。"}
                onConfirm={executeCancel}
                onCancel={() => !loadingId && setConfirmAction(null)}
                confirmText="確定取消"
                isDestructive={true}
                isLoading={loadingId !== null}
            />

            <AlertDialog
                isOpen={alertMessage !== ''}
                title="系統提示"
                message={alertMessage}
                onConfirm={() => setAlertMessage('')}
            />
        </div>
    )
}
