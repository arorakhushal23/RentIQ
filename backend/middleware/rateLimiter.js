/**
 * Rate Limiting Middleware for Sensitive Auth Operations
 *
 * Prevents automated brute-force / email flooding.
 */

const resetAttempts = new Map();

/**
 * In-memory sliding-window rate limiter for forgot-password
 * Allows up to maxAttempts per windowMs per IP / identifier
 */
function forgotPasswordRateLimiter(options = {}) {
    const windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes
    const maxAttempts = options.maxAttempts || 5;

    return (req, res, next) => {
        const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
        const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        const key = `${clientIp}_${rawEmail}`;

        const now = Date.now();
        const clientRecord = resetAttempts.get(key) || { count: 0, resetTime: now + windowMs };

        // If window has passed, reset counter
        if (now > clientRecord.resetTime) {
            clientRecord.count = 0;
            clientRecord.resetTime = now + windowMs;
        }

        clientRecord.count++;
        resetAttempts.set(key, clientRecord);

        // Periodic cleanup of stale entries (every 100 items)
        if (resetAttempts.size > 200) {
            for (const [k, v] of resetAttempts.entries()) {
                if (now > v.resetTime) {
                    resetAttempts.delete(k);
                }
            }
        }

        if (clientRecord.count > maxAttempts) {
            const retryAfterSeconds = Math.ceil((clientRecord.resetTime - now) / 1000);
            res.setHeader('Retry-After', retryAfterSeconds);
            return res.status(429).json({
                message: 'Too many password reset requests. Please wait a few minutes before trying again.'
            });
        }

        next();
    };
}

function clearRateLimitHistory() {
    resetAttempts.clear();
}

module.exports = {
    forgotPasswordRateLimiter,
    clearRateLimitHistory
};

