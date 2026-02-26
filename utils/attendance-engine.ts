import { differenceInMinutes, parseISO } from 'date-fns';
import { getTaipeiDateString, getTaipeiTimeString, compareTimeStrings } from './timezone';

/**
 * 出勤狀態列舉
 */
export type AttendanceStatus = 'normal' | 'late' | 'early_leave' | 'absent';

/**
 * 依據排班時間判定打卡的狀態
 * 
 * @param clockInTime 上班時間字串 (HH:mm:ss) 
 * @param clockOutTime 下班時間字串 (HH:mm:ss, Optional)
 * @param workStartTime 表定上班時間 (HH:mm:ss)
 * @param workEndTime 表定下班時間 (HH:mm:ss)
 * @returns 判定狀態 (normal, late, early_leave)
 */
export function determineAttendanceStatus(
    clockInTimeStr: string | null,
    clockOutTimeStr: string | null,
    workStartTime: string,
    workEndTime: string
): AttendanceStatus {
    if (!clockInTimeStr) return 'absent';

    let status: AttendanceStatus = 'normal';

    if (compareTimeStrings(clockInTimeStr, workStartTime) > 0) {
        status = 'late';
    }

    if (clockOutTimeStr && compareTimeStrings(clockOutTimeStr, workEndTime) < 0) {
        status = 'early_leave';
    }

    return status;
}

/**
 * 計算兩次打卡之間的淨工時
 * 
 * @param clockInTime ISO 上班時間 
 * @param clockOutTime ISO 下班時間
 * @param breakHours 午休/休息小時數 (例如 1.0, 1.5)
 * @param isHourly 是否為時薪制
 * @returns 淨工時 (小數，如 8.0, 7.5)
 */
export function calculateWorkHours(
    clockInTime: string,
    clockOutTime: string,
    breakHours: number = 0,
    isHourly: boolean = false
): number {
    const inDate = parseISO(clockInTime);
    const outDate = parseISO(clockOutTime);

    const totalMinutes = differenceInMinutes(outDate, inDate);
    if (totalMinutes <= 0) return 0;

    let totalHours = totalMinutes / 60;
    totalHours -= breakHours;

    if (totalHours < 0) totalHours = 0;

    if (isHourly) {
        // 向下取整到 0.5
        totalHours = Math.floor(totalHours * 2) / 2;
    } else {
        // 四捨五入到小數第二位
        totalHours = Math.round(totalHours * 100) / 100;
    }

    return totalHours;
}
