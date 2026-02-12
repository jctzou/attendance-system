'use client'

import { useEffect, useState } from 'react'
import { getMyLeaves, getAnnualLeaveBalance } from './actions'
import LeaveTable from '@/components/LeaveTable'
import ApplyLeaveDialog from '@/components/ApplyLeaveDialog'
import { PageContainer } from '@/components/ui/PageContainer'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export default function LeavesPage() {
    const [leaves, setLeaves] = useState<any[]>([])
    const [balance, setBalance] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [showApplyDialog, setShowApplyDialog] = useState(false)

    const fetchData = async () => {
        setLoading(true)
        const [leavesRes, balanceRes] = await Promise.all([
            getMyLeaves(),
            getAnnualLeaveBalance()
        ])

        if (leavesRes.data) {
            setLeaves(leavesRes.data)
        }
        if (balanceRes.data) {
            setBalance(balanceRes.data)
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchData()
    }, [])

    return (
        <PageContainer
            title="請假管理"
            description="查看您的請假記錄與特休餘額，並可在此申請新的休假。"
            action={
                <Button onClick={() => setShowApplyDialog(true)}>
                    + 申請請假
                </Button>
            }
        >
            {/* 特休餘額卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card title={`年度特休總天數 (${new Date().getFullYear()})`}>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                            {balance?.total_days || 0}
                        </span>
                        <span className="text-sm text-slate-500 dark:text-slate-400">天</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-2">包含所有已核發的特休假</p>
                </Card>

                <Card title="已使用 (含審核中)">
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                            {balance?.used_days || 0}
                        </span>
                        <span className="text-sm text-slate-500 dark:text-slate-400">天</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-2">已批准與待審核的申請</p>
                </Card>

                <Card title="剩餘天數">
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-green-600 dark:text-green-400">
                            {balance ? (balance.total_days - balance.used_days) : 0}
                        </span>
                        <span className="text-sm text-slate-500 dark:text-slate-400">天</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-2">目前可申請的特休餘額</p>
                </Card>
            </div>

            <Card title="我的請假記錄" className="overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-500">載入中...</div>
                ) : (
                    <LeaveTable data={leaves} />
                )}
            </Card>

            {showApplyDialog && (
                <ApplyLeaveDialog
                    onClose={() => setShowApplyDialog(false)}
                    onSuccess={() => {
                        setShowApplyDialog(false)
                        fetchData()
                    }}
                    annualLeaveBalance={balance}
                />
            )}
        </PageContainer>
    )
}
