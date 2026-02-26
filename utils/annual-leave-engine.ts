/**
 * 特休假計算核心引擎
 * 依據 docs/specifications/annual_leave_rules_spec.md
 */

import { differenceInDays, differenceInMonths, differenceInYears, subMonths } from 'date-fns';

/**
 * 年資對應的特休天數標準 (勞基法第38條)
 * 6 個月以上，未滿 1 年 -> 3 天
 * 1 年以上，未滿 2 年 -> 7 天
 * 2 年以上，未滿 3 年 -> 10 天
 * 3 年以上，未滿 5 年 -> 14 天
 * 5 年以上，未滿 10 年 -> 15 天
 * 10 年以上 -> 15 + (年資 - 10) 天，上限 30 天
 */
export function calculateAnnualLeaveGrantDays(onboardDate: Date, targetDate: Date = new Date()): number {
    const elapsedMonths = differenceInMonths(targetDate, onboardDate);
    const elapsedYears = differenceInYears(targetDate, onboardDate);

    if (elapsedMonths < 6) return 0;
    if (elapsedMonths >= 6 && elapsedYears < 1) return 3;
    if (elapsedYears >= 1 && elapsedYears < 2) return 7;
    if (elapsedYears >= 2 && elapsedYears < 3) return 10;
    if (elapsedYears >= 3 && elapsedYears < 5) return 14;
    if (elapsedYears >= 5 && elapsedYears < 10) return 15;

    // 10年以上
    if (elapsedYears >= 10) {
        const extraDays = elapsedYears - 10;
        return Math.min(15 + extraDays, 30); // 上限 30 天
    }

    return 0;
}

/**
 * 判斷是否「滿足發放條件」
 * 週年制：只有在「滿半年那天」或「滿 N 週年那天」才觸發發放。
 * 此處簡化判斷，針對排程每日檢查使用 (檢查 `last_reset_date` 是否已涵蓋此週期)。
 */
export function shouldGrantAnnualLeave(onboardDate: Date, lastResetDate: Date | null, targetDate: Date = new Date()): boolean {
    const elapsedMonths = differenceInMonths(targetDate, onboardDate);
    const elapsedYears = differenceInYears(targetDate, onboardDate);

    // 完全未滿半年
    if (elapsedMonths < 6) return false;

    if (!lastResetDate) {
        // 從未發放過，只要滿半年就該發
        return true;
    }

    // 已發放過，檢查是否達到下一個級距
    const lastResetYears = differenceInYears(lastResetDate, onboardDate);
    const lastResetMonths = differenceInMonths(lastResetDate, onboardDate);

    // 剛滿半年，但從未以「滿半年」的身份發過
    if (elapsedMonths >= 6 && elapsedYears < 1) {
        if (lastResetMonths < 6) return true;
        return false;
    }

    // 滿 1年以上，檢查今年是不是還沒發
    if (elapsedYears >= 1) {
        if (lastResetYears < elapsedYears) {
            return true;
        }
    }

    return false;
}
