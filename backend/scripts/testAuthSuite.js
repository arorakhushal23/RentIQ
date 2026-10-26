/**
 * RentIQ Authentication & Admin Role Security Test Suite
 *
 * Verifies:
 * 1. Missing account rejection with meaningful message ("No account found with this email address")
 * 2. Incorrect password rejection with meaningful message ("Invalid email or password")
 * 3. Invalid email format rejection (HTTP 400)
 * 4. Missing credentials validation (HTTP 400)
 * 5. Customer registration (strictly customer role, password hashed, token returned)
 * 6. Regular customer login and token generation
 * 7. Customer access to admin routes blocked with HTTP 403 ("Access denied: Administrator privileges required")
 * 8. Unauthenticated access to admin routes blocked with HTTP 401 ("Authentication required")
 * 9. Safe admin creation via createAdmin.js CLI
 * 10. Valid admin login and token verification (role === 'admin')
 * 11. Valid admin access to protected admin dashboard (HTTP 200)
 * 12. Admin password reset via resetAdminPassword.js CLI (old password fails, new succeeds)
 * 13. Customer promotion to admin via promoteAdmin.js CLI (promoted user gets admin access)
 * 14. Full cleanup of all temporary test artifacts from database
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const db = require('../config/db');

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:5000/api';

const createdUserEmails = [];

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`✓ PASS: ${message}`);
        passed++;
    } else {
        console.error(`✗ FAIL: ${message}`);
        failed++;
    }
}

async function run() {
    console.log('====================================================');
    console.log('RentIQ Comprehensive Auth & Admin Security Test Suite');
    console.log('====================================================\n');

    const testTimestamp = Date.now();
    const testCustomerEmail = `test_customer_${testTimestamp}@example.com`;
    const testAdminEmail = `test_admin_${testTimestamp}@example.com`;
    const testPromoteEmail = `test_promote_${testTimestamp}@example.com`;
    const testPassword = 'Password123!';
    const testNewPassword = 'NewPassword456!';

    createdUserEmails.push(testCustomerEmail, testAdminEmail, testPromoteEmail);

    try {
        // --- 1. Missing Account Validation ---
        const resMissing = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'nonexistent_user_99999@example.com',
                password: 'anyPassword123!'
            })
        });
        const dataMissing = await resMissing.json();
        assert(resMissing.status === 401, 'Test 1.1: Missing account login returns HTTP 401');
        assert(dataMissing.message === 'No account found with this email address',
            `Test 1.2: Meaningful message for missing account (got: "${dataMissing.message}")`);

        // --- 2. Invalid Email Format ---
        const resInvalidEmail = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'not-an-email',
                password: 'anyPassword123!'
            })
        });
        const dataInvalidEmail = await resInvalidEmail.json();
        assert(resInvalidEmail.status === 400 && dataInvalidEmail.message === 'Invalid email format',
            'Test 2: Malformed email returns HTTP 400 "Invalid email format"');

        // --- 3. Missing Credentials ---
        const resNoPass = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'user@example.com', password: '' })
        });
        assert(resNoPass.status === 400, 'Test 3: Missing password returns HTTP 400');

        // --- 4. Customer Registration ---
        const resReg = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Test Customer',
                email: testCustomerEmail,
                password: testPassword
            })
        });
        const dataReg = await resReg.json();
        assert(resReg.status === 201 && dataReg.token && dataReg.user.role === 'customer',
            'Test 4: Customer registration succeeds with role "customer" and valid JWT');

        // Verify database stores bcrypt hash, not plaintext
        const [customerDb] = await db.query('SELECT password_hash, role FROM users WHERE email = ?', [testCustomerEmail]);
        assert(customerDb.length === 1 && customerDb[0].password_hash.startsWith('$2'),
            'Test 5: Password is saved as secure bcrypt hash in database');

        // --- 5. Customer Login with Incorrect Password ---
        const resWrongPass = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testCustomerEmail,
                password: 'WrongPassword123!'
            })
        });
        const dataWrongPass = await resWrongPass.json();
        assert(resWrongPass.status === 401 && dataWrongPass.message === 'Invalid email or password',
            'Test 6: Incorrect password returns HTTP 401 "Invalid email or password"');

        // --- 6. Successful Customer Login ---
        const resCustLogin = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testCustomerEmail,
                password: testPassword
            })
        });
        const dataCustLogin = await resCustLogin.json();
        assert(resCustLogin.status === 200 && dataCustLogin.token && dataCustLogin.user.role === 'customer',
            'Test 7: Valid customer credentials authenticate successfully');
        const customerToken = dataCustLogin.token;

        // --- 7. Customer Forbidden from Admin Routes ---
        const resCustAdminAccess = await fetch(`${BASE_URL}/admin/dashboard`, {
            headers: { Authorization: `Bearer ${customerToken}` }
        });
        const dataCustAdminAccess = await resCustAdminAccess.json();
        assert(resCustAdminAccess.status === 403, 'Test 8.1: Customer accessing admin endpoint receives HTTP 403 Forbidden');
        assert(dataCustAdminAccess.message === 'Access denied: Administrator privileges required',
            `Test 8.2: Customer receives explicit privilege requirement message (got: "${dataCustAdminAccess.message}")`);

        // --- 8. Unauthenticated Access Blocked ---
        const resUnauth = await fetch(`${BASE_URL}/admin/dashboard`);
        assert(resUnauth.status === 401, 'Test 9: Unauthenticated request to admin endpoint receives HTTP 401');

        // --- 9. Safe Admin Creation via createAdmin CLI ---
        const { execSync } = require('child_process');
        const createAdminOut = execSync(
            `node scripts/createAdmin.js --name "Test Admin" --email "${testAdminEmail}" --password "${testPassword}"`,
            { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' }
        );
        assert(createAdminOut.includes('Administrator Created Successfully'),
            'Test 10: createAdmin.js successfully creates admin account');

        // Verify admin in database
        const [adminDb] = await db.query('SELECT user_id, role, password_hash FROM users WHERE email = ?', [testAdminEmail]);
        assert(adminDb.length === 1 && adminDb[0].role === 'admin',
            'Test 11: Admin record verified in MySQL with role strictly "admin"');

        // --- 10. Valid Admin Login ---
        const resAdminLogin = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testAdminEmail,
                password: testPassword
            })
        });
        const dataAdminLogin = await resAdminLogin.json();
        assert(resAdminLogin.status === 200 && dataAdminLogin.user.role === 'admin' && dataAdminLogin.token,
            'Test 12: Admin authenticates successfully and receives admin-scoped JWT');
        const adminToken = dataAdminLogin.token;

        // --- 11. Admin Authorized Access to Admin Dashboard ---
        const resAdminDashboard = await fetch(`${BASE_URL}/admin/dashboard`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        const dataAdminDashboard = await resAdminDashboard.json();
        assert(resAdminDashboard.status === 200 && dataAdminDashboard.stats !== undefined,
            'Test 13: Admin token authorized to retrieve dashboard statistics');

        // --- 12. Admin Password Reset via resetAdminPassword CLI ---
        const resetAdminOut = execSync(
            `node scripts/resetAdminPassword.js --email "${testAdminEmail}" --password "${testNewPassword}"`,
            { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' }
        );
        assert(resetAdminOut.includes('Administrator Password Updated Successfully'),
            'Test 14: resetAdminPassword.js updates admin password hash');

        // Old password fails
        const resOldPass = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testAdminEmail, password: testPassword })
        });
        assert(resOldPass.status === 401, 'Test 15: Old admin password rejected after reset');

        // New password succeeds
        const resNewPass = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testAdminEmail, password: testNewPassword })
        });
        assert(resNewPass.status === 200, 'Test 16: New admin password authenticates successfully');

        // --- 13. Customer Account Promotion via promoteAdmin CLI ---
        // Register customer to promote
        await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Promote Target',
                email: testPromoteEmail,
                password: testPassword
            })
        });

        const promoteOut = execSync(
            `node scripts/promoteAdmin.js --email "${testPromoteEmail}"`,
            { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' }
        );
        assert(promoteOut.includes('User Successfully Promoted to Admin'),
            'Test 17: promoteAdmin.js promotes existing customer to admin role');

        // Promoted user logs in and accesses admin route
        const resPromotedLogin = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testPromoteEmail, password: testPassword })
        });
        const dataPromotedLogin = await resPromotedLogin.json();
        assert(dataPromotedLogin.user.role === 'admin',
            'Test 18: Promoted user now possesses role "admin" on login');

        const resPromotedAccess = await fetch(`${BASE_URL}/admin/dashboard`, {
            headers: { Authorization: `Bearer ${dataPromotedLogin.token}` }
        });
        assert(resPromotedAccess.status === 200,
            'Test 19: Promoted user is successfully authorized for admin routes');

    } finally {
        // --- 14. Full Database Cleanup ---
        console.log('\nCleaning up test accounts...');
        if (createdUserEmails.length > 0) {
            await db.query('DELETE FROM users WHERE email IN (?)', [createdUserEmails]);
            console.log('Cleanup complete. Isolated test accounts removed.');
        }
        await db.end();
    }

    console.log('\n====================================================');
    console.log(`Test Suite Finished: ${passed} Passed, ${failed} Failed`);
    console.log('====================================================');

    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

run().catch((err) => {
    console.error('Test suite runner crashed:', err);
    process.exit(1);
});
