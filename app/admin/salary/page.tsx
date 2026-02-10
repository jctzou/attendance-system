'use client'

import { useEffect, useState } from 'react'
import { getSalaryRecords, calculateMonthlySalary, upsertSalaryRecord, markAsPaid, addBonus } from './actions'
import Link from 'next/link'

export default function AdminSalaryPage() {
    const [yearMonth, setYearMonth] = useState('')
    const [records, setRecords] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [calculating, setCalculating] = useState<string | null>(null)
    const [showBonusDialog, setShowBonusDialog] = useState<any>(null)
    const [bonusAmount, setBonusAmount] = useState('')
    const [bonusReason, setBonusReason] = useState('')

    useEffect(() => {
        // 設定當前月份
        const now = new Date()
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        setYearMonth(currentMonth)
    }, [])

    useEffect(() => {
        if (yearMonth) {
            fetchRecords()
        }
    }, [yearMonth])

    const fetchRecords = async () => {
        setLoading(true)
        const res = await getSalaryRecords(yearMonth)
        if (res.data) {
            setRecords(res.data)
        }
        setLoading(false)
    }

    const handleCalculate = async (userId: string) => {
        setCalculating(userId)
        const res = await calculateMonthlySalary(userId, yearMonth)
        if (res.data) {
            await upsertSalaryRecord(userId, yearMonth, res.data)
            await fetchRecords()
        }
        setCalculating(null)
    }

    const handleMarkPaid = async (recordId: number) => {
        await markAsPaid(recordId)
        await fetchRecords()
    }

    const handleAddBonus = async () => {
        if (!showBonusDialog || !bonusAmount) return

        await addBonus(showBonusDialog.user_id, parseFloat(bonusAmount), bonusReason)
        setShowBonusDialog(null)
        setBonusAmount('')
        setBonusReason('')
        await fetchRecords()
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white border-b shadow-sm h-16 flex items-center justify-between px-6">
                <div className="font-bold text-lg text-blue-600">💰 薪資管理</div>
                <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
                    ← 回首頁
                </Link>
            </nav>

            <div className="max-w-7xl mx-auto py-10 px-4">
                <div className="mb-6 flex items-center gap-4">
                    <label className="font-bold text-gray-700">選擇月份：</label>
                    <input
                        type="month"
                        value={yearMonth}
                        onChange={(e) => setYearMonth(e.target.value)}
                        className="px-4 py-2 border rounded-md"
                    />
                    <button
                        onClick={fetchRecords}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                        🔄 重新整理
                    </button>
                </div>

                {loading ? (
                    <div className="text-center py-10 text-gray-500">載入中...</div>
                ) : (
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">員工</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">類型</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">工時</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">基本薪資</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">獎金</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">總薪資</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">狀態</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {records.map((record) => (
                                    <tr key={record.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            <div className="font-medium">{record.user?.display_name}</div>
                                            <div className="text-sm text-gray-500">{record.user?.email}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 text-xs rounded ${record.user?.salary_type === 'hourly' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                                                }`}>
                                                {record.user?.salary_type === 'hourly' ? '鐘點' : '月薪'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">{record.work_hours || '-'} hr</td>
                                        <td className="px-6 py-4">${record.base_salary?.toLocaleString()}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                ${record.bonus?.toLocaleString() || 0}
                                                <button
                                                    onClick={() => setShowBonusDialog(record)}
                                                    className="text-blue-600 hover:text-blue-800 text-sm"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-bold">${record.total_salary?.toLocaleString()}</td>
                                        <td className="px-6 py-4">
                                            {record.is_paid ? (
                                                <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-800">
                                                    已發放
                                                </span>
                                            ) : (
                                                <span className="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-800">
                                                    未發放
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleCalculate(record.user_id)}
                                                    disabled={calculating === record.user_id}
                                                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                                                >
                                                    {calculating === record.user_id ? '計算中...' : '重算'}
                                                </button>
                                                {!record.is_paid && (
                                                    <button
                                                        onClick={() => handleMarkPaid(record.id)}
                                                        className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                                                    >
                                                        標記已發
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {records.length === 0 && (
                            <div className="text-center py-10 text-gray-500">
                                此月份尚無薪資記錄
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 追加獎金對話框 */}
            {showBonusDialog && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-96">
                        <h3 className="text-lg font-bold mb-4">追加獎金</h3>
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-2">員工</label>
                            <div className="text-gray-700">{showBonusDialog.user?.display_name}</div>
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-2">獎金金額</label>
                            <input
                                type="number"
                                value={bonusAmount}
                                onChange={(e) => setBonusAmount(e.target.value)}
                                className="w-full px-3 py-2 border rounded-md"
                                placeholder="輸入金額"
                            />
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-2">獎金原因</label>
                            <textarea
                                value={bonusReason}
                                onChange={(e) => setBonusReason(e.target.value)}
                                className="w-full px-3 py-2 border rounded-md"
                                rows={3}
                                placeholder="輸入獎金原因"
                            />
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => {
                                    setShowBonusDialog(null)
                                    setBonusAmount('')
                                    setBonusReason('')
                                }}
                                className="px-4 py-2 border rounded-md hover:bg-gray-50"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleAddBonus}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                            >
                                確認追加
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
