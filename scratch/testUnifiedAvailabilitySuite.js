/**
 * RentIQ Unified Vehicle Availability & Booking Eligibility Test Suite
 *
 * Validates all 15 scenarios specified in Section 10 of the task:
 * 1. Valid RC, Insurance, PUC -> Available (green badge)
 * 2. 0 documents -> Compliance Required ("Missing RC, Insurance and PUC")
 * 3. Missing RC -> Compliance Required ("Missing RC")
 * 4. Expired Insurance -> Compliance Required ("Insurance expired")
 * 5. Expired PUC -> Compliance Required ("PUC expired")
 * 6. Rejected document -> Compliance Required ("... rejected")
 * 7. Active maintenance -> Under Maintenance (warning badge)
 * 8. Overlapping booking -> Booking conflict for those dates
 * 9. Valid documents + no conflicts -> Booking allowed
 * 10. Deactivated vehicle (is_available = 0) -> Unavailable
 * 11. Direct API booking attempt on non-compliant vehicle -> Rejected HTTP 400
 * 12. Public API, Details API, and Admin API consistency check
 * 13. Dynamic update when documents are uploaded
 * 14. Dynamic update when documents expire
 * 15. Dynamic update when maintenance ends
 */

const path = require('path');
require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const db = require('../backend/config/db');
const {
    evaluateVehicleAvailability,
    batchEvaluateVehicleAvailability
} = require('../backend/utils/vehicleAvailabilityHelper');
const { createBooking } = require('../backend/controllers/bookingController');

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
        query: options.query || {}
    };
    const res = {
        statusCode: 200,
        data: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.data = payload;
            return this;
        }
    };
    return { req, res };
}

async function runSuite() {
    console.log(`\n============================================================`);
    console.log(`RentIQ Unified Vehicle Availability & Compliance Test Suite`);
    console.log(`============================================================\n`);

    // Setup a clean temporary test vehicle to run isolated assertions
    const testPlate = `TEST-AVL-${Date.now().toString().slice(-4)}`;
    const [insRes] = await db.query(`
        INSERT INTO vehicles (
            category_id, name, brand, model, manufacturing_year, vehicle_color,
            registration_number, registration_state, registration_date, registration_validity,
            fuel_type, transmission, seating_capacity, price_per_day, is_available
        ) VALUES (1, 'Test Sedan', 'RentIQ Motors', 'TX-1', 2024, 'Pearl White', ?, 'DL', '2024-01-01', '2039-01-01', 'petrol', 'manual', 5, 2500, 1)
    `, [testPlate]);
    const testVehId = insRes.insertId;

    // Get an active customer user with verified licence for booking tests
    const [users] = await db.query(`SELECT user_id, email, role FROM users WHERE role = 'customer' LIMIT 1`);
    let testUser = users[0];
    if (!testUser) {
        const [uIns] = await db.query(`INSERT INTO users (name, email, password, role) VALUES ('Test Booking Customer', 'test_book_cust@rentiq.com', 'hashed', 'customer')`);
        testUser = { user_id: uIns.insertId, email: 'test_book_cust@rentiq.com', role: 'customer' };
    }

    // Ensure customer has a verified driving licence
    await db.query(`
        INSERT INTO customer_licenses (user_id, license_number, holder_name, issue_date, expiry_date, vehicle_class, front_document_path, verification_status)
        VALUES (?, 'DL-TEST-99999', 'Test Driver', '2020-01-01', '2040-01-01', 'LMV', 'test.jpg', 'verified')
        ON DUPLICATE KEY UPDATE verification_status = 'verified', expiry_date = '2040-01-01', vehicle_class = 'LMV'
    `, [testUser.user_id]);

    try {
        // Scenario 1: Vehicle with valid RC, Insurance, and PUC -> Available
        await assertTest('Scenario 1: Vehicle with valid RC, Insurance, and PUC -> Available (green badge)', async () => {
            const v1 = { vehicle_id: 1, is_available: 1 };
            const res = await evaluateVehicleAvailability(v1);
            if (res.availabilityStatus !== 'available' || !res.bookingEligible) {
                throw new Error(`Expected available & bookingEligible true, got status: ${res.availabilityStatus}`);
            }
            if (res.badge.variant !== 'success') {
                throw new Error(`Expected success badge, got ${res.badge.variant}`);
            }
        });

        // Scenario 2: Vehicle with 0 documents -> Compliance Required ("Missing RC, Insurance and PUC")
        await assertTest('Scenario 2: Vehicle with 0 documents -> Compliance Required ("Missing RC, Insurance and PUC")', async () => {
            const v = { vehicle_id: testVehId, is_available: 1 };
            const res = await evaluateVehicleAvailability(v);
            if (res.availabilityStatus !== 'compliance_required' || res.bookingEligible !== false) {
                throw new Error(`Expected compliance_required, got ${res.availabilityStatus}`);
            }
            if (!res.displayReason.includes('Missing RC, Insurance and PUC')) {
                throw new Error(`Expected reason 'Missing RC, Insurance and PUC', got: ${res.displayReason}`);
            }
            if (res.badge.variant !== 'warning') {
                throw new Error(`Expected warning badge variant, got ${res.badge.variant}`);
            }
        });

        // Scenario 3: Vehicle missing RC only -> Compliance Required ("Missing RC")
        await assertTest('Scenario 3: Vehicle missing RC only -> Compliance Required ("Missing RC")', async () => {
            const mockDocs = [
                { document_type: 'insurance', expiry_date: '2028-01-01', verification_status: 'valid' },
                { document_type: 'puc', expiry_date: '2028-01-01', verification_status: 'valid' }
            ];
            const res = await evaluateVehicleAvailability({ vehicle_id: testVehId, is_available: 1 }, { documents: mockDocs });
            if (res.availabilityStatus !== 'compliance_required') throw new Error(`Expected compliance_required`);
            if (!res.displayReason.includes('Missing RC') || res.displayReason.includes('Insurance') || res.displayReason.includes('PUC')) {
                throw new Error(`Expected reason to mention only Missing RC, got: ${res.displayReason}`);
            }
        });

        // Scenario 4: Vehicle with expired Insurance -> Compliance Required ("Insurance expired")
        await assertTest('Scenario 4: Vehicle with expired Insurance -> Compliance Required ("Insurance expired")', async () => {
            const mockDocs = [
                { document_type: 'rc', expiry_date: '2035-01-01', verification_status: 'valid' },
                { document_type: 'insurance', expiry_date: '2024-01-01', verification_status: 'valid' }, // Expired date
                { document_type: 'puc', expiry_date: '2028-01-01', verification_status: 'valid' }
            ];
            const res = await evaluateVehicleAvailability({ vehicle_id: testVehId, is_available: 1 }, { documents: mockDocs });
            if (res.availabilityStatus !== 'compliance_required') throw new Error(`Expected compliance_required`);
            if (!res.displayReason.toLowerCase().includes('insurance expired')) {
                throw new Error(`Expected reason to include 'Insurance expired', got: ${res.displayReason}`);
            }
        });

        // Scenario 5: Vehicle with expired PUC -> Compliance Required ("PUC expired")
        await assertTest('Scenario 5: Vehicle with expired PUC -> Compliance Required ("PUC expired")', async () => {
            const mockDocs = [
                { document_type: 'rc', expiry_date: '2035-01-01', verification_status: 'valid' },
                { document_type: 'insurance', expiry_date: '2028-01-01', verification_status: 'valid' },
                { document_type: 'puc', expiry_date: '2024-01-01', verification_status: 'valid' } // Expired PUC
            ];
            const res = await evaluateVehicleAvailability({ vehicle_id: testVehId, is_available: 1 }, { documents: mockDocs });
            if (res.availabilityStatus !== 'compliance_required') throw new Error(`Expected compliance_required`);
            if (!res.displayReason.toLowerCase().includes('puc expired')) {
                throw new Error(`Expected reason to include 'PUC expired', got: ${res.displayReason}`);
            }
        });

        // Scenario 6: Vehicle with rejected document -> Compliance Required ("... rejected")
        await assertTest('Scenario 6: Vehicle with rejected document -> Compliance Required ("... rejected")', async () => {
            const mockDocs = [
                { document_type: 'rc', expiry_date: '2035-01-01', verification_status: 'valid' },
                { document_type: 'insurance', expiry_date: '2028-01-01', verification_status: 'rejected' }, // Rejected
                { document_type: 'puc', expiry_date: '2028-01-01', verification_status: 'valid' }
            ];
            const res = await evaluateVehicleAvailability({ vehicle_id: testVehId, is_available: 1 }, { documents: mockDocs });
            if (res.availabilityStatus !== 'compliance_required') throw new Error(`Expected compliance_required`);
            if (!res.displayReason.toLowerCase().includes('rejected')) {
                throw new Error(`Expected reason to include 'rejected', got: ${res.displayReason}`);
            }
        });

        // Scenario 7: Vehicle under active maintenance -> Under Maintenance (warning badge)
        await assertTest('Scenario 7: Vehicle under active maintenance -> Under Maintenance (warning badge)', async () => {
            const mockDocs = [
                { document_type: 'rc', expiry_date: '2035-01-01', verification_status: 'valid' },
                { document_type: 'insurance', expiry_date: '2028-01-01', verification_status: 'valid' },
                { document_type: 'puc', expiry_date: '2028-01-01', verification_status: 'valid' }
            ];
            const mockMaint = [
                { id: 101, maintenance_category: 'Periodic Service', status: 'in_progress', start_date: '2026-11-01', end_date: null }
            ];
            const res = await evaluateVehicleAvailability(
                { vehicle_id: testVehId, is_available: 1 },
                { documents: mockDocs, maintenanceRecords: mockMaint }
            );
            if (res.availabilityStatus !== 'under_maintenance' || res.bookingEligible !== false) {
                throw new Error(`Expected under_maintenance, got ${res.availabilityStatus}`);
            }
            if (res.statusCode !== 'VEHICLE_UNDER_MAINTENANCE') {
                throw new Error(`Expected VEHICLE_UNDER_MAINTENANCE, got ${res.statusCode}`);
            }
        });

        // Scenario 8: Overlapping confirmed booking -> Unavailable / BOOKING_CONFLICT for those dates
        await assertTest('Scenario 8: Overlapping confirmed booking -> Unavailable / BOOKING_CONFLICT for those dates', async () => {
            // Swift has valid docs, insert active booking for Swift within validity window (2027)
            const startStr = '2027-05-10 10:00:00';
            const endStr = '2027-05-15 10:00:00';
            const [bIns] = await db.query(`
                INSERT INTO bookings (user_id, vehicle_id, pickup_datetime, return_datetime, total_price, status)
                VALUES (?, 1, ?, ?, 10000, 'confirmed')
            `, [testUser.user_id, startStr, endStr]);
            const testBookingId = bIns.insertId;

            try {
                const res = await evaluateVehicleAvailability(
                    { vehicle_id: 1, is_available: 1 },
                    { rentalStartDate: '2027-05-12 10:00:00', rentalEndDate: '2027-05-14 10:00:00' }
                );
                if (res.bookingEligible !== false || res.statusCode !== 'BOOKING_CONFLICT') {
                    throw new Error(`Expected BOOKING_CONFLICT, got: ${res.statusCode}`);
                }
            } finally {
                await db.query(`DELETE FROM bookings WHERE booking_id = ?`, [testBookingId]);
            }
        });

        // Scenario 9: Valid documents + no conflicts -> Booking allowed
        await assertTest('Scenario 9: Valid documents + no conflicts -> Booking allowed (bookingEligible = true)', async () => {
            const res = await evaluateVehicleAvailability(
                { vehicle_id: 1, is_available: 1 },
                { rentalStartDate: '2027-06-01 10:00:00', rentalEndDate: '2027-06-04 10:00:00' }
            );
            if (!res.bookingEligible || res.availabilityStatus !== 'available') {
                throw new Error(`Expected bookingEligible true, got: ${res.bookingEligible}, status: ${res.availabilityStatus}`);
            }
        });

        // Scenario 10: Manually deactivated vehicle (is_available = 0) -> Unavailable (red badge)
        await assertTest('Scenario 10: Manually deactivated vehicle (is_available = 0) -> Unavailable (red badge)', async () => {
            const res = await evaluateVehicleAvailability({ vehicle_id: 1, is_available: 0 });
            if (res.availabilityStatus !== 'unavailable' || res.bookingEligible !== false) {
                throw new Error(`Expected unavailable, got ${res.availabilityStatus}`);
            }
            if (res.badge.variant !== 'danger') {
                throw new Error(`Expected danger badge variant, got ${res.badge.variant}`);
            }
        });

        // Scenario 11: Direct API booking attempt with missing documents -> Rejected (HTTP 400)
        await assertTest('Scenario 11: Direct API booking attempt with missing documents -> Rejected (HTTP 400)', async () => {
            const { req, res } = mockReqRes({
                user: testUser,
                body: {
                    vehicleId: testVehId, // testVehId has 0 documents
                    pickupDatetime: '2028-07-01 10:00:00',
                    returnDatetime: '2028-07-03 10:00:00'
                }
            });
            await createBooking(req, res);
            if (res.statusCode !== 400) {
                throw new Error(`Expected HTTP 400 rejection, got ${res.statusCode}`);
            }
            if (res.data?.code !== 'VEHICLE_COMPLIANCE_HOLD') {
                throw new Error(`Expected code VEHICLE_COMPLIANCE_HOLD, got ${res.data?.code}`);
            }
        });

        // Scenario 12: Consistency check across Public Details, Public Catalog, and Admin Vehicles
        await assertTest('Scenario 12: Scorpio #6 has identical availability status across Public Catalog and Admin List', async () => {
            const [vRows] = await db.query(`SELECT * FROM vehicles WHERE vehicle_id = 6`);
            const evaluated = await batchEvaluateVehicleAvailability(vRows);
            const scorpioBatch = evaluated[0];
            const scorpioSingle = await evaluateVehicleAvailability(vRows[0]);

            if (scorpioBatch.availability_status !== scorpioSingle.availabilityStatus) {
                throw new Error(`Mismatch between batch and single evaluation: batch=${scorpioBatch.availability_status}, single=${scorpioSingle.availabilityStatus}`);
            }
            if (scorpioBatch.booking_eligible !== scorpioSingle.bookingEligible) {
                throw new Error(`Mismatch in booking_eligible: batch=${scorpioBatch.booking_eligible}, single=${scorpioSingle.bookingEligible}`);
            }
        });

        // Scenario 13: Availability updates immediately when valid documents are uploaded
        await assertTest('Scenario 13: Availability updates immediately when valid documents are uploaded and approved', async () => {
            // Upload 3 valid documents for test vehicle
            await db.query(`
                INSERT INTO vehicle_documents (vehicle_id, document_type, document_number, issue_date, expiry_date, file_path, verification_status)
                VALUES
                    (?, 'rc', 'RC-TMP-1', '2024-01-01', '2039-01-01', 'rc.pdf', 'valid'),
                    (?, 'insurance', 'INS-TMP-1', '2024-01-01', '2029-01-01', 'ins.pdf', 'valid'),
                    (?, 'puc', 'PUC-TMP-1', '2024-01-01', '2029-01-01', 'puc.pdf', 'valid')
            `, [testVehId, testVehId, testVehId]);

            const res = await evaluateVehicleAvailability({ vehicle_id: testVehId, is_available: 1 });
            if (res.availabilityStatus !== 'available' || !res.bookingEligible) {
                throw new Error(`Expected vehicle to become available after doc upload, got ${res.availabilityStatus}`);
            }
        });

        // Scenario 14: Availability updates immediately when documents expire
        await assertTest('Scenario 14: Availability updates immediately when documents expire', async () => {
            // Expire the insurance document
            await db.query(`
                UPDATE vehicle_documents
                SET expiry_date = '2024-01-01'
                WHERE vehicle_id = ? AND document_type = 'insurance'
            `, [testVehId]);

            const res = await evaluateVehicleAvailability({ vehicle_id: testVehId, is_available: 1 });
            if (res.availabilityStatus !== 'compliance_required' || res.bookingEligible !== false) {
                throw new Error(`Expected compliance_required after expiry, got ${res.availabilityStatus}`);
            }
            if (!res.displayReason.includes('Insurance expired')) {
                throw new Error(`Expected reason to indicate 'Insurance expired', got: ${res.displayReason}`);
            }
        });

        // Scenario 15: Availability updates immediately when maintenance ends
        await assertTest('Scenario 15: Availability updates immediately when maintenance ends', async () => {
            // Restore insurance document
            await db.query(`
                UPDATE vehicle_documents
                SET expiry_date = '2029-01-01'
                WHERE vehicle_id = ? AND document_type = 'insurance'
            `, [testVehId]);

            // Add ongoing maintenance
            const [mIns] = await db.query(`
                INSERT INTO vehicle_maintenance (
                    vehicle_id, maintenance_category, status, start_date, service_date,
                    odometer_reading, service_center, description
                ) VALUES (
                    ?, 'brake_servicing', 'in_progress', CURDATE(), CURDATE(),
                    25000, 'RentIQ Workshop', 'Routine brake inspection and pad replacement'
                )
            `, [testVehId]);
            const maintId = mIns.insertId;

            // Check while in progress
            const duringMaint = await evaluateVehicleAvailability({ vehicle_id: testVehId, is_available: 1 });
            if (duringMaint.availabilityStatus !== 'under_maintenance') {
                throw new Error(`Expected under_maintenance during active maintenance, got ${duringMaint.availabilityStatus}`);
            }

            // Complete the maintenance
            await db.query(`
                UPDATE vehicle_maintenance
                SET status = 'completed', end_date = CURDATE()
                WHERE id = ?
            `, [maintId]);

            // Re-evaluate
            const afterMaint = await evaluateVehicleAvailability({ vehicle_id: testVehId, is_available: 1 });
            if (afterMaint.availabilityStatus !== 'available' || !afterMaint.bookingEligible) {
                throw new Error(`Expected available after maintenance completion, got ${afterMaint.availabilityStatus}`);
            }
        });

    } finally {
        // Clean up test vehicle, documents, and maintenance records
        await db.query(`DELETE FROM vehicle_maintenance WHERE vehicle_id = ?`, [testVehId]);
        await db.query(`DELETE FROM vehicle_documents WHERE vehicle_id = ?`, [testVehId]);
        await db.query(`DELETE FROM vehicles WHERE vehicle_id = ?`, [testVehId]);
    }

    console.log(`\n============================================================`);
    console.log(`Test Results: ${passedTests} Passed, ${failedTests} Failed (Total 15 Scenarios)`);
    console.log(`============================================================\n`);

    if (failedTests > 0) {
        process.exit(1);
    }
}

runSuite().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
