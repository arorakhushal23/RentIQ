/**
 * RentIQ Frontend Booking Utilities
 * Timezone-safe datetime parsing, duration formatting, and price calculations.
 */

/**
 * Format a Date object into local 'YYYY-MM-DDTHH:mm' string.
 */
export function formatLocalDateTime(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0')
    const y = date.getFullYear()
    const m = pad(date.getMonth() + 1)
    const d = pad(date.getDate())
    const h = pad(date.getHours())
    const min = pad(date.getMinutes())
    return `${y}-${m}-${d}T${h}:${min}`
}

/**
 * Format a Date object into local 'YYYY-MM-DD' date string for <input type="date">.
 */
export function formatLocalDate(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0')
    const y = date.getFullYear()
    const m = pad(date.getMonth() + 1)
    const d = pad(date.getDate())
    return `${y}-${m}-${d}`
}

/**
 * Format a Date object into local 'HH:mm' time string for <input type="time">.
 */
export function formatLocalTime(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0')
    const h = pad(date.getHours())
    const min = pad(date.getMinutes())
    return `${h}:${min}`
}

/**
 * Parses a date-time string ('YYYY-MM-DDTHH:mm', 'YYYY-MM-DD HH:mm:ss', etc.) into local components
 * avoiding UTC offset shifts.
 */
export function parseDateTime(dateTimeStr) {
    if (!dateTimeStr || typeof dateTimeStr !== 'string') return null
    const match = dateTimeStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/)
    if (!match) return null

    const year = parseInt(match[1], 10)
    const month = parseInt(match[2], 10)
    const day = parseInt(match[3], 10)
    const hour = match[4] !== undefined ? parseInt(match[4], 10) : 0
    const minute = match[5] !== undefined ? parseInt(match[5], 10) : 0
    const second = match[6] !== undefined ? parseInt(match[6], 10) : 0

    const date = new Date(year, month - 1, day, hour, minute, second)
    return {
        year,
        month,
        day,
        hour,
        minute,
        second,
        date
    }
}

/**
 * Add specified number of hours to a datetime string and return 'YYYY-MM-DDTHH:mm'.
 */
export function addHours(dateTimeStr, hours = 2) {
    const parsed = parseDateTime(dateTimeStr)
    if (!parsed) return ''
    const date = new Date(parsed.date.getTime() + hours * 60 * 60 * 1000)
    return formatLocalDateTime(date)
}

/**
 * Formats a datetime string for clear, readable display including date and time.
 * e.g. "25 Oct 2026, 10:00 AM"
 */
export function formatDisplayDateTime(dateTimeStr) {
    if (!dateTimeStr) return 'Not available'
    const parsed = parseDateTime(dateTimeStr)
    if (!parsed || isNaN(parsed.date.getTime())) return dateTimeStr

    const datePart = parsed.date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    })
    const timePart = parsed.date.toLocaleTimeString('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    })
    return `${datePart}, ${timePart}`
}

/**
 * Formats a short datetime string for table rows:
 * e.g. "25/10/2026 10:00 AM"
 */
export function formatShortDateTime(dateTimeStr) {
    if (!dateTimeStr) return '—'
    const parsed = parseDateTime(dateTimeStr)
    if (!parsed || isNaN(parsed.date.getTime())) return dateTimeStr

    const pad = (n) => String(n).padStart(2, '0')
    const day = pad(parsed.day)
    const month = pad(parsed.month)
    const year = parsed.year

    const timePart = parsed.date.toLocaleTimeString('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    })
    return `${day}/${month}/${year} ${timePart}`
}

/**
 * Calculates rental duration parts and human-readable text.
 * Formats as "2 hours", "3 hours", "1 day", "1 day 3 hours", "2 days", etc.
 */
export function calculateRentalDuration(pickupStr, returnStr) {
    const pickupParsed = parseDateTime(pickupStr)
    const returnParsed = parseDateTime(returnStr)

    if (!pickupParsed || !returnParsed) {
        return {
            totalMinutes: 0,
            durationHours: 0,
            display: ''
        }
    }

    const diffMs = returnParsed.date.getTime() - pickupParsed.date.getTime()
    const totalMinutes = Math.round(diffMs / (1000 * 60))
    const durationHours = diffMs / (1000 * 60 * 60)

    if (totalMinutes <= 0) {
        return {
            totalMinutes: 0,
            durationHours: 0,
            display: '0 hours'
        }
    }

    const totalHours = Math.floor(totalMinutes / 60)
    const remainingMinutes = totalMinutes % 60
    const days = Math.floor(totalHours / 24)
    const hoursInDay = totalHours % 24

    const parts = []
    if (days > 0) {
        parts.push(`${days} ${days === 1 ? 'day' : 'days'}`)
    }
    if (hoursInDay > 0 || (days === 0 && remainingMinutes === 0)) {
        parts.push(`${hoursInDay} ${hoursInDay === 1 ? 'hour' : 'hours'}`)
    }
    if (remainingMinutes > 0) {
        parts.push(`${remainingMinutes} min`)
    }

    return {
        totalMinutes,
        durationHours,
        display: parts.join(' ')
    }
}

/**
 * Authoritative pricing calculation:
 * Hourly rate = daily rate / 24.
 * Price = actual rental duration in hours * hourly rate.
 * Uses financial rounding to 2 decimal places.
 */
export function calculateRentalPrice(pricePerDay, durationHours) {
    const rate = Number(pricePerDay)
    if (isNaN(rate) || rate <= 0 || durationHours <= 0) return 0
    const hourlyRate = rate / 24
    const rawTotal = durationHours * hourlyRate
    return Math.round(rawTotal * 100) / 100
}
