import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// 註冊中文字型
// 注意：這裡使用 Google Fonts 的 Noto Sans TC
// 如果遇到 CORS 問題，建議下載字型檔案並放在 public/fonts/ 下
Font.register({
    family: 'Noto Sans TC',
    src: '/fonts/NotoSansTC-Regular.otf'
});

const styles = StyleSheet.create({
    page: {
        flexDirection: 'column',
        backgroundColor: '#FFFFFF',
        padding: 30,
        fontFamily: 'Noto Sans TC'
    },
    header: {
        marginBottom: 20,
        borderBottomWidth: 2,
        borderBottomColor: '#112233',
        paddingBottom: 10,
    },
    title: {
        fontSize: 24,
        textAlign: 'center',
        marginBottom: 5,
        fontWeight: 'bold',
    },
    subtitle: {
        fontSize: 14,
        textAlign: 'center',
        color: '#555555',
    },
    section: {
        margin: 10,
        padding: 10,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 5,
    },
    infoLabel: {
        fontSize: 12,
        color: '#666666',
    },
    infoValue: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    table: {
        display: 'flex',
        width: 'auto',
        borderStyle: 'solid',
        borderWidth: 1,
        borderRightWidth: 0,
        borderBottomWidth: 0,
        borderColor: '#bfbfbf',
        marginTop: 20,
        marginBottom: 20,
    },
    tableRow: {
        margin: 'auto',
        flexDirection: 'row',
    },
    tableCol: {
        width: '50%',
        borderStyle: 'solid',
        borderWidth: 1,
        borderLeftWidth: 0,
        borderTopWidth: 0,
        borderColor: '#bfbfbf',
    },
    tableCellHeader: {
        margin: 5,
        fontSize: 12,
        fontWeight: 'bold',
        backgroundColor: '#f0f0f0',
        textAlign: 'center',
    },
    tableCell: {
        margin: 5,
        fontSize: 12,
        textAlign: 'right',
    },
    tableCellLabel: {
        margin: 5,
        fontSize: 12,
        textAlign: 'left',
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#000000',
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        marginRight: 20,
    },
    totalValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#000000',
    },
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 30,
        right: 30,
        fontSize: 10,
        textAlign: 'center',
        color: '#888888',
    },
});

interface SalaryPDFProps {
    record: any;
    user: any;
}

const SalaryPDF = ({ record, user }: SalaryPDFProps) => (
    <Document>
        <Page size="A4" style={styles.page}>
            <View style={styles.header}>
                <Text style={styles.title}>薪資單</Text>
                <Text style={styles.subtitle}>{record.year_month} 薪資明細</Text>
            </View>

            <View style={styles.section}>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>員工姓名:</Text>
                    <Text style={styles.infoValue}>{user.display_name || user.email}</Text>
                </View>
                {user.employee_id && (
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>員工編號:</Text>
                        <Text style={styles.infoValue}>{user.employee_id}</Text>
                    </View>
                )}
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>發放日期:</Text>
                    <Text style={styles.infoValue}>{new Date().toLocaleDateString()}</Text>
                </View>
            </View>

            <View style={styles.table}>
                <View style={styles.tableRow}>
                    <View style={styles.tableCol}>
                        <Text style={styles.tableCellHeader}>項目</Text>
                    </View>
                    <View style={styles.tableCol}>
                        <Text style={styles.tableCellHeader}>金額 (TWD)</Text>
                    </View>
                </View>

                <View style={styles.tableRow}>
                    <View style={styles.tableCol}>
                        <Text style={styles.tableCellLabel}>基本薪資</Text>
                    </View>
                    <View style={styles.tableCol}>
                        <Text style={styles.tableCell}>{record.base_salary?.toLocaleString()}</Text>
                    </View>
                </View>

                {record.work_hours > 0 && (
                    <View style={styles.tableRow}>
                        <View style={styles.tableCol}>
                            <Text style={styles.tableCellLabel}>工作時數/出勤</Text>
                        </View>
                        <View style={styles.tableCol}>
                            <Text style={styles.tableCell}>{record.work_hours} 小時</Text>
                        </View>
                    </View>
                )}

                {record.bonus > 0 && (
                    <View style={styles.tableRow}>
                        <View style={styles.tableCol}>
                            <Text style={styles.tableCellLabel}>獎金</Text>
                        </View>
                        <View style={styles.tableCol}>
                            <Text style={styles.tableCell}>{record.bonus?.toLocaleString()}</Text>
                        </View>
                    </View>
                )}

                {record.deduction > 0 && (
                    <View style={styles.tableRow}>
                        <View style={styles.tableCol}>
                            <Text style={styles.tableCellLabel}>扣除額</Text>
                        </View>
                        <View style={styles.tableCol}>
                            <Text style={styles.tableCell}>- {record.deduction?.toLocaleString()}</Text>
                        </View>
                    </View>
                )}
            </View>

            <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>實發金額:</Text>
                <Text style={styles.totalValue}>TWD {record.total_salary?.toLocaleString()}</Text>
            </View>

            {record.notes && (
                <View style={[styles.section, { marginTop: 30, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10 }]}>
                    <Text style={[styles.infoLabel, { marginBottom: 5 }]}>備註:</Text>
                    <Text style={{ fontSize: 12 }}>{record.notes}</Text>
                </View>
            )}

            <Text style={styles.footer}>
                此薪資單由 Antigravity 系統自動生成，僅供參考。如有疑問請聯繫 HR。
            </Text>
        </Page>
    </Document>
);

export default SalaryPDF;
