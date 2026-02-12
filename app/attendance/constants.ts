export const LEAVE_TYPE_MAP: Record<string, string> = {
    'sick': '病假',
    'personal': '事假',
    'annual': '特休',
    'compensatory': '補休',
    'marriage': '婚假',
    'maternity': '產假',
    'paternity': '陪產假',
    'funeral': '喪假',
    'other': '其他',
    // Legacy / Alternative Types
    'sick_leave': '病假',
    'personal_leave': '事假',
    'annual_leave': '特休',
    'maternity_leave': '產假',
    'paternity_leave': '陪產假',
    'funeral_leave': '喪假',
}

export const WEEKDAY_MAP: Record<number, string> = {
    0: '日',
    1: '一',
    2: '二',
    3: '三',
    4: '四',
    5: '五',
    6: '六',
}
