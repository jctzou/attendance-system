import { differenceInMinutes, parseISO } from 'date-fns';
import { getTaipeiDateString, getTaipeiTimeString, compareTimeStrings } from './timezone';

/**
 * 出勤狀態列舉
 */
export type AttendanceStatus = 'normal' | 'late' | 'early_leave' | 'absent';

/**
 * 將時間字串轉換為分鐘數進行計算
 * 
 * @param timeStr 時間字串 (HH:mm:ss 或 HH:mm)
 */
export function timeStrToMinutes(timeStr: string): number {
    if (!timeStr) return 0;
    const [h, m, s] = timeStr.split(':').map(Number);
    return Math.round((h || 0) * 60 + (m || 0) + (s || 0) / 60);
}

/**
 * 計算兩次打卡之間的淨工時 (單位：分鐘)
 * 
 * @param clockInTime ISO 上班時間 
 * @param clockOutTime ISO 下班時間
 * @param breakDuration 休息時數 (單位：小時，例如 1.0, 1.5)
 * @returns 淨工時 (單位：分鐘，整數)
 */
export function calculateWorkMinutes(
    clockInTime: string,
    clockOutTime: string,
    breakDuration: number = 0
): number {
    const inDate = parseISO(clockInTime);
    const outDate = parseISO(clockOutTime);

    // 抹除秒數與毫秒，確保與 UI 顯示的 HH:mm 分鐘數落差完全一致
    inDate.setSeconds(0, 0);
    outDate.setSeconds(0, 0);

    let totalMinutes = differenceInMinutes(outDate, inDate);
    console.log('[ENGINE] Raw diff in minutes (seconds cleared):', totalMinutes);
    if (totalMinutes <= 0) return 0;

    // 將小時轉換為分鐘扣除
    const breakMinutes = Math.round(breakDuration * 60);
    totalMinutes -= breakMinutes;
    console.log('[ENGINE] After break subtraction:', totalMinutes);

    if (totalMinutes < 0) totalMinutes = 0;

    return totalMinutes;
}
