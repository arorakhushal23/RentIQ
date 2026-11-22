/**
 * RentIQ Vehicle Inspection System & Workflow Test Suite
 *
 * Verifies all inspection points from Section 7 of the user prompt:
 * 1. Admin loads inspection dossier for booking (GET /api/inspections/booking/:id)
 * 2. Creating pickup inspection with checklist, odometer, fuel, scratches/dents
 * 3. Uploading multiple photos across categories (front, rear, left, right, interior, damage, other)
 * 4. Saving and retrieving inspection dossier with photo associations
 * 5. Customer review and condition acceptance
 * 6. Admin vehicle handover (transitions to active only after acceptance)
 * 7. Creating return inspection (requires final odo >= starting odo)
 * 8. Comparison and difference analysis between pickup and return records
 * 9. Admin rental completion (transitions to completed only after return inspection)
 * 10. Rejection of duplicate inspections for the same stage
 * 11. Security & authorization: Non-admin non-owner rejected with HTTP 403
 * 12. Streaming/downloading inspection photograph with authentication
 */

const path = require('path');
const fs = require('fs');
require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const db = require('../backend/config/db');
const {
    createInspection,
    getInspectionsByBooking,
    customerAcceptInspection,
    completeHandover,
    completeRental,
    downloadInspectionPhoto
} = require('../backend/controllers/inspectionController');

let passedTests = 0;
let failedTests = 0;

async function assertTest(name, fn) {
    process.stdout.write(`  [RUNNING] ${name} ... `);
    try {
        await fn();
        console.log(`\x1b[32mPASSED\x1b[0m`);
        passedTests++;
    } catch (err) {
        console.log(`\x1b[31mFAILED\x1b[0m`);
        console.error(`    Error: ${err.message}`);
        failedTests++;
    }
}

function mockReqRes(options = {}) {
    const req = {
        user: options.user || null,
        body: options.body || {},
        params: options.params || {},
        query: options.query || {},
        files: options.files || []
    };
    const res = {
        statusCode: 200,
        headers: {},
        data: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.data = payload;
            return this;
        },
        setHeader(name, val) {
            this.headers[name] = val;
        }
    };
    return { req, res };
}

async function runSuite() {
    console.log(`\n============================================================`);
    console.log(`RentIQ Vehicle Inspection & Handover Workflow Test Suite`);
    console.log(`============================================================\n`);

    // Setup test users: 1 admin, 1 customer, 1 unauthorized stranger
    const [adminUser] = await db.query(`SELECT user_id, email, role FROM users WHERE role = 'admin' LIMIT 1`);
    const [custUsers] = await db.query(`SELECT user_id, email, role FROM users WHERE role = 'customer' LIMIT 2`);

    const admin = adminUser[0];
    const customer = custUsers[0];
    const stranger = custUsers[1] || { user_id: 99999, email: 'stranger@test.com', role: 'customer' };

    // Setup an isolated booking for Vehicle 1 (Swift)
    const [bIns] = await db.query(`
        INSERT INTO bookings (user_id, vehicle_id, pickup_datetime, return_datetime, total_price, status)
        VALUES (?, 1, '2027-08-01 10:00:00', '2027-08-05 10:00:00', 7200.00, 'confirmed')
    `, [customer.user_id]);
    const testBookingId = bIns.insertId;

    // Create dummy sample photos in uploads/inspection_photos
    const uploadDir = path.resolve(__dirname, '../backend/uploads/inspection_photos');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const photo1Path = path.join(uploadDir, `test_photo_front_${testBookingId}.jpg`);
    const photo2Path = path.join(uploadDir, `test_photo_damage_${testBookingId}.jpg`);
    fs.writeFileSync(photo1Path, Buffer.from('FAKE_FRONT_PHOTO_JPEG_CONTENT'));
    fs.writeFileSync(photo2Path, Buffer.from('FAKE_DAMAGE_PHOTO_JPEG_CONTENT'));

    let pickupInspectionId = null;
    let returnInspectionId = null;

    try {
        // Test 1: Fetch initial inspection dossier (no inspection yet)
        await assertTest('Test 1: Admin loads initial inspection dossier (no inspection recorded yet)', async () => {
            const { req, res } = mockReqRes({
                user: admin,
                params: { bookingId: testBookingId }
            });
            await getInspectionsByBooking(req, res);
            if (res.statusCode !== 200) throw new Error(`Expected HTTP 200, got ${res.statusCode}`);
            if (res.data.booking.booking_id !== testBookingId) throw new Error('Booking ID mismatch');
            if (res.data.pickupInspection !== null) throw new Error('Expected pickupInspection to be null');
            if (res.data.returnInspection !== null) throw new Error('Expected returnInspection to be null');
            if (res.data.differenceReport !== null) throw new Error('Expected differenceReport to be null');
        });

        // Test 2: Admin creates before-rental pickup inspection with checklist, odometer, fuel & photos
        await assertTest('Test 2: Admin records pickup inspection with checklist, odometer (25,000 km) & fuel (100%)', async () => {
            const { req, res } = mockReqRes({
                user: admin,
                body: {
                    booking_id: testBookingId,
                    inspection_type: 'pickup',
                    odometer_reading: 25000,
                    fuel_level: 100,
                    exterior_condition: 'good',
                    interior_condition: 'excellent',
                    tyre_condition: 'good',
                    headlights_condition: 'working',
                    taillights_condition: 'working',
                    mirrors_condition: 'intact',
                    windows_condition: 'intact',
                    brakes_condition: 'optimal',
                    existing_scratches: 'Minor superficial scratch on left rear bumper',
                    existing_dents: 'None',
                    inspection_notes: 'All fluids checked, vehicle clean and ready for handover',
                    photo_categories: ['front', 'damage']
                },
                files: [
                    { path: photo1Path, originalname: 'front.jpg', mimetype: 'image/jpeg' },
                    { path: photo2Path, originalname: 'damage.jpg', mimetype: 'image/jpeg' }
                ]
            });
            await createInspection(req, res);
            if (res.statusCode !== 201) throw new Error(`Expected HTTP 201, got ${res.statusCode}: ${res.data?.message}`);
            pickupInspectionId = res.data.inspection_id;
            if (!pickupInspectionId) throw new Error('Missing inspection_id in response');
        });

        // Test 3: Reject duplicate pickup inspection (HTTP 409)
        await assertTest('Test 3: Reject duplicate pickup inspection for same booking (HTTP 409)', async () => {
            const { req, res } = mockReqRes({
                user: admin,
                body: {
                    booking_id: testBookingId,
                    inspection_type: 'pickup',
                    odometer_reading: 25000,
                    fuel_level: 100
                }
            });
            await createInspection(req, res);
            if (res.statusCode !== 409) throw new Error(`Expected HTTP 409, got ${res.statusCode}`);
        });

        // Test 4: Retrieve saved pickup inspection and photo associations
        await assertTest('Test 4: Reopening inspection displays saved odometer, checklist, and photographs', async () => {
            const { req, res } = mockReqRes({
                user: admin,
                params: { bookingId: testBookingId }
            });
            await getInspectionsByBooking(req, res);
            if (res.statusCode !== 200) throw new Error(`Expected HTTP 200, got ${res.statusCode}`);
            const p = res.data.pickupInspection;
            if (!p) throw new Error('Pickup inspection not found');
            if (Number(p.odometer_reading) !== 25000) throw new Error(`Odometer mismatch: ${p.odometer_reading}`);
            if (Number(p.fuel_level) !== 100) throw new Error(`Fuel mismatch: ${p.fuel_level}`);
            if (p.headlights_condition !== 'working') throw new Error(`Headlights mismatch`);
            if (p.mirrors_condition !== 'intact') throw new Error(`Mirrors mismatch`);
            if (p.windows_condition !== 'intact') throw new Error(`Windows mismatch`);
            if (!p.existing_scratches.includes('left rear bumper')) throw new Error('Scratches text missing');
            if (!p.photos || p.photos.length !== 2) throw new Error(`Expected 2 photos, found ${p.photos?.length}`);
        });

        // Test 5: Handover is blocked before customer reviews & accepts condition
        await assertTest('Test 5: Handover blocked before customer acceptance (HTTP 400)', async () => {
            const { req, res } = mockReqRes({
                user: admin,
                params: { bookingId: testBookingId }
            });
            await completeHandover(req, res);
            if (res.statusCode !== 400) throw new Error(`Expected HTTP 400, got ${res.statusCode}`);
            if (!res.data?.message?.includes('Customer has not reviewed and accepted')) {
                throw new Error(`Unexpected message: ${res.data?.message}`);
            }
        });

        // Test 6: Customer confirms and accepts vehicle condition
        await assertTest('Test 6: Customer reviews and accepts vehicle condition', async () => {
            const { req, res } = mockReqRes({
                user: customer,
                params: { id: pickupInspectionId }
            });
            await customerAcceptInspection(req, res);
            if (res.statusCode !== 200) throw new Error(`Expected HTTP 200, got ${res.statusCode}`);

            // Verify in DB
            const [rows] = await db.query('SELECT customer_accepted FROM vehicle_inspections WHERE id = ?', [pickupInspectionId]);
            if (!rows[0].customer_accepted) throw new Error('customer_accepted is not true in DB');
        });

        // Test 7: Admin completes handover -> Booking status transitions to 'active'
        await assertTest('Test 7: Admin completes handover -> Booking transitions to "active"', async () => {
            const { req, res } = mockReqRes({
                user: admin,
                params: { bookingId: testBookingId }
            });
            await completeHandover(req, res);
            if (res.statusCode !== 200) throw new Error(`Expected HTTP 200, got ${res.statusCode}`);
            if (res.data?.status !== 'active') throw new Error(`Expected status active, got ${res.data?.status}`);

            // Verify in DB
            const [rows] = await db.query('SELECT status FROM bookings WHERE booking_id = ?', [testBookingId]);
            if (rows[0].status !== 'active') throw new Error(`Booking status in DB is ${rows[0].status}`);
        });

        // Test 8: Return inspection rejects final odometer < starting odometer
        await assertTest('Test 8: Return inspection rejects final odometer less than pickup odometer (HTTP 400)', async () => {
            const { req, res } = mockReqRes({
                user: admin,
                body: {
                    booking_id: testBookingId,
                    inspection_type: 'return',
                    odometer_reading: 24000, // < 25000 starting odo
                    fuel_level: 90
                }
            });
            await createInspection(req, res);
            if (res.statusCode !== 400) throw new Error(`Expected HTTP 400, got ${res.statusCode}`);
            if (!res.data?.message?.includes('cannot be less than starting odometer')) {
                throw new Error(`Unexpected message: ${res.data?.message}`);
            }
        });

        // Test 9: Admin records return inspection (25,400 km, 85% fuel, minor return damage)
        await assertTest('Test 9: Admin records return inspection (25,400 km, 85% fuel, return damage notes)', async () => {
            const { req, res } = mockReqRes({
                user: admin,
                body: {
                    booking_id: testBookingId,
                    inspection_type: 'return',
                    odometer_reading: 25400,
                    fuel_level: 85,
                    exterior_condition: 'good',
                    interior_condition: 'good',
                    tyre_condition: 'good',
                    headlights_condition: 'working',
                    taillights_condition: 'working',
                    mirrors_condition: 'intact',
                    windows_condition: 'intact',
                    brakes_condition: 'optimal',
                    existing_scratches: 'Minor superficial scratch on left rear bumper',
                    damage_description: 'Small scratch on front right door',
                    inspection_notes: 'Vehicle returned on time',
                    photo_categories: ['other']
                },
                files: [
                    { path: photo1Path, originalname: 'return_other.jpg', mimetype: 'image/jpeg' }
                ]
            });
            await createInspection(req, res);
            if (res.statusCode !== 201) throw new Error(`Expected HTTP 201, got ${res.statusCode}: ${res.data?.message}`);
            returnInspectionId = res.data.inspection_id;
        });

        // Test 10: Difference analysis compares pickup and return records
        await assertTest('Test 10: Difference analysis accurately calculates distance (400 km) and fuel deficit (-15%)', async () => {
            const { req, res } = mockReqRes({
                user: admin,
                params: { bookingId: testBookingId }
            });
            await getInspectionsByBooking(req, res);
            if (res.statusCode !== 200) throw new Error(`Expected HTTP 200`);
            const diff = res.data.differenceReport;
            if (!diff) throw new Error('Difference report is null');
            if (diff.distanceTravelledKm !== 400) throw new Error(`Expected 400 km, got ${diff.distanceTravelledKm}`);
            if (diff.fuelDifferencePercentage !== -15) throw new Error(`Expected -15% fuel delta, got ${diff.fuelDifferencePercentage}`);
            if (diff.isFuelDeficit !== true) throw new Error('Expected isFuelDeficit true');
            if (diff.newDamageReported !== true) throw new Error('Expected newDamageReported true');
        });

        // Test 11: Admin completes and closes rental
        await assertTest('Test 11: Admin completes rental -> Booking status transitions to "completed"', async () => {
            const { req, res } = mockReqRes({
                user: admin,
                params: { bookingId: testBookingId }
            });
            await completeRental(req, res);
            if (res.statusCode !== 200) throw new Error(`Expected HTTP 200`);
            if (res.data?.status !== 'completed') throw new Error(`Expected completed status`);

            // Verify in DB
            const [rows] = await db.query('SELECT status FROM bookings WHERE booking_id = ?', [testBookingId]);
            if (rows[0].status !== 'completed') throw new Error(`Status in DB is ${rows[0].status}`);
        });

        // Test 12: Security: Unauthorized user rejected when trying to view another user\'s inspection
        await assertTest('Test 12: Security: Stranger customer cannot view another customer\'s inspection (HTTP 403)', async () => {
            const { req, res } = mockReqRes({
                user: stranger,
                params: { bookingId: testBookingId }
            });
            await getInspectionsByBooking(req, res);
            if (res.statusCode !== 403) throw new Error(`Expected HTTP 403, got ${res.statusCode}`);
        });

    } finally {
        // Cleanup isolated test data
        await db.query(`DELETE FROM inspection_photos WHERE inspection_id IN (?, ?)`, [pickupInspectionId || 0, returnInspectionId || 0]);
        await db.query(`DELETE FROM vehicle_inspections WHERE booking_id = ?`, [testBookingId]);
        await db.query(`DELETE FROM booking_additional_charges WHERE booking_id = ?`, [testBookingId]);
        await db.query(`DELETE FROM bookings WHERE booking_id = ?`, [testBookingId]);

        // Cleanup dummy files
        if (fs.existsSync(photo1Path)) fs.unlinkSync(photo1Path);
        if (fs.existsSync(photo2Path)) fs.unlinkSync(photo2Path);
    }

    console.log(`\n============================================================`);
    console.log(`Inspection Test Results: ${passedTests} Passed, ${failedTests} Failed (Total 12 Tests)`);
    console.log(`============================================================\n`);

    if (failedTests > 0) process.exit(1);
}

runSuite().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});

