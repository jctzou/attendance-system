import React from 'react'
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'

Font.register({
    family: 'Noto Sans TC',
    src: '/fonts/NotoSansTC-Regular.otf'
})

const styles = StyleSheet.create({
    page: { flexDirection: 'column', backgroundColor: '#FFFFFF', padding: 36, fontFamily: 'Noto Sans TC' },
    header: { marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#1d4ed8', paddingBottom: 12 },
    title: { fontSize: 22, textAlign: 'center', fontWeight: 'bold', marginBottom: 4 },
    subtitle: { fontSize: 12, textAlign: 'center', color: '#64748b' },
    infoSection: { marginBottom: 18 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    infoLabel: { fontSize: 11, color: '#64748b' },
    infoValue: { fontSize: 11, fontWeight: 'bold' },
    sectionTitle: { fontSize: 12, fontWeight: 'bold', color: '#1e293b', marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5, alignItems: 'center' },
    rowLabel: { fontSize: 11, color: '#475569' },
    rowValue: { fontSize: 11, fontWeight: 'bold' },
    rowValueBonus: { fontSize: 11, fontWeight: 'bold', color: '#d97706' },
    rowValueDeduct: { fontSize: 11, fontWeight: 'bold', color: '#dc2626' },
    subRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3, paddingLeft: 14 },
    subLabel: { fontSize: 9, color: '#94a3b8' },
    subValue: { fontSize: 9, color: '#f87171' },
    divider: { borderTopWidth: 1, borderTopColor: '#e2e8f0', marginVertical: 8 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 2, borderTopColor: '#059669' },
    totalLabel: { fontSize: 15, fontWeight: 'bold' },
    totalValue: { fontSize: 22, fontWeight: 'bold', color: '#059669' },
    notesBox: { marginTop: 20, padding: 10, backgroundColor: '#f8fafc', borderRadius: 4 },
    footer: { position: 'absolute', bottom: 24, left: 36, right: 36, fontSize: 9, textAlign: 'center', color: '#94a3b8' },
})

const LEAVE_MAP: Record<string, { name: string; weight: number }> = {
    'personal_leave': { name: '事假', weight: 1 },
    'sick_leave': { name: '病假（未住院）', weight: 0.5 },
    'family_care_leave': { name: '家庭照顧假', weight: 1 },
    'menstrual_leave': { name: '生理假', weight: 0.5 },
    'annual_leave': { name: '特休假', weight: 0 },
    'other': { name: '其他假', weight: 1 },
}

function fmtMoney(val: number | undefined | null): string {
    if (val === undefined || val === null) return '$0'
    return '$' + Math.ceil(val).toLocaleString()
}
function fmtHM(minutes: number | undefined | null): string {
    if (!minutes) return '-'
    const h = Math.floor(minutes / 60)
    const m = Math.round(minutes % 60)
    if (h === 0) return `${m}分`
    if (m === 0) return `${h}小時`
    return `${h}小時${m}分`
}

interface SalaryPDFProps {
    record: any
    user: any
}

const SalaryPDF = ({ record, user }: SalaryPDFProps) => {
    const s = record.settled_data as any
    const isHourly = (user?.salary_type || s?.salaryType) === 'hourly'
    const baseSalary: number = s?.base_salary ?? record.base_salary ?? 0
    const bonus: number = s?.bonus ?? record.bonus ?? 0
    const deduction: number = s?.details?.deduction ?? record.deduction ?? 0
    const totalSalary: number = s?.total_salary ?? record.total_salary ?? 0
    const workMinutes: number = s?.work_minutes ?? record.work_minutes ?? 0
    const rate: number = s?.rate ?? record.rate ?? baseSalary
    const leaveDays: number = s?.details?.leaveDays ?? 0
    const leaveDetails: Record<string, number> = s?.details?.leaveDetails ?? record.details?.leaveDetails ?? {}
    const dailyRate = isHourly ? 0 : rate / 30

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>薪  資  單</Text>
                    <Text style={styles.subtitle}>{record.year_month} 薪資明細</Text>
                </View>

                {/* 員工資訊 */}
                <View style={styles.infoSection}>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>員工姓名</Text>
                        <Text style={styles.infoValue}>{user?.display_name || user?.email || '-'}</Text>
                    </View>
                    {user?.employee_id && (
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>員工編號</Text>
                            <Text style={styles.infoValue}>{user.employee_id}</Text>
                        </View>
                    )}
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>薪資制度</Text>
                        <Text style={styles.infoValue}>{isHourly ? '鐘點制' : '月薪制'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>結算日期</Text>
                        <Text style={styles.infoValue}>{record.paid_at ? new Date(record.paid_at).toLocaleDateString('zh-TW') : '-'}</Text>
                    </View>
                </View>

                {/* 薪資拆解 */}
                <Text style={styles.sectionTitle}>薪資計算明細</Text>

                {/* 基本薪資 */}
                <View style={styles.row}>
                    <Text style={styles.rowLabel}>
                        {isHourly ? `基本計算（$${rate.toLocaleString()} × ${fmtHM(workMinutes)}）` : '月薪基本薪資'}
                    </Text>
                    <Text style={styles.rowValue}>{fmtMoney(baseSalary)}</Text>
                </View>

                {/* 獎金 */}
                {bonus > 0 && (
                    <View style={styles.row}>
                        <Text style={styles.rowLabel}>獎金 / 補貼{record.notes ? `（${record.notes}）` : ''}</Text>
                        <Text style={styles.rowValueBonus}>+{fmtMoney(bonus)}</Text>
                    </View>
                )}

                {/* 假勤扣除 */}
                {deduction > 0 && (
                    <>
                        <View style={styles.row}>
                            <Text style={styles.rowLabel}>假勤扣除{leaveDays > 0 ? `（共 ${leaveDays} 天）` : ''}</Text>
                            <Text style={styles.rowValueDeduct}>-{fmtMoney(deduction)}</Text>
                        </View>
                        {/* 假別明細 */}
                        {!isHourly && Object.entries(leaveDetails).map(([type, count]) => {
                            const info = LEAVE_MAP[type]
                            if (!info || info.weight === 0) return null
                            const deductVal = Math.ceil(dailyRate * (count as number) * info.weight)
                            return (
                                <View key={type} style={styles.subRow}>
                                    <Text style={styles.subLabel}>↳ {info.name} {count as number}天 × {info.weight} 係數</Text>
                                    <Text style={styles.subValue}>-{fmtMoney(deductVal)}</Text>
                                </View>
                            )
                        })}
                    </>
                )}

                {/* 實發合計 */}
                <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>實領薪資</Text>
                    <Text style={styles.totalValue}>{fmtMoney(totalSalary)}</Text>
                </View>

                {/* 備註 */}
                {record.notes && (
                    <View style={styles.notesBox}>
                        <Text style={{ fontSize: 10, color: '#64748b', marginBottom: 3 }}>備註</Text>
                        <Text style={{ fontSize: 11 }}>{record.notes}</Text>
                    </View>
                )}

                <Text style={styles.footer}>
                    本薪資單由系統自動生成，如有疑問請聯繫 HR 或主管。
                </Text>
            </Page>
        </Document>
    )
}

export default SalaryPDF
