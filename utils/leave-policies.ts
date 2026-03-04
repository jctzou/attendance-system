/**
 * 請假系統全域法規配置 (Leave System Policies)
 * 根據最新勞基法與公司規定設定。
 * 
 * - 曆年制 (Calendar Year): 1/1 ~ 12/31 重新計算額度。
 * - 週年制 (Anniversary Year): 依員工到職日計算 (如特休)。
 */

export type LeaveType = 'personal_leave' | 'sick_leave' | 'family_care_leave' | 'menstrual_leave' | 'annual_leave';

export interface LeavePolicy {
    id: LeaveType;
    name: string;
    /** 全年/全月上限天數 (null 代表無單獨上限或適用特休依個人設定) */
    maxDaysPerYear: number | null;
    /** 扣薪權重 (1.0 = 扣全薪, 0.5 = 扣半薪, 0.0 = 不扣薪) */
    deductionWeight: number;
    /** 額度計算週期 */
    cycle: 'calendar_year' | 'anniversary_year' | 'monthly';
    /** 描述 */
    description: string;
}

export const LEAVE_POLICIES: Record<LeaveType, LeavePolicy> = {
    personal_leave: {
        id: 'personal_leave',
        name: '事假',
        maxDaysPerYear: 14,
        deductionWeight: 1.0,
        cycle: 'calendar_year',
        description: '全年上限 14 天，不給薪 (扣全薪)'
    },
    sick_leave: {
        id: 'sick_leave',
        name: '病假',
        maxDaysPerYear: 30, // 未住院
        deductionWeight: 0.5,
        cycle: 'calendar_year',
        description: '全年上限 30 天 (未住院)，折半發給 (扣半薪)'
    },
    family_care_leave: {
        id: 'family_care_leave',
        name: '家庭照顧假',
        maxDaysPerYear: 7, // 且併入事假計算
        deductionWeight: 1.0,
        cycle: 'calendar_year',
        description: '全年上限 7 天 (併入事假 14 天額度內)，不給薪 (扣全薪)'
    },
    menstrual_leave: {
        id: 'menstrual_leave',
        name: '生理假',
        maxDaysPerYear: 1, // 這裡定義為每月上限 1 天的特別參數。
        deductionWeight: 0.5,
        cycle: 'monthly',
        description: '每月上限 1 天，折半發給 (扣半薪)'
    },
    annual_leave: {
        id: 'annual_leave',
        name: '特休',
        maxDaysPerYear: null, // 由 users.annual_leave_total 決定
        deductionWeight: 0.0,
        cycle: 'anniversary_year',
        description: '依到職日計算週年制，不扣薪'
    }
};

/**
 * 取得假別中文名稱 (含向後相容舊資料)
 */
export function getLeaveTypeName(type: string): string {
    const policy = LEAVE_POLICIES[type as LeaveType];
    if (policy) return policy.name;

    // 向後相容舊資料
    const legacyMap: Record<string, string> = {
        'annual': '特休',
        'other': '其他'
    };
    return legacyMap[type] || type;
}

/**
 * 取得假別扣薪權重 (預設 1.0 扣全薪)
 */
export function getLeaveDeductionWeight(type: string): number {
    const policy = LEAVE_POLICIES[type as LeaveType];
    if (policy) return policy.deductionWeight;

    // 舊資料 annual 視同特休不扣薪
    if (type === 'annual') return 0.0;

    // 其他舊資料 (如 other) 預設扣全薪
    return 1.0;
}
