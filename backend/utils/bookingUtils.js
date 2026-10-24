/**
 * RentIQ Booking Utilities
 * Shared helper functions for datetime parsing, duration formatting, and authoritative pricing.
 */

/**
 * Parses and validates an incoming datetime string into calendar parts and a normalized MySQL DATETIME string.
 * Supports ISO formats ('YYYY-MM-DDTHH:mm', 'YYYY-MM-DDTHH:mm:ssZ', etc.) and space-separated ('YYYY-MM-DD HH:mm').
 *
 * @param {string} str - Input date-time string.
 * @returns {{ valid: boolean, error?: string, date?: Date, formatted?: string, dateOnly?: string, durationMs?: number }}
 */
function parseDateTime(str) {
    if (!str || typeof str !== 'string') {
        return { valid: false, error: 'A valid date and time string is required' };
    }

    const trimmed = str.trim();
    // Match YYYY-MM-DD with optional T/space and HH:mm[:ss]
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!match) {
        return { valid: false, error: 'Invalid datetime format. Expected YYYY-MM-DD HH:mm or ISO format' };
    }

    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    const hour = match[4] !== undefined ? parseInt(match[4], 10) : 0;
    const minute = match[5] !== undefined ? parseInt(match[5], 10) : 0;
    const second = match[6] !== undefined ? parseInt(match[6], 10) : 0;

    if (month < 1 || month > 12) {
        return { valid: false, error: 'Month must be between 1 and 12' };
    }
    if (day < 1 || day > 31) {
        return { valid: false, error: 'Day must be between 1 and 31' };
    }
    if (hour < 0 || hour > 23) {
        return { valid: false, error: 'Hour must be between 0 and 23' };
    }
    if (minute < 0 || minute > 59) {
        return { valid: false, error: 'Minute must be between 0 and 59' };
    }
    if (second < 0 || second > 59) {
        return { valid: false, error: 'Second must be between 0 and 59' };
    }

    // Verify calendar days in month (e.g. Feb 29/30, Apr 31)
    const testDate = new Date(year, month - 1, day, hour, minute, second);
    if (
        testDate.getFullYear() !== year ||
        testDate.getMonth() !== month - 1 ||
        testDate.getDate() !== day
    ) {
        return { valid: false, error: 'Invalid calendar date provided' };
    }

    const pad = (n) => String(n).padStart(2, '0');
    const formatted = `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`;
    const dateOnly = `${year}-${pad(month)}-${pad(day)}`;

    return {
        valid: true,
        date: testDate,
        formatted,
        dateOnly,
        year,
        month,
        day,
        hour,
        minute,
        second
    };
}

/**
 * Calculates rental duration in hours, rounded duration parts, and readable display text.
 *
 * @param {Date|string} pickup
 * @param {Date|string} ret
 * @returns {{ totalMinutes: number, durationHours: number, display: string }}
 */
function calculateRentalDuration(pickup, ret) {
    const pickupDate = pickup instanceof Date ? pickup : new Date(pickup);
    const returnDate = ret instanceof Date ? ret : new Date(ret);

    const diffMs = returnDate.getTime() - pickupDate.getTime();
    const totalMinutes = Math.round(diffMs / (1000 * 60));
    const durationHours = diffMs / (1000 * 60 * 60);

    if (totalMinutes <= 0) {
        return {
            totalMinutes: 0,
            durationHours: 0,
            display: '0 hours'
        };
    }

    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;
    const days = Math.floor(totalHours / 24);
    const hoursInDay = totalHours % 24;

    const parts = [];
    if (days > 0) {
        parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
    }
    if (hoursInDay > 0 || (days === 0 && remainingMinutes === 0)) {
        parts.push(`${hoursInDay} ${hoursInDay === 1 ? 'hour' : 'hours'}`);
    }
    if (remainingMinutes > 0) {
        parts.push(`${remainingMinutes} min`);
    }

    return {
        totalMinutes,
        durationHours,
        display: parts.join(' ')
    };
}

/**
 * Authoritative pricing calculation:
 * Hourly rate = daily rate / 24.
 * Price = actual rental duration in hours * hourly rate.
 * Uses financial rounding to 2 decimal places.
 *
 * @param {number|string} dailyRate
 * @param {number} durationHours
 * @returns {number}
 */
function calculateRentalPrice(dailyRate, durationHours) {
    const rate = Number(dailyRate);
    if (isNaN(rate) || rate <= 0 || durationHours <= 0) {
        return 0;
    }

    const hourlyRate = rate / 24;
    const rawTotal = durationHours * hourlyRate;
    // Standard currency rounding: 2 decimal places
    return Math.round(rawTotal * 100) / 100;
}

module.exports = {
    parseDateTime,
    calculateRentalDuration,
    calculateRentalPrice
};
