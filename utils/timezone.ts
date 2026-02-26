import { formatInTimeZone, toDate } from 'date-fns-tz';

const TAIPEI_TZ = 'Asia/Taipei';

/**
 * 將給定的 Date 物件或時間字串轉換為台北時間的格式化字串
 * @param date - Date 物件或 ISO 格式時間字串
 * @param formatStr - date-fns 的格式字串 (e.g., 'yyyy-MM-dd')
 * @returns 台北時間的格式化字串
 */
export function formatToTaipeiTime(date: Date | string | number, formatStr: string): string {
    return formatInTimeZone(date, TAIPEI_TZ, formatStr);
}

/**
 * 取得當前台北時間的 Date 物件 (用於需要目前台北時間的場合)
 */
export function getNowInTaipei(): Date {
    // 取得當下 UTC 時間，然後將其視為台北時間轉回來的 Date
    // 注意：Date 物件本身是沒有時區概念的 (永遠是系統本地時間或 UTC)，
    // 所以這個函數回傳的 Date 會是在台北時區的「絕對時間點」。
    // date-fns-tz 的 toDate 取 UTC 並 apply timezone offset.
    // 實際上在大多數運算中，我們通常只需要拿 new Date() 然後 formatInTimeZone。
    return new Date();
}

/**
 * 將任意時間轉為台北時間的日期字串 (YYYY-MM-DD)
 */
export function getTaipeiDateString(date: Date | string | number = new Date()): string {
    return formatInTimeZone(date, TAIPEI_TZ, 'yyyy-MM-dd');
}

/**
 * 將任意時間轉為台北時間的時間字串 (HH:mm:ss)
 */
export function getTaipeiTimeString(date: Date | string | number = new Date()): string {
    return formatInTimeZone(date, TAIPEI_TZ, 'HH:mm:ss');
}

/**
 * 將本地時間表單輸入的 datetime-local (e.g. 2024-02-15T09:00) 轉回 UTC ISO string，
 * 假設該輸入是在台北時區下發生。
 */
export function fromTaipeiLocalToUTC(localDateString: string): string {
    // localDateString: "2024-02-15T09:00"
    // 利用 toDate 加上 tz 指定，它會將字串當作該時區的時間來解析成正確的 Date 物件
    const date = toDate(localDateString, { timeZone: TAIPEI_TZ });
    return date.toISOString();
}

/**
 * 檢查輸入的日期是否為週末 (六、日)
 * 基於台北時間判斷
 */
export function isWeekendInTaipei(date: Date | string | number): boolean {
    const dayOfWeek = parseInt(formatInTimeZone(date, TAIPEI_TZ, 'i'), 10);
    // 1=Monday, ..., 6=Saturday, 7=Sunday
    return dayOfWeek === 6 || dayOfWeek === 7;
}

/**
 * 比較兩個 HH:mm:ss 字串 (假定在同一天)，若 time1 大於 time2 傳回正數，小於傳回負數，相等傳回 0
 */
export function compareTimeStrings(time1: string, time2: string): number {
    // 字串格式為 HH:mm:ss，可以直接進行字串比較
    if (time1 > time2) return 1;
    if (time1 < time2) return -1;
    return 0;
}
