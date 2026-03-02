import { differenceInMinutes, parseISO } from 'date-fns';
import { getTaipeiDateString, getTaipeiTimeString, compareTimeStrings } from './timezone';

/**
 * 出勤狀態列舉
 */
export type AttendanceStatus = 'normal' | 'late' | 'early_leave' | 'absent';

/**
 * 依據排班時間判定打卡的狀態
 * 
 * @param clockInTimeStr 上班時間字串 (HH:mm:ss) 
 * @param clockOutTimeStr 下班時間字串 (HH:mm:ss, Optional)
 * @param workStartTime 表定上班時間 (HH:mm:ss)
 * @param workEndTime 表定下班時間 (HH:mm:ss)
 * @param bufferMinutes 上班時間容緩分鐘數 (Optional, e.g. 5 分鐘)
 * @returns 判定狀態 (normal, late, early_leave)
 */
export function determineAttendanceStatus(
    clockInTimeStr: string | null,
    clockOutTimeStr: string | null,
    workStartTime: string,
    workEndTime: string,
    bufferMinutes: number = 0
): AttendanceStatus {
    if (!clockInTimeStr) return 'absent';

    let status: AttendanceStatus = 'normal';

    // 將時間轉為分鐘數進行精確比較含緩衝
    const timeToMinutes = (t: string) => {
        const [h, m, s] = t.split(':').map(Number);
        return h * 60 + m + (s || 0) / 60;
    };

    const inMinutes = timeToMinutes(clockInTimeStr);
    const startMinutes = timeToMinutes(workStartTime);

    // 如果打卡時間超過了 (表定時間 + 緩衝分鐘)，才算遲到
    if (inMinutes > (startMinutes + bufferMinutes)) {
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

    // 統一四捨五入到小數第二位
    totalHours = Math.round(totalHours * 100) / 100;

    return totalHours;
}
