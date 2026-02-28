import { PageContainer } from '@/components/ui/PageContainer'
import { calculateAllMonthlySalaries, getAllUsers } from './actions'
import SalaryClient from './SalaryClient'

interface Props {
    searchParams: Promise<{ month?: string }>
}

export default async function AdminSalaryPage({ searchParams }: Props) {
    // 從 URL searchParams 取得月份，預設為當月
    const params = await searchParams
    const now = new Date()
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const yearMonth = params.month || defaultMonth

    // 並行取資料：批次薪資計算 + 員工清單（給設定對話框用）
    const [recordsRes, usersRes] = await Promise.all([
        calculateAllMonthlySalaries(yearMonth),
        getAllUsers(),
    ])

    const records = recordsRes.data || []
    const usersList = usersRes.data || []

    return (
        <PageContainer title="薪資管理" description="管理員工每月薪資、獎金與發放狀態" className="p-4 md:p-8">
            <SalaryClient
                initialRecords={records}
                initialYearMonth={yearMonth}
                usersList={usersList}
            />
        </PageContainer>
    )
}
