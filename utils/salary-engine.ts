/**
 * 薪資計算核心引擎
 * 依據 docs/specifications/salary_optimization_spec.md
 */

export interface SalaryParams {
    userId: string;
    salaryType: 'hourly' | 'monthly';
    baseSalary: number;
    hourlyRate: number;
    // ... 其他可傳入的參數，如出勤紀錄陣列、請假陣列等
    attendanceRecords: any[];
    leaveRecords: any[];
    bonuses?: number;
    deductions?: number;
}

export interface SalaryCalculationResult {
    totalWorkingHours: number;
    basicSalaryAmount: number;     // 根據工時或月薪算出的本薪
    bonusAmount: number;           // 獎金
    deductionAmount: number;       // 扣款
    totalAmount: number;           // 實發總計
    details: any;                  // 供前端明細展開
}

/**
 * 核心計薪邏輯
 * 注意：這裡必須由後端呼叫，前端不得直接運算
 */
export function calculateSalary(params: SalaryParams): SalaryCalculationResult {
    let basicSalaryAmount = 0;
    let totalWorkingHours = 0;

    // 1. 總工時統計 (來自 attendanceRecords)
    params.attendanceRecords.forEach(record => {
        if (record.work_minutes) {
            totalWorkingHours += Number(record.work_minutes);
        }
    });

    // 2. 本薪計算
    if (params.salaryType === 'hourly') {
        basicSalaryAmount = totalWorkingHours * params.hourlyRate;
    } else {
        // 月薪制: 直接帶入 baseSalary (但需考慮請假扣薪, 這裡為求簡化先全薪，未來可擴充扣薪細節)
        basicSalaryAmount = params.baseSalary;
    }

    // 3. 其他加減法
    const bonusAmount = params.bonuses || 0;
    const deductionAmount = params.deductions || 0;

    const totalAmount = basicSalaryAmount + bonusAmount - deductionAmount;

    return {
        totalWorkingHours,
        basicSalaryAmount,
        bonusAmount,
        deductionAmount,
        totalAmount,
        details: {
            // 可放置細項如遲到幾次扣款等，依據規格隨時擴增
            attendanceCount: params.attendanceRecords.length,
            leavesCount: params.leaveRecords.length,
        }
    };
}
