'use client'

import React, { useState, useMemo } from 'react'
import { reviewLeave, reviewLeaveGroup, approveCancelLeave, approveCancelLeaveGroup } from '@/app/leaves/actions'
import { ConfirmDialog, AlertDialog } from './ui/ActionDialogs'
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'

interface Props {
    data: any[]
    onSuccess?: () => void
}

const LEAVE_TYPE_MAP: Record<string, string> = {
    'sick_leave': '病假',
    'personal_leave': '事假',
    'annual_leave': '特休',
    'other': '其他',
}

interface GroupedLeave {
    groupId: string | 'legacy'
    user: any
    leaveType: string
    reason: string
    createdAt: string
    totalDays: number
    startDate: string
    endDate: string
    items: any[]
}

export default function AdminLeaveTable({ data, onSuccess }: Props) {
    const [processingId, setProcessingId] = useState<number | string | null>(null)
    const [confirmAction, setConfirmAction] = useState<{ id: string | number, status: 'approved' | 'rejected', isGroup: boolean } | null>(null)
    const [alertMessage, setAlertMessage] = useState<string>('')
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
    const [cancelApproveTarget, setCancelApproveTarget] = useState<{ id: number, action: 'approve' | 'reject' } | null>(null)
    const [cancelApproveGroupTarget, setCancelApproveGroupTarget] = useState<{ groupId: string, action: 'approve' | 'reject' } | null>(null)

    // 依據 group_id 群組化
    const groupedData = useMemo(() => {
        const groups = new Map<string, GroupedLeave>()

        data.forEach(leave => {
            // 若為早期的舊資料，沒有 group_id，就當作獨自的群組
            const groupId = leave.group_id || `legacy-${leave.id}`

            if (!groups.has(groupId)) {
                groups.set(groupId, {
                    groupId,
                    user: leave.user,
                    leaveType: leave.leave_type,
                    reason: leave.reason,
                    createdAt: leave.created_at,
                    totalDays: 0,
                    startDate: leave.start_date,
                    endDate: leave.end_date,
                    items: []
                })
            }

            const group = groups.get(groupId)!
            group.items.push(leave)
            group.totalDays += Number(leave.days)

            // 更新起迄範圍 (若有群組)
            if (new Date(leave.start_date) < new Date(group.startDate)) group.startDate = leave.start_date
            if (new Date(leave.end_date) > new Date(group.endDate)) group.endDate = leave.end_date
        })

        // 依據群組最新建立時間排序
        return Array.from(groups.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }, [data])

    const handleReviewClick = (id: number | string, status: 'approved' | 'rejected', isGroup: boolean) => {
        setConfirmAction({ id, status, isGroup })
    }

    const toggleGroup = (groupId: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev)
            if (next.has(groupId)) next.delete(groupId)
            else next.add(groupId)
            return next
        })
    }

    const executeReview = async () => {
        if (!confirmAction) return
        const { id, status, isGroup } = confirmAction
        const actionText = status === 'approved' ? '批准' : '拒絕'

        setProcessingId(id)
        try {
            let res
            if (isGroup && typeof id === 'string' && !id.startsWith('legacy-')) {
                res = await reviewLeaveGroup(id, status)
            } else {
                const leaveId = typeof id === 'string' ? Number(id.replace('legacy-', '')) : id
                res = await reviewLeave(leaveId, status)
            }

            if (!res.success) {
                setAlertMessage(res.error.message)
                setConfirmAction(null)
            } else {
                setAlertMessage(`${actionText}成功！`)
                setConfirmAction(null)
                if (onSuccess) onSuccess()
            }
        } catch (e) {
            console.error('Error in executeReview:', e)
            setAlertMessage('操作失敗')
            setConfirmAction(null)
        } finally {
            setProcessingId(null)
        }
    }

    const executeCancelApprove = async () => {
        if (!cancelApproveTarget) return
        const { id, action } = cancelApproveTarget
        setProcessingId(id)
        try {
            const res = await approveCancelLeave(id, action === 'approve')
            if (!res.success) {
                setAlertMessage(res.error?.message || '操作失敗')
            } else {
                setAlertMessage(action === 'approve' ? '已核准取消申請' : '已拒絕取消申請，假单已恢復為已批准')
                setCancelApproveTarget(null)
                if (onSuccess) onSuccess()
            }
        } catch (e) {
            setAlertMessage('操作失敗')
        } finally {
            setProcessingId(null)
        }
    }

    const executeCancelApproveGroup = async () => {
        if (!cancelApproveGroupTarget) return
        const { groupId, action } = cancelApproveGroupTarget
        setProcessingId(groupId)
        try {
            const res = await approveCancelLeaveGroup(groupId, action === 'approve')
            if (!res.success) {
                setAlertMessage(res.error?.message || '操作失敗')
            } else {
                setAlertMessage(action === 'approve' ? '已核准整批取消申請' : '已拒絕整批取消，假單已全部恢復為已批准')
                setCancelApproveGroupTarget(null)
                if (onSuccess) onSuccess()
            }
        } catch (e) {
            setAlertMessage('操作失敗')
        } finally {
            setProcessingId(null)
        }
    }

    if (data.length === 0) {
        return (
            <div className="text-center py-10 text-slate-500 bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-slate-200 dark:border-neutral-700">
                目前沒有待審核的申請
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
                            {/* Header: User Info */}
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <div className="font-bold text-lg text-slate-800 dark:text-neutral-100">
                                        {group.user?.display_name || 'Unknown'}
                                    </div>
                                    <div className="text-sm text-slate-500 dark:text-neutral-400">
                                        {group.user?.email}
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <div className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                        {LEAVE_TYPE_MAP[group.leaveType] || group.leaveType}
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
                            </div>

                            {/* Content: Details */}
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

                                <div className="text-xs text-slate-400 pt-2 border-t border-slate-100 dark:border-neutral-700">
                                    申請時間: {new Date(group.createdAt).toLocaleString('zh-TW')}
                                </div>
                            </div>

                            {/* Expanded Items */}
                            {isExpanded && group.items.length > 1 && (
                                <div className="mb-4 space-y-2 border-t border-slate-100 dark:border-neutral-700 pt-3">
                                    {group.items.map(item => (
                                        <div key={item.id} className="flex justify-between items-center bg-slate-50 dark:bg-neutral-700/30 p-2 rounded">
                                            <div className="text-sm font-mono text-slate-600 dark:text-neutral-300">
                                                {item.start_date} ({item.days}天)
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleReviewClick(item.id, 'approved', false)}
                                                    disabled={processingId === item.id || processingId === group.groupId}
                                                    className="text-xs text-emerald-600 hover:underline disabled:opacity-50"
                                                >單准</button>
                                                <button
                                                    onClick={() => handleReviewClick(item.id, 'rejected', false)}
                                                    disabled={processingId === item.id || processingId === group.groupId}
                                                    className="text-xs text-red-600 hover:underline disabled:opacity-50"
                                                >單退</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Footer: Actions */}
                            {/* -- Normal Pending: Batch Review -- */}
                            {group.items.every((i: any) => i.status === 'pending') && (
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => handleReviewClick(group.groupId, 'rejected', true)}
                                        disabled={processingId === group.groupId}
                                        className="w-full py-2.5 px-4 bg-white dark:bg-neutral-700 border border-slate-300 dark:border-neutral-600 text-slate-700 dark:text-neutral-200 rounded-lg hover:bg-slate-50 dark:hover:bg-neutral-600 transition-colors disabled:opacity-50"
                                    >
                                        全退
                                    </button>
                                    <button
                                        onClick={() => handleReviewClick(group.groupId, 'approved', true)}
                                        disabled={processingId === group.groupId}
                                        className="w-full py-2.5 px-4 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-sm transition-colors disabled:opacity-50"
                                    >
                                        全准
                                    </button>
                                </div>
                            )}
                            {/* -- Cancel Pending: cancel review -- */}
                            {group.items.some((i: any) => i.status === 'cancel_pending') && (
                                <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                                    <div className="text-xs font-semibold text-amber-800 dark:text-amber-400 mb-2">📤 假單取消申請</div>
                                    {/* Batch buttons if ALL items are cancel_pending */}
                                    {group.items.every((i: any) => i.status === 'cancel_pending') && group.items.length > 1 && (
                                        <div className="flex gap-2 mb-2">
                                            <button onClick={() => setCancelApproveGroupTarget({ groupId: group.groupId, action: 'reject' })}
                                                disabled={!!processingId}
                                                className="flex-1 text-xs text-slate-600 border border-slate-300 px-2 py-1.5 rounded hover:bg-slate-100 disabled:opacity-50">全部拒絕取消</button>
                                            <button onClick={() => setCancelApproveGroupTarget({ groupId: group.groupId, action: 'approve' })}
                                                disabled={!!processingId}
                                                className="flex-1 text-xs text-amber-700 bg-amber-100 border border-amber-300 px-2 py-1.5 rounded hover:bg-amber-200 disabled:opacity-50">全部同意取消</button>
                                        </div>
                                    )}
                                    {group.items.filter((i: any) => i.status === 'cancel_pending').map((item: any) => (
                                        <div key={item.id} className="flex justify-between items-center mb-2">
                                            <span className="text-xs font-mono text-slate-600 dark:text-neutral-300">{item.start_date} - 取消原因：{item.cancel_reason || '(未填寫)'}</span>
                                            <div className="flex gap-2">
                                                <button onClick={() => setCancelApproveTarget({ id: item.id, action: 'reject' })}
                                                    disabled={!!processingId}
                                                    className="text-xs text-slate-600 border border-slate-300 px-2 py-0.5 rounded hover:bg-slate-100 disabled:opacity-50">拒絕取消</button>
                                                <button onClick={() => setCancelApproveTarget({ id: item.id, action: 'approve' })}
                                                    disabled={!!processingId}
                                                    className="text-xs text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded hover:bg-amber-200 disabled:opacity-50">同意取消</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-slate-200 dark:border-neutral-700 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-neutral-900/50">
                        <tr>
                            <th className="px-6 py-3 text-left w-8"></th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider w-1/4">申請人</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider w-[15%]">假別</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider w-1/4">群組時間 / 總天數</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">原因</th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider w-[15%]">批次審核</th>
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
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-bold text-slate-900 dark:text-white">
                                                {group.user?.display_name || 'Unknown'}
                                            </div>
                                            <div className="text-xs text-slate-500 dark:text-neutral-400">
                                                {new Date(group.createdAt).toLocaleDateString()} 申請
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                                {LEAVE_TYPE_MAP[group.leaveType] || group.leaveType}
                                                {group.items.length > 1 && <span className="ml-1 opacity-70">({group.items.length} 筆)</span>}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-neutral-300">
                                            <div className="font-mono">{group.startDate} {group.startDate !== group.endDate && `~ ${group.endDate}`}</div>
                                            <div className="text-xs text-slate-400 mt-0.5 font-bold">共 {group.totalDays} 天</div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-neutral-300 max-w-xs truncate" title={group.reason}>
                                            {group.reason}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                            {group.items.every((i: any) => i.status === 'pending') ? (
                                                <>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleReviewClick(group.groupId, 'approved', true) }}
                                                        disabled={processingId === group.groupId}
                                                        className="inline-flex px-3 py-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 rounded-lg transition-colors disabled:opacity-50"
                                                    >
                                                        全准
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleReviewClick(group.groupId, 'rejected', true) }}
                                                        disabled={processingId === group.groupId}
                                                        className="inline-flex px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 rounded-lg transition-colors disabled:opacity-50"
                                                    >
                                                        全退
                                                    </button>
                                                </>
                                            ) : group.items.every((i: any) => i.status === 'cancel_pending') ? (
                                                <>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setCancelApproveGroupTarget({ groupId: group.groupId, action: 'reject' }) }}
                                                        disabled={!!processingId}
                                                        className="inline-flex px-3 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600 rounded-lg transition-colors disabled:opacity-50"
                                                    >
                                                        全拒絕取消
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setCancelApproveGroupTarget({ groupId: group.groupId, action: 'approve' }) }}
                                                        disabled={!!processingId}
                                                        className="inline-flex px-3 py-1 bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50 rounded-lg transition-colors disabled:opacity-50"
                                                    >
                                                        全同意取消
                                                    </button>
                                                </>
                                            ) : (
                                                <span className="inline-flex px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full">部分取消申請中</span>
                                            )}
                                        </td>
                                    </tr>

                                    {/* Expanded detail rows */}
                                    {isExpanded && group.items.map((item: any) => (
                                        <tr key={item.id} className={`border-t-0 ${item.status === 'cancel_pending' ? 'bg-amber-50/60 dark:bg-amber-900/10' : 'bg-slate-50/50 dark:bg-neutral-800/50'}`}>
                                            <td className="px-6 py-2"></td>
                                            <td colSpan={2} className="px-6 py-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></div>
                                                    <span className="text-sm font-mono text-slate-500 dark:text-neutral-400 flex items-center gap-2">
                                                        {item.start_date}
                                                        <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-neutral-700 text-slate-600 dark:text-neutral-300">
                                                            {item.days} 天
                                                        </span>
                                                        {item.status === 'cancel_pending' && (
                                                            <span className="text-xs italic text-amber-600">— 取消原因：{item.cancel_reason || '未填寫'}</span>
                                                        )}
                                                    </span>
                                                </div>
                                            </td>
                                            <td colSpan={2} className="px-6 py-2"></td>
                                            <td className="px-6 py-2 whitespace-nowrap text-right space-x-2">
                                                {item.status === 'pending' && (
                                                    <>
                                                        <button onClick={() => handleReviewClick(item.id, 'approved', false)}
                                                            disabled={!!processingId}
                                                            className="text-xs text-emerald-600 hover:text-emerald-800 underline underline-offset-4 disabled:opacity-50">
                                                            單准
                                                        </button>
                                                        <button onClick={() => handleReviewClick(item.id, 'rejected', false)}
                                                            disabled={!!processingId}
                                                            className="text-xs text-red-600 hover:text-red-800 underline underline-offset-4 disabled:opacity-50">
                                                            單退
                                                        </button>
                                                    </>
                                                )}
                                                {item.status === 'cancel_pending' && (
                                                    <>
                                                        <button onClick={() => setCancelApproveTarget({ id: item.id, action: 'reject' })}
                                                            disabled={!!processingId}
                                                            className="text-xs text-slate-600 border border-slate-300 px-2 py-0.5 rounded hover:bg-slate-100 disabled:opacity-50">拒絕取消</button>
                                                        <button onClick={() => setCancelApproveTarget({ id: item.id, action: 'approve' })}
                                                            disabled={!!processingId}
                                                            className="text-xs text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded hover:bg-amber-200 disabled:opacity-50">同意取消</button>
                                                    </>
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

            {/* Group Cancel Approve Confirm Dialog */}
            {cancelApproveGroupTarget !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
                        <h3 className="text-lg font-bold mb-2 text-slate-900 dark:text-white">
                            {cancelApproveGroupTarget.action === 'approve' ? '全部同意取消（整批）' : '全部拒絕取消（整批）'}
                        </h3>
                        <p className="text-sm text-slate-500 mb-4">
                            {cancelApproveGroupTarget.action === 'approve'
                                ? '同意後，此群組所有假單將從系統中刪除。'
                                : '拒絕後，所有假單將恢復為已批准狀態。'}
                        </p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setCancelApproveGroupTarget(null)}
                                className="px-4 py-2 text-sm rounded-lg text-slate-600 hover:bg-slate-100 dark:hover:bg-neutral-700">不了</button>
                            <button
                                onClick={executeCancelApproveGroup}
                                disabled={!!processingId}
                                className={`px-4 py-2 text-sm rounded-lg text-white disabled:opacity-50 ${cancelApproveGroupTarget.action === 'approve' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-slate-600 hover:bg-slate-700'}`}>
                                {processingId ? '處理中...' : cancelApproveGroupTarget.action === 'approve' ? '確認全部同意取消' : '確認全部拒絕'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Single-item Cancel Approve Confirm Dialog */}
            {cancelApproveTarget !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
                        <h3 className="text-lg font-bold mb-2 text-slate-900 dark:text-white">
                            {cancelApproveTarget.action === 'approve' ? '同意取消假單' : '拒絕取消申請'}
                        </h3>
                        <p className="text-sm text-slate-500 mb-4">
                            {cancelApproveTarget.action === 'approve'
                                ? '同意後，該日假單將從系統中刪除。'
                                : '拒絕後，假單將恢復為已批准狀態。'}
                        </p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setCancelApproveTarget(null)}
                                className="px-4 py-2 text-sm rounded-lg text-slate-600 hover:bg-slate-100 dark:hover:bg-neutral-700">不了</button>
                            <button
                                onClick={executeCancelApprove}
                                disabled={!!processingId}
                                className={`px-4 py-2 text-sm rounded-lg text-white disabled:opacity-50 ${cancelApproveTarget.action === 'approve' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-slate-600 hover:bg-slate-700'
                                    }`}>
                                {processingId ? '處理中...' : cancelApproveTarget.action === 'approve' ? '確認同意取消' : '確認拒絕'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog
                isOpen={confirmAction !== null}
                title={`確認${confirmAction?.status === 'approved' ? '批准' : '拒絕'}請假`}
                message={`確定要${confirmAction?.status === 'approved' ? '批准' : '拒絕'}這筆申請嗎？`}
                onConfirm={executeReview}
                onCancel={() => !processingId && setConfirmAction(null)}
                confirmText={`確定${confirmAction?.status === 'approved' ? '批准' : '拒絕'}`}
                isDestructive={confirmAction?.status === 'rejected'}
                isLoading={processingId !== null}
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
