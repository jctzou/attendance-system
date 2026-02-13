import { format, parseISO } from 'date-fns'

/**
 * Formats a Date object or ISO string to a Local ISO String (YYYY-MM-DDTHH:mm)
 * suitable for <input type="datetime-local" />
 * @param date Date object, ISO string, or null/undefined
 */
export const toLocalISOString = (date?: Date | string | null): string => {
    if (!date) return ''
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return ''
    return format(d, "yyyy-MM-dd'T'HH:mm")
}

/**
 * Formats a Date object or ISO string to a Local Date String (YYYY-MM-DD)
 * suitable for <input type="date" />
 * @param date Date object, ISO string, or null/undefined
 */
export const toLocalDateString = (date?: Date | string | null): string => {
    if (!date) return ''
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return ''
    return format(d, 'yyyy-MM-dd')
}

/**
 * Converts a Local ISO String from input to a UTC ISO String for DB storage
 * @param localISOString YYYY-MM-DDTHH:mm
 */
export const toUTCISOString = (localISOString: string): string | null => {
    if (!localISOString) return null
    const d = new Date(localISOString)
    if (isNaN(d.getTime())) return null
    return d.toISOString()
}
