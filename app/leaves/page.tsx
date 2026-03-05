// Server Component — 伺服器端取得資料後傳入 LeavesClient
// 目的：讓 salaryType 在 HTML 送達瀏覽器前即確定，消除特休區塊閃爍問題

import { getMyLeaves, getAnnualLeaveBalance, getMyLeaveBalances } from './actions'
import { getUserProfile } from '@/app/attendance/actions'
import LeavesClient from './LeavesClient'

export default async function LeavesPage() {
    // 1. 先取得使用者 profile，確認 salaryType
    const profileRes = await getUserProfile()
    const salaryType = profileRes.success ? (profileRes.data.salary_type || 'monthly') : 'monthly'
    const isMonthly = salaryType !== 'hourly'

    // 2. 並行取假單列表、特休餘額、全假別餘額
    const [leavesRes, balanceRes, leaveBalancesRes] = await Promise.all([
        getMyLeaves(),
        isMonthly ? getAnnualLeaveBalance() : Promise.resolve(null),
        isMonthly ? getMyLeaveBalances() : Promise.resolve(null),
    ])

    const initialLeaves = leavesRes.success ? leavesRes.data : []
    const initialBalance = (balanceRes && balanceRes.success) ? balanceRes.data : null
    const initialLeaveBalances = (leaveBalancesRes && leaveBalancesRes.success) ? leaveBalancesRes.data : null

    return (
        <LeavesClient
            initialLeaves={initialLeaves as any}
            initialBalance={initialBalance}
            initialSalaryType={salaryType}
            initialLeaveBalances={initialLeaveBalances}
        />
    )
}
