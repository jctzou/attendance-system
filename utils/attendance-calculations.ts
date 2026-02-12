
/**
 * 將 HH:mm:ss 轉為秒數，方便精確比較
 */
export function timeToSeconds(timeStr: string | null): number {
    if (!timeStr) return 0
    const parts = timeStr.split(':').map(Number)
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0)
}

/**
 * 根據打卡時間計算工時
 * @param clockInTime ISO string
 * @param clockOutTime ISO string
 * @param breakHours number (default 1.0 for hourly employees)
 * @param isHourly boolean
 * @returns number (hours, rounded to 2 decimal places)
 */
export function calculateWorkHours(
    clockInTime: string,
    clockOutTime: string,
    breakHours: number = 0,
    isHourly: boolean = false
): number {
    const inTime = new Date(clockInTime).getTime()
    const outTime = new Date(clockOutTime).getTime()

    if (outTime < inTime) return 0

    // Calculate total hours difference
    const totalHours = (outTime - inTime) / 3600000

    // Deduct break hours
    // For hourly workers, breakHours is passed dynamically (1.0, 1.5, 2.0)
    // For monthly workers, breakHours comes from user settings
    const netHours = Math.max(0, totalHours - breakHours)

    return parseFloat(netHours.toFixed(2))
}

/**
 * 判斷打卡狀態 (遲到/早退)
 * @param clockInTimeStr HH:mm:ss
 * @param clockOutTimeStr HH:mm:ss
 * @param workStartTimeStr HH:mm:ss (default 09:00:00)
 * @param workEndTimeStr HH:mm:ss (default 18:00:00)
 * @returns string ('normal', 'late', 'early_leave', 'late early_leave')
 */
export function determineAttendanceStatus(
    clockInTimeStr: string | null,
    clockOutTimeStr: string | null,
    workStartTimeStr: string = '09:00:00',
    workEndTimeStr: string = '18:00:00'
): string {
    const isLate = clockInTimeStr ? timeToSeconds(clockInTimeStr) > timeToSeconds(workStartTimeStr) : false
    const isEarlyLeave = clockOutTimeStr ? timeToSeconds(clockOutTimeStr) < timeToSeconds(workEndTimeStr) : false

    if (isLate && isEarlyLeave) {
        return 'late early_leave'
    } else if (isLate) {
        return 'late'
    } else if (isEarlyLeave) {
        return 'early_leave'
    } else {
        return 'normal'
    }
}
