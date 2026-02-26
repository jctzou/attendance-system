/**
 * 定義系統中所有假別的映射與顯示顏色
 * 依據 docs/specifications/attendance_record_spec.md
 */

export const LEAVE_TYPE_MAP: Record<string, string> = {
    // Standard Types
    'sick': '病假',
    'personal': '事假',
    'annual': '特休',
    'compensatory': '補休',
    'marriage': '婚假',
    'maternity': '產假',
    'paternity': '陪產假',
    'funeral': '喪假',
    'other': '其他',

    // Legacy / Alternative Types (Normalization)
    'sick_leave': '病假',
    'personal_leave': '事假',
    'annual_leave': '特休',
    'maternity_leave': '產假',
    'paternity_leave': '陪產假',
    'funeral_leave': '喪假',
};

/**
 * 取得假別對應的中文名稱
 */
export function getLeaveTypeName(type: string): string {
    return LEAVE_TYPE_MAP[type] || '未定義假別';
}

/**
 * 定義各種假別在 UI 上的標籤顏色
 * 回傳 Tailwind CSS 類別字串
 */
export function getLeaveTypeColorClass(type: string): string {
    // 預設為黃色系，符合規格書 attendance_record_spec.md 的規範
    // 特休或補休可以使用不同的顏色作為區別，若無特別規定則統一使用黃色
    switch (type) {
        case 'annual':
        case 'annual_leave':
            return 'bg-emerald-100 text-emerald-800'; // 特休
        case 'sick':
        case 'sick_leave':
            return 'bg-orange-100 text-orange-800'; // 病假
        case 'personal':
        case 'personal_leave':
            return 'bg-blue-100 text-blue-800'; // 事假
        default:
            return 'bg-yellow-100 text-yellow-800'; // 其他請假預設黃色
    }
}
