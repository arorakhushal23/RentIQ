const jwt = require('jsonwebtoken');
const db = require('../config/db');
require('dotenv').config();

async function run() {
    console.log('====================================================');
    console.log('Testing RentIQ Wishlist API & Security Suite');
    console.log('====================================================\n');

    const tokenUserA = jwt.sign(
        { user_id: 11, email: 'khushal23@gmail.com', role: 'customer' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
    );

    const tokenUserB = jwt.sign(
        { user_id: 2, email: 'fulluser@rentiq.com', role: 'customer' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
    );

    // Clean test users wishlist first
    await db.query('DELETE FROM wishlist WHERE user_id IN (11, 2)');

    let passed = 0;
    let failed = 0;

    function assert(cond, msg) {
        if (cond) {
            console.log(`✓ PASS: ${msg}`);
            passed++;
        } else {
            console.error(`✗ FAIL: ${msg}`);
            failed++;
        }
    }

    try {
        // 1. Unauthorized request
        const resUnauth = await fetch('http://localhost:5000/api/wishlist');
        assert(resUnauth.status === 401, 'Test 1: Unauthorized request without token returns 401');

        // 2. Invalid vehicle ID
        const resInvalidId = await fetch('http://localhost:5000/api/wishlist/abc', {
            method: 'POST',
            headers: { Authorization: `Bearer ${tokenUserA}` }
        });
        assert(resInvalidId.status === 400, 'Test 2: Invalid vehicle ID (non-numeric) returns 400');

        // 3. Nonexistent vehicle ID
        const resNotFound = await fetch('http://localhost:5000/api/wishlist/999999', {
            method: 'POST',
            headers: { Authorization: `Bearer ${tokenUserA}` }
        });
        assert(resNotFound.status === 404, 'Test 3: Nonexistent vehicle ID returns 404');

        // 4. Add vehicle 1 for User A
        const resAdd1 = await fetch('http://localhost:5000/api/wishlist/1', {
            method: 'POST',
            headers: { Authorization: `Bearer ${tokenUserA}` }
        });
        const dataAdd1 = await resAdd1.json();
        assert(resAdd1.status === 201 && dataAdd1.success, 'Test 4: User A adds vehicle 1 (Swift) returns 201');

        // 5. Duplicate addition
        const resAddDup = await fetch('http://localhost:5000/api/wishlist/1', {
            method: 'POST',
            headers: { Authorization: `Bearer ${tokenUserA}` }
        });
        assert(resAddDup.status === 200 || resAddDup.status === 201, 'Test 5: Duplicate vehicle addition handled safely');

        const [dbRowsA] = await db.query('SELECT * FROM wishlist WHERE user_id = 11 AND vehicle_id = 1');
        assert(dbRowsA.length === 1, 'Test 6: Database contains exactly 1 entry for User A and Vehicle 1 (no duplicates)');

        // 6. User B cannot see User A's wishlist
        const resGetB = await fetch('http://localhost:5000/api/wishlist', {
            headers: { Authorization: `Bearer ${tokenUserB}` }
        });
        const dataGetB = await resGetB.json();
        assert(dataGetB.count === 0 && dataGetB.data.length === 0, 'Test 7: User B cannot access User A wishlist (count is 0)');

        // 7. User B adds vehicle 3 (City)
        const resAddB = await fetch('http://localhost:5000/api/wishlist/3', {
            method: 'POST',
            headers: { Authorization: `Bearer ${tokenUserB}` }
        });
        assert(resAddB.status === 201, 'Test 8: User B adds vehicle 3 (City) successfully');

        // 8. User A adds vehicle 5 (Creta)
        await fetch('http://localhost:5000/api/wishlist/5', {
            method: 'POST',
            headers: { Authorization: `Bearer ${tokenUserA}` }
        });

        const resGetA = await fetch('http://localhost:5000/api/wishlist', {
            headers: { Authorization: `Bearer ${tokenUserA}` }
        });
        const dataGetA = await resGetA.json();
        assert(dataGetA.count === 2, 'Test 9: User A has exactly 2 wishlist items (vehicles 1 and 5)');
        assert(dataGetA.data.some(v => v.name === 'Swift') && dataGetA.data.some(v => v.name === 'Creta'), 'Test 10: Wishlist payload includes joined vehicle names and categories');

        // 9. User A removes vehicle 1
        const resDelA = await fetch('http://localhost:5000/api/wishlist/1', {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${tokenUserA}` }
        });
        assert(resDelA.status === 200, 'Test 11: User A removes vehicle 1 successfully');

        const resGetAAfterDel = await fetch('http://localhost:5000/api/wishlist', {
            headers: { Authorization: `Bearer ${tokenUserA}` }
        });
        const dataGetAAfterDel = await resGetAAfterDel.json();
        assert(dataGetAAfterDel.count === 1 && dataGetAAfterDel.data[0].vehicle_id === 5, 'Test 12: User A wishlist only contains vehicle 5 after deletion');

        // 10. Clean up
        await db.query('DELETE FROM wishlist WHERE user_id IN (11, 2)');
        console.log('\nCleaned up test wishlist data.');

    } finally {
        await db.end();
    }

    console.log('\n====================================================');
    console.log(`Results: ${passed} Passed, ${failed} Failed`);
    console.log('====================================================');

    if (failed > 0) process.exit(1);
}

run().catch(err => {
    console.error('Test execution error:', err);
    process.exit(1);
});
