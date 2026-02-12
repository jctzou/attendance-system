import { differenceInMonths, differenceInYears } from 'date-fns'

/**
 * 根據到職日計算特定年份的特休天數
 * 規則參考台灣勞基法：
 * - 6個月以上1年未滿者，3日。
 * - 1年以上2年未滿者，7日。
 * - 2年以上3年未滿者，10日。
 * - 3年以上5年未滿者，每年14日。
 * - 5年以上10年未滿者，每年15日。
 * - 10年以上者，每1年加給1日，加至30日為止。
 * 
 * @param hireDate 到職日期
 * @param targetYear 目標年份 (預設為今年)
 */
export function calculateAnnualLeaveDays(hireDateStr: string, targetYear: number = new Date().getFullYear()): number {
    const hireDate = new Date(hireDateStr)
    const calculationDate = new Date(targetYear, 11, 31) // 以該年底計算年資

    // 簡單計算年資 (以年底為準)
    const yearsOfService = differenceInYears(calculationDate, hireDate)
    const monthsOfService = differenceInMonths(calculationDate, hireDate)

    if (monthsOfService < 6) {
        return 0
    } else if (monthsOfService >= 6 && yearsOfService < 1) {
        return 3
    } else if (yearsOfService >= 1 && yearsOfService < 2) {
        return 7
    } else if (yearsOfService >= 2 && yearsOfService < 3) {
        return 10
    } else if (yearsOfService >= 3 && yearsOfService < 5) {
        return 14
    } else if (yearsOfService >= 5 && yearsOfService < 10) {
        return 15
    } else {
        // 10年以上，每年加1日，上限30日
        const extraDays = yearsOfService - 10
        return Math.min(15 + extraDays, 30)
    }
}
