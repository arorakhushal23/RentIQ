/**
 * Comprehensive Vehicle Availability Validation Test Suite
 * Tests all 8 scenarios required:
 * 1. Vehicle available: availability check returns true
 * 2. Vehicle under active maintenance: availability check returns false (VEHICLE_UNDER_MAINTENANCE)
 * 3. Vehicle maintenance scheduled after rental completion: booking remains possible (available: true)
 * 4. Vehicle insurance expired: booking rejected (VEHICLE_COMPLIANCE_HOLD)
 * 5. Vehicle PUC expired during rental window: booking rejected (VEHICLE_COMPLIANCE_HOLD)
 * 6. Overlapping confirmed booking: booking rejected (HTTP 409 BOOKING_CONFLICT)
 * 7. Customer bypasses frontend and calls booking API directly: backend rejects with 400/409
 * 8. Two customers attempt concurrent overlapping bookings: row lock serializes, exactly 1 succeeds
 */

const http = require('http');
const path = require('path');
const jwt = require(path.resolve('backend/node_modules/jsonwebtoken'));
require(path.resolve('backend/node_modules/dotenv')).config({ path: path.resolve('backend/.env') });
const db = require('../backend/config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_here';
const BASE_URL = 'http://localhost:5000/api';

function makeRequest(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(BASE_URL + path);
        const data = body ? JSON.stringify(body) : null;

        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        };

        const req = http.request(options, (res) => {
            let resBody = '';
            res.on('data', chunk => { resBody += chunk; });
            res.on('end', () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(resBody);
                } catch {
                    parsed = resBody;
                }
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    data: parsed
                });
            });
        });

        req.on('error', err => reject(err));
        if (data) req.write(data);
        req.end();
    });
}

async function runTests() {
    console.log('==============================================================');
    console.log('RENTIQ VEHICLE AVAILABILITY & BOOKING VALIDATION TEST SUITE');
    console.log('==============================================================\n');

    let passedCount = 0;
    let failedCount = 0;

    // Create test customer token for user 2 (fulluser@rentiq.com) and user 1
    const tokenCust1 = jwt.sign({ user_id: 2, email: 'fulluser@rentiq.com', role: 'customer' }, JWT_SECRET, { expiresIn: '1h' });
    const tokenCust2 = jwt.sign({ user_id: 1, email: 'testuser@rentiq.com', role: 'customer' }, JWT_SECRET, { expiresIn: '1h' });

    // Clean up any existing test bookings or test maintenance for clean environment
    await db.query("DELETE FROM bookings WHERE pickup_datetime >= '2027-01-01'");
    await db.query("DELETE FROM vehicle_maintenance WHERE description LIKE '%AVAILABILITY_TEST%'");

    try {
        // -------------------------------------------------------------
        // SCENARIO 1: Vehicle available -> booking check returns available: true
        // -------------------------------------------------------------
        console.log('--- SCENARIO 1: Fully Compliant Vehicle Availability ---');
        // Vehicle 1 (Swift) has valid RC (2038), Insurance (2027), PUC (2027)
        const res1 = await makeRequest('POST', '/bookings/check-availability', {
            vehicleId: 1,
            pickupDatetime: '2027-01-10T10:00:00',
            returnDatetime: '2027-01-12T10:00:00'
        });

        if (res1.status === 200 && res1.data.available === true) {
            console.log('✅ SCENARIO 1 PASSED: Vehicle 1 is reported available for valid future window.');
            passedCount++;
        } else {
            console.error('❌ SCENARIO 1 FAILED:', res1.status, res1.data);
            failedCount++;
        }

        // -------------------------------------------------------------
        // SCENARIO 2: Vehicle under active maintenance -> availability check returns false
        // -------------------------------------------------------------
        console.log('\n--- SCENARIO 2: Vehicle Under Active Maintenance ---');
        // Insert active in_progress maintenance record on vehicle 3 (City)
        const [maintRes] = await db.query(
            `INSERT INTO vehicle_maintenance (vehicle_id, maintenance_category, service_date, start_date, end_date, odometer_reading, service_center, status, description, cost)
             VALUES (3, 'brake_servicing', CURDATE(), CURDATE(), NULL, 15000, 'RentIQ Central Workshop', 'in_progress', 'AVAILABILITY_TEST_ACTIVE', 2500)`
        );
        const testMaintId = maintRes.insertId;

        const res2 = await makeRequest('POST', '/bookings/check-availability', {
            vehicleId: 3,
            pickupDatetime: '2027-01-10T10:00:00',
            returnDatetime: '2027-01-12T10:00:00'
        });

        if (res2.status === 200 && res2.data.available === false && res2.data.code === 'VEHICLE_UNDER_MAINTENANCE') {
            console.log('✅ SCENARIO 2 PASSED: Active maintenance properly blocked availability:', res2.data.message);
            passedCount++;
        } else {
            console.error('❌ SCENARIO 2 FAILED:', res2.status, res2.data);
            failedCount++;
        }

        // Clean up active maintenance
        await db.query("DELETE FROM vehicle_maintenance WHERE id = ?", [testMaintId]);

        // -------------------------------------------------------------
        // SCENARIO 3: Maintenance scheduled AFTER rental completion -> booking remains possible
        // -------------------------------------------------------------
        console.log('\n--- SCENARIO 3: Maintenance Scheduled After Rental Window ---');
        // Insert scheduled maintenance on vehicle 1 starting 2027-01-20
        const [schedMaintRes] = await db.query(
            `INSERT INTO vehicle_maintenance (vehicle_id, maintenance_category, service_date, start_date, end_date, odometer_reading, service_center, status, description, cost)
             VALUES (1, 'brake_servicing', '2027-01-20', '2027-01-20', '2027-01-25', 15000, 'RentIQ Central Workshop', 'scheduled', 'AVAILABILITY_TEST_SCHED', 2500)`
        );
        const schedMaintId = schedMaintRes.insertId;

        // Rental window is 2027-01-01 to 2027-01-04 (completes BEFORE 2027-01-20)
        const res3 = await makeRequest('POST', '/bookings/check-availability', {
            vehicleId: 1,
            pickupDatetime: '2027-01-01T10:00:00',
            returnDatetime: '2027-01-04T10:00:00'
        });

        // Also test overlapping dates with the scheduled maintenance window (2027-01-21 to 2027-01-23)
        const res3Overlap = await makeRequest('POST', '/bookings/check-availability', {
            vehicleId: 1,
            pickupDatetime: '2027-01-21T10:00:00',
            returnDatetime: '2027-01-23T10:00:00'
        });

        if (res3.status === 200 && res3.data.available === true && res3Overlap.status === 200 && res3Overlap.data.available === false && res3Overlap.data.code === 'VEHICLE_UNDER_MAINTENANCE') {
            console.log('✅ SCENARIO 3 PASSED: Booking before scheduled maintenance is permitted (available: true), and overlapping dates are blocked (available: false, VEHICLE_UNDER_MAINTENANCE).');
            passedCount++;
        } else {
            console.error('❌ SCENARIO 3 FAILED: before=', res3.status, res3.data, 'during=', res3Overlap.status, res3Overlap.data);
            failedCount++;
        }

        // Clean up scheduled test maintenance
        await db.query("DELETE FROM vehicle_maintenance WHERE id = ?", [schedMaintId]);

        // -------------------------------------------------------------
        // SCENARIO 4: Vehicle insurance expired -> booking rejected
        // -------------------------------------------------------------
        console.log('\n--- SCENARIO 4: Expired Vehicle Insurance (Vehicle 4 Verna) ---');
        // Vehicle 4 (Verna) has insurance expired on 2026-10-23
        const res4Check = await makeRequest('POST', '/bookings/check-availability', {
            vehicleId: 4,
            pickupDatetime: '2027-01-10T10:00:00',
            returnDatetime: '2027-01-12T10:00:00'
        });

        const res4Book = await makeRequest('POST', '/bookings', {
            vehicleId: 4,
            pickupDatetime: '2027-01-10 10:00:00',
            returnDatetime: '2027-01-12 10:00:00',
            pickupAddress: 'RentIQ Central Hub, Chandigarh',
            dropAddress: 'RentIQ Central Hub, Chandigarh',
            selectedAddons: []
        }, tokenCust1);

        if (
            res4Check.status === 200 && res4Check.data.available === false && res4Check.data.code === 'VEHICLE_COMPLIANCE_HOLD' &&
            res4Book.status === 400 && res4Book.data.code === 'VEHICLE_COMPLIANCE_HOLD'
        ) {
            console.log('✅ SCENARIO 4 PASSED: Expired insurance rejected in check-availability AND backend booking API (HTTP 400):', res4Book.data.message);
            passedCount++;
        } else {
            console.error('❌ SCENARIO 4 FAILED: check=', res4Check.data, 'book=', res4Book.status, res4Book.data);
            failedCount++;
        }

        // -------------------------------------------------------------
        // SCENARIO 5: Vehicle PUC expired during rental window -> booking rejected
        // -------------------------------------------------------------
        console.log('\n--- SCENARIO 5: Vehicle PUC Expiring Before/During Rental Window ---');
        // Vehicle 2 (i20) has PUC expiring on 2026-11-27
        // A rental from 2026-11-26 to 2026-11-30 extends beyond PUC validity
        const res5Check = await makeRequest('POST', '/bookings/check-availability', {
            vehicleId: 2,
            pickupDatetime: '2026-11-26T10:00:00',
            returnDatetime: '2026-11-30T10:00:00'
        });

        const res5Book = await makeRequest('POST', '/bookings', {
            vehicleId: 2,
            pickupDatetime: '2026-11-26 10:00:00',
            returnDatetime: '2026-11-30 10:00:00',
            pickupAddress: 'RentIQ Central Hub, Chandigarh',
            dropAddress: 'RentIQ Central Hub, Chandigarh',
            selectedAddons: []
        }, tokenCust1);

        if (
            res5Check.status === 200 && res5Check.data.available === false && res5Check.data.code === 'VEHICLE_COMPLIANCE_HOLD' &&
            res5Book.status === 400 && res5Book.data.code === 'VEHICLE_COMPLIANCE_HOLD'
        ) {
            console.log('✅ SCENARIO 5 PASSED: PUC expiring during rental window rejected in both check & create API:', res5Book.data.message);
            passedCount++;
        } else {
            console.error('❌ SCENARIO 5 FAILED: check=', res5Check.data, 'book=', res5Book.status, res5Book.data);
            failedCount++;
        }

        // -------------------------------------------------------------
        // SCENARIO 6: Vehicle has overlapping confirmed booking -> booking rejected
        // -------------------------------------------------------------
        console.log('\n--- SCENARIO 6: Overlapping Confirmed Booking ---');
        // First, create an active booking on Vehicle 1 for 2027-01-15 10:00 to 2027-01-18 10:00 (before PUC expiry of 2027-02-01)
        const firstBookingRes = await makeRequest('POST', '/bookings', {
            vehicleId: 1,
            pickupDatetime: '2027-01-15 10:00:00',
            returnDatetime: '2027-01-18 10:00:00',
            pickupAddress: 'RentIQ Central Hub, Chandigarh',
            dropAddress: 'RentIQ Central Hub, Chandigarh',
            selectedAddons: []
        }, tokenCust1);

        if (firstBookingRes.status !== 201 && firstBookingRes.status !== 200) {
            throw new Error(`Failed to create baseline booking: ${JSON.stringify(firstBookingRes.data)}`);
        }
        const createdBookingId = firstBookingRes.data.booking.booking_id;

        // Now attempt an overlapping booking on Vehicle 1 for 2027-01-16 10:00 to 2027-01-19 10:00
        const res6Check = await makeRequest('POST', '/bookings/check-availability', {
            vehicleId: 1,
            pickupDatetime: '2027-01-16T10:00:00',
            returnDatetime: '2027-01-19T10:00:00'
        });

        const res6Book = await makeRequest('POST', '/bookings', {
            vehicleId: 1,
            pickupDatetime: '2027-01-16 10:00:00',
            returnDatetime: '2027-01-19 10:00:00',
            pickupAddress: 'RentIQ Central Hub, Chandigarh',
            dropAddress: 'RentIQ Central Hub, Chandigarh',
            selectedAddons: []
        }, tokenCust2);

        if (
            res6Check.status === 200 && res6Check.data.available === false && res6Check.data.code === 'BOOKING_CONFLICT' &&
            res6Book.status === 409 && res6Book.data.code === 'BOOKING_CONFLICT'
        ) {
            console.log('✅ SCENARIO 6 PASSED: Overlapping booking correctly rejected with HTTP 409 BOOKING_CONFLICT:', res6Book.data.message);
            passedCount++;
        } else {
            console.error('❌ SCENARIO 6 FAILED: check=', res6Check.data, 'book=', res6Book.status, res6Book.data);
            failedCount++;
        }

        // Clean up created booking
        await db.query("DELETE FROM bookings WHERE booking_id = ?", [createdBookingId]);

        // -------------------------------------------------------------
        // SCENARIO 7: Customer bypasses frontend and calls booking API directly
        // -------------------------------------------------------------
        console.log('\n--- SCENARIO 7: Direct API Bypass Attempt on Unavailable Vehicle ---');
        // Customer attempts direct POST to /api/bookings for Vehicle 4 (Verna - expired insurance)
        const res7 = await makeRequest('POST', '/bookings', {
            vehicleId: 4,
            pickupDatetime: '2027-01-10 10:00:00',
            returnDatetime: '2027-01-12 10:00:00',
            pickupAddress: 'RentIQ Central Hub, Chandigarh',
            dropAddress: 'RentIQ Central Hub, Chandigarh',
            selectedAddons: []
        }, tokenCust1);

        if (res7.status === 400 && res7.data.code === 'VEHICLE_COMPLIANCE_HOLD') {
            console.log('✅ SCENARIO 7 PASSED: Direct API call rejected by backend validation without frontend check:', res7.data.message);
            passedCount++;
        } else {
            console.error('❌ SCENARIO 7 FAILED:', res7.status, res7.data);
            failedCount++;
        }

        // -------------------------------------------------------------
        // SCENARIO 8: Two customers attempt concurrent overlapping bookings (Race condition test)
        // -------------------------------------------------------------
        console.log('\n--- SCENARIO 8: Concurrent Booking Race Condition Serialization ---');
        const rentalWindow = {
            pickupDatetime: '2027-01-22 10:00:00',
            returnDatetime: '2027-01-25 10:00:00',
            pickupAddress: 'RentIQ Central Hub, Chandigarh',
            dropAddress: 'RentIQ Central Hub, Chandigarh',
            selectedAddons: []
        };

        const [attempt1, attempt2] = await Promise.all([
            makeRequest('POST', '/bookings', { vehicleId: 1, ...rentalWindow }, tokenCust1),
            makeRequest('POST', '/bookings', { vehicleId: 1, ...rentalWindow }, tokenCust2)
        ]);

        const statuses = [attempt1.status, attempt2.status].sort();
        console.log(`Concurrent responses: Cust1 HTTP ${attempt1.status}, Cust2 HTTP ${attempt2.status}`);

        if (statuses[0] === 201 && statuses[1] === 409) {
            console.log('✅ SCENARIO 8 PASSED: Database row lock serialized concurrent attempts. Exactly 1 succeeded (201) and 1 failed with conflict (409).');
            passedCount++;
        } else {
            console.error('❌ SCENARIO 8 FAILED: Statuses:', statuses, attempt1.data, attempt2.data);
            failedCount++;
        }

        // Clean up test bookings
        await db.query("DELETE FROM bookings WHERE pickup_datetime >= '2027-01-22'");

    } catch (err) {
        console.error('Unexpected error during test execution:', err);
        failedCount++;
    } finally {
        console.log('\n==============================================================');
        console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED (TOTAL 8 SCENARIOS)`);
        console.log('==============================================================');
        process.exit(failedCount === 0 ? 0 : 1);
    }
}

runTests();
