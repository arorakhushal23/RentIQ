const db = require('../config/db');

/**
 * Administrator Authorization Middleware
 *
 * Verifies that the incoming request originates from an authenticated user
 * whose current role in the database is strictly 'admin'.
 *
 * Pre-requisite: Must be chained after authMiddleware, which decodes the JWT
 * and attaches `req.user`.
 *
 * Security Guarantees:
 * 1. Requires valid authenticated session (returns 401 if missing).
 * 2. Checks current role directly in MySQL (freshness guarantee against demotions/deletions).
 * 3. Never trusts roles supplied in request body, query params, or headers.
 * 4. Rejects non-admin users with 403 Forbidden.
 */
const adminMiddleware = async (req, res, next) => {
    try {
        // 1. Verify that authentication middleware has executed and identified the user
        if (!req.user || !req.user.user_id) {
            return res.status(401).json({
                message: 'Authentication required'
            });
        }

        // 2. Query MySQL using parameterized SQL to confirm user existence and active role
        const [users] = await db.query(
            'SELECT user_id, role FROM users WHERE user_id = ?',
            [req.user.user_id]
        );

        // 3. Reject if the account no longer exists in the database
        if (users.length === 0) {
            return res.status(401).json({
                message: 'Authentication required'
            });
        }

        const currentUser = users[0];

        // 4. Verify that the current database role is strictly 'admin'
        if (currentUser.role !== 'admin') {
            return res.status(403).json({
                message: 'Access denied: Administrator privileges required'
            });
        }

        // 5. Synchronize req.user.role with verified database role for downstream handlers
        req.user.role = currentUser.role;

        // 6. Authorization successful; proceed to controller
        next();
    } catch (error) {
        console.error('Admin authorization error:', error.message);

        // Return generic error without exposing SQL details or credentials
        return res.status(500).json({
            message: 'Internal server error'
        });
    }
};

module.exports = adminMiddleware;
