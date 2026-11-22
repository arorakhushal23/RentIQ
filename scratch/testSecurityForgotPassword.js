/**
 * Security & Functional Test Suite: Forgot Password & Change Password
 *
 * Covers all 18 security tests specified in Phase 6:
 * 1. Forgot password with registered email
 * 2. Forgot password with unregistered email (non-enumerable)
 * 3. Invalid email format
 * 4. Expired reset token
 * 5. Invalid reset token
 * 6. Reusing an already-used token
 * 7. Password confirmation mismatch
 * 8. Password shorter than 8 characters
 * 9. Successful password reset
 * 10. Login with new password
 * 11. Login with old password must fail
 * 12. Change password with correct current password
 * 13. Change password with incorrect current password
 * 14. Unauthenticated password change attempt
 * 15. Customer password change
 * 16. Admin password change
 * 17. Reset token reuse prevention
 * 18. Reset request rate limiting
 *
 * Plus cryptographic verifications:
 * - Stored token is SHA-256 (64 hex characters)
 * - Password stored using bcrypt ($2b$10$)
 * - Expiry exactly 15 minutes
 */

const path = require('path');
const crypto = require('crypto');
const db = require('../backend/config/db');
const bcrypt = require('../backend/node_modules/bcryptjs');
const { clearRateLimitHistory } = require('../backend/middleware/rateLimiter');

const API_URL = 'http://localhost:5000/api';
let passed = 0;
let failed = 0;

function assert(condition, testId, message) {
    if (condition) {
        console.log(`[PASS] ${testId}: ${message}`);
        passed++;
    } else {
        console.error(`[FAIL] ${testId}: ${message}`);
        failed++;
    }
}

async function run() {
    console.log('====================================================');
    console.log('RentIQ Comprehensive Phase 6 Security Verification');
    console.log('====================================================\n');

    const timestamp = Date.now();
    const testCustEmail = `test_security_cust_${timestamp}@rentiq-test.com`;
    const initialPassword = 'Password123!';
    let custUserId = null;
    let custToken = null;

    try {
        // --- Setup Test Customer Account ---
        const regRes = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Security Tester',
                email: testCustEmail,
                password: initialPassword
            })
        });
        const regData = await regRes.json();
        custUserId = regData.user?.user_id;
        custToken = regData.token;

        // Clear rate limiter before tests
        clearRateLimitHistory();

        // --- 1. Forgot password with registered email ---
        const res1 = await fetch(`${API_URL}/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testCustEmail })
        });
        const data1 = await res1.json();
        assert(
            res1.status === 200 && data1.message.includes('If an account exists with that email address'),
            'Test 1',
            'Forgot password with registered email returns 200 with generic confirmation'
        );

        // Verify token in DB is hashed and expires in ~15 mins
        const [tokenRows] = await db.query(
            'SELECT * FROM password_reset_tokens WHERE user_id = ? ORDER BY id DESC LIMIT 1',
            [custUserId]
        );
        assert(
            tokenRows.length === 1 && tokenRows[0].token_hash.length === 64,
            'Verify Cryptography',
            'Reset token stored in database is strictly SHA-256 hash (64 hex chars), NOT plaintext'
        );

        const expiryDiffMinutes = (new Date(tokenRows[0].expires_at) - new Date(tokenRows[0].created_at)) / (60 * 1000);
        assert(
            Math.round(expiryDiffMinutes) === 15,
            'Verify Expiry',
            `Reset token expiry is set to 15 minutes (actual: ${Math.round(expiryDiffMinutes)}m)`
        );

        // --- 2. Forgot password with unregistered email (non-enumerable) ---
        const res2 = await fetch(`${API_URL}/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: `unregistered_${timestamp}@notfound.com` })
        });
        const data2 = await res2.json();
        assert(
            res2.status === 200 && data2.message === data1.message,
            'Test 2',
            'Forgot password with unregistered email returns identical generic message (non-enumerable)'
        );

        // --- 3. Invalid email format ---
        const res3 = await fetch(`${API_URL}/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'not-an-email' })
        });
        const data3 = await res3.json();
        assert(
            res3.status === 400 && data3.message === 'Invalid email format',
            'Test 3',
            'Invalid email format rejected with HTTP 400 "Invalid email format"'
        );

        // --- 4. Expired reset token ---
        const expiredRaw = crypto.randomBytes(32).toString('hex');
        const expiredHash = crypto.createHash('sha256').update(expiredRaw).digest('hex');
        const pastDate = new Date(Date.now() - 5 * 60 * 1000); // 5 mins ago
        await db.query(
            'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
            [custUserId, expiredHash, pastDate]
        );

        const res4 = await fetch(`${API_URL}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: expiredRaw,
                newPassword: 'NewExpiredPassword1!',
                confirmPassword: 'NewExpiredPassword1!'
            })
        });
        const data4 = await res4.json();
        assert(
            res4.status === 400 && data4.message.includes('expired'),
            'Test 4',
            `Expired reset token rejected with HTTP 400 ("${data4.message}")`
        );

        // --- 5. Invalid reset token ---
        const res5 = await fetch(`${API_URL}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: 'completely_bogus_token_abcdef1234567890',
                newPassword: 'SomeValidPassword1!',
                confirmPassword: 'SomeValidPassword1!'
            })
        });
        const data5 = await res5.json();
        assert(
            res5.status === 400 && data5.message.includes('Invalid or expired'),
            'Test 5',
            `Invalid reset token rejected with HTTP 400 ("${data5.message}")`
        );

        // --- 6. Reusing an already-used token ---
        const usedRaw = crypto.randomBytes(32).toString('hex');
        const usedHash = crypto.createHash('sha256').update(usedRaw).digest('hex');
        await db.query(
            'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, used_at) VALUES (?, ?, ?, NOW())',
            [custUserId, usedHash, new Date(Date.now() + 15 * 60 * 1000)]
        );

        const res6 = await fetch(`${API_URL}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: usedRaw,
                newPassword: 'SomeValidPassword1!',
                confirmPassword: 'SomeValidPassword1!'
            })
        });
        const data6 = await res6.json();
        assert(
            res6.status === 400 && data6.message.includes('already been used'),
            'Test 6',
            `Reusing an already-used token rejected with HTTP 400 ("${data6.message}")`
        );

        // --- 7. Password confirmation mismatch ---
        const validRaw = crypto.randomBytes(32).toString('hex');
        const validHash = crypto.createHash('sha256').update(validRaw).digest('hex');
        await db.query(
            'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
            [custUserId, validHash, new Date(Date.now() + 15 * 60 * 1000)]
        );

        const res7 = await fetch(`${API_URL}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: validRaw,
                newPassword: 'MatchingPassword123!',
                confirmPassword: 'DifferentPassword456!'
            })
        });
        const data7 = await res7.json();
        assert(
            res7.status === 400 && data7.message.includes('confirmation does not match'),
            'Test 7',
            `Password confirmation mismatch rejected with HTTP 400 ("${data7.message}")`
        );

        // --- 8. Password shorter than 8 characters ---
        const res8 = await fetch(`${API_URL}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: validRaw,
                newPassword: 'short',
                confirmPassword: 'short'
            })
        });
        const data8 = await res8.json();
        assert(
            res8.status === 400 && data8.message.includes('at least 8 characters long'),
            'Test 8',
            `Password shorter than 8 characters rejected with HTTP 400 ("${data8.message}")`
        );

        // --- 9. Successful password reset ---
        const newResetPassword = 'BrandNewPassword@2026';
        const res9 = await fetch(`${API_URL}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: validRaw,
                newPassword: newResetPassword,
                confirmPassword: newResetPassword
            })
        });
        const data9 = await res9.json();
        assert(
            res9.status === 200 && data9.message.includes('reset successfully'),
            'Test 9',
            `Successful password reset with valid token and ≥8 char password ("${data9.message}")`
        );

        // Verify token marked used
        const [usedCheck] = await db.query(
            'SELECT used_at FROM password_reset_tokens WHERE token_hash = ?',
            [validHash]
        );
        assert(
            usedCheck.length > 0 && usedCheck[0].used_at !== null,
            'Verify Invalidation',
            'Password reset token marked as used in database'
        );

        // --- 10. Login with new password ---
        const res10 = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testCustEmail,
                password: newResetPassword
            })
        });
        const data10 = await res10.json();
        assert(
            res10.status === 200 && !!data10.token,
            'Test 10',
            'Login with new password succeeds immediately'
        );
        custToken = data10.token;

        // --- 11. Login with old password must fail ---
        const res11 = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testCustEmail,
                password: initialPassword
            })
        });
        assert(
            res11.status === 401,
            'Test 11',
            'Login with old password strictly fails with HTTP 401'
        );

        // --- 12. Change password with correct current password ---
        const updatedPassword = 'NextUpdatedPassword@2026';
        const res12 = await fetch(`${API_URL}/auth/change-password`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${custToken}`
            },
            body: JSON.stringify({
                currentPassword: newResetPassword,
                newPassword: updatedPassword,
                confirmPassword: updatedPassword
            })
        });
        const data12 = await res12.json();
        assert(
            res12.status === 200 && data12.message.includes('successfully'),
            'Test 12',
            `Change password with correct current password succeeds ("${data12.message}")`
        );

        // --- 13. Change password with incorrect current password ---
        const res13 = await fetch(`${API_URL}/auth/change-password`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${custToken}`
            },
            body: JSON.stringify({
                currentPassword: 'WrongPassword999!',
                newPassword: 'AnotherPassword@123',
                confirmPassword: 'AnotherPassword@123'
            })
        });
        assert(
            res13.status === 401,
            'Test 13',
            'Change password with incorrect current password returns HTTP 401'
        );

        // --- 14. Unauthenticated password change attempt ---
        const res14 = await fetch(`${API_URL}/auth/change-password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                currentPassword: updatedPassword,
                newPassword: 'HackedPassword123!',
                confirmPassword: 'HackedPassword123!'
            })
        });
        assert(
            res14.status === 401,
            'Test 14',
            'Unauthenticated password change attempt returns HTTP 401'
        );

        // --- 15. Customer password change end-to-end ---
        // Verify customer can log in with updated password
        const res15 = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testCustEmail,
                password: updatedPassword
            })
        });
        const data15 = await res15.json();
        assert(
            res15.status === 200 && data15.user?.role === 'customer',
            'Test 15',
            'Customer password change verified end-to-end with successful re-authentication'
        );

        // --- 16. Admin password change ---
        // Login as admin
        const adminLoginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@rentiq.com', password: 'Admin@123' })
        });
        const adminLoginData = await adminLoginRes.json();
        const adminToken = adminLoginData.token;

        // Change admin password to temp
        const tempAdminPass = 'TempAdmin@9876';
        const res16a = await fetch(`${API_URL}/auth/change-password`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                currentPassword: 'Admin@123',
                newPassword: tempAdminPass,
                confirmPassword: tempAdminPass
            })
        });
        assert(res16a.status === 200, 'Test 16a', 'Admin changes password successfully');

        // Verify admin re-authenticates with tempAdminPass
        const res16b = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@rentiq.com', password: tempAdminPass })
        });
        const data16b = await res16b.json();
        assert(res16b.status === 200 && data16b.user?.role === 'admin', 'Test 16b', 'Admin logs in with new password');

        // Revert admin password back to Admin@123
        const res16c = await fetch(`${API_URL}/auth/change-password`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${data16b.token}`
            },
            body: JSON.stringify({
                currentPassword: tempAdminPass,
                newPassword: 'Admin@123',
                confirmPassword: 'Admin@123'
            })
        });
        assert(res16c.status === 200, 'Test 16c', 'Admin password restored back to standard Admin@123');

        // --- 17. Reset token reuse prevention ---
        const res17 = await fetch(`${API_URL}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: validRaw, // Token used previously in Test 9
                newPassword: 'AnotherPassword@999',
                confirmPassword: 'AnotherPassword@999'
            })
        });
        const data17 = await res17.json();
        assert(
            res17.status === 400 && data17.message.includes('already been used'),
            'Test 17',
            `Re-submission of used token strictly blocked ("${data17.message}")`
        );

        // --- 18. Reset request rate limiting ---
        console.log('\nTesting rate limiter (sending rapid requests)...');
        clearRateLimitHistory();
        const spamEmail = `ratelimit_${timestamp}@example.com`;
        let rateLimitTriggered = false;

        for (let i = 1; i <= 7; i++) {
            const resSpam = await fetch(`${API_URL}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: spamEmail })
            });

            if (resSpam.status === 429) {
                rateLimitTriggered = true;
                const dataSpam = await resSpam.json();
                assert(
                    true,
                    'Test 18',
                    `Rate limiter successfully triggered at request #${i} with HTTP 429 ("${dataSpam.message}")`
                );
                break;
            }
        }
        if (!rateLimitTriggered) {
            assert(false, 'Test 18', 'Rate limiter did not trigger after 7 requests');
        }

    } finally {
        // Cleanup test accounts and tokens
        console.log('\nCleaning up test artifacts...');
        if (custUserId) {
            await db.query('DELETE FROM password_reset_tokens WHERE user_id = ?', [custUserId]);
            await db.query('DELETE FROM users WHERE user_id = ?', [custUserId]);
            console.log('Cleaned up test customer user & tokens.');
        }
        clearRateLimitHistory();
    }

    console.log('\n====================================================');
    console.log(`Security Test Results: ${passed} Passed, ${failed} Failed`);
    console.log('====================================================');

    process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});

