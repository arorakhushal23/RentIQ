/**
 * RentIQ Comprehensive Enhancement Test Suite
 * Tests Features 1, 2, and 3:
 * 1. Complete Vehicle Details & Registration Management
 * 2. Vehicle Document Management & Booking Eligibility
 * 3. Customer Driving Licence Verification & Booking Integration
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../config/db');
const {
    getAllVehicles: adminGetAllVehicles,
    createVehicle: adminCreateVehicle,
    updateVehicle: adminUpdateVehicle,
    getVehicleByIdAdmin
} = require('../controllers/adminVehicleController');
const {
    getVehicles: publicGetVehicles,
    getVehicleById: publicGetVehicleById
} = require('../controllers/vehicleController');
const {
    getVehicleDocuments,
    uploadDocument,
    updateDocument,
    getDocumentAlerts
} = require('../controllers/vehicleDocumentController');
const {
    getMyLicense,
    submitLicense,
    getAllLicenses,
    verifyLicense,
    rejectLicense
} = require('../controllers/licenseController');
const { createBooking } = require('../controllers/bookingController');
const { getMyNotifications } = require('../controllers/notificationController');

function mockReqRes({ body = {}, params = {}, query = {}, user = null, file = null, files = null }) {
    const req = { body, params, query, user, file, files, headers: {}, header: () => null };
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

async function runTestSuite() {
    console.log('================================================================');
    console.log('Starting RentIQ Advanced Vehicle, Document & Licence Test Suite');
    console.log('================================================================\n');

    const [admins] = await db.query("SELECT user_id, role, email FROM users WHERE role = 'admin' LIMIT 1");
    const adminUser = admins[0] || { user_id: 12, role: 'admin' };

    // Create isolated test customers
    const testTimestamp = Date.now();
    const [testCust1Result] = await db.query(
        "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, 'hash', 'customer')",
        [`Test Cust One ${testTimestamp}`, `cust1_${testTimestamp}@test.com`]
    );
    const cust1 = { user_id: testCust1Result.insertId, role: 'customer' };

    const [testCust2Result] = await db.query(
        "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, 'hash', 'customer')",
        [`Test Cust Two ${testTimestamp}`, `cust2_${testTimestamp}@test.com`]
    );
    const cust2 = { user_id: testCust2Result.insertId, role: 'customer' };

    let createdVehicleId = null;
    let passedCount = 0;
    let failedCount = 0;

    async function assertTest(name, fn) {
        try {
            await fn();
            console.log(`✓ PASS: ${name}`);
            passedCount++;
        } catch (err) {
            console.error(`✗ FAIL: ${name}`);
            console.error(`  Error: ${err.message}`);
            failedCount++;
        }
    }

    try {
        // --- FEATURE 1: VEHICLE MANAGEMENT ---

        // Test 1: Admin creates vehicle with complete details
        await assertTest('Test 1: Admin creates vehicle with complete basic, technical, and registration info', async () => {
            const regNumber = `TEST-${testTimestamp.toString().slice(-6)}`;
            const { req, res } = mockReqRes({
                user: adminUser,
                body: {
                    name: 'Kodiaq',
                    brand: 'Skoda',
                    model: 'L&K 4x4',
                    category_id: 3,
                    manufacturing_year: 2024,
                    vehicle_color: 'Lava Blue',
                    registration_number: regNumber,
                    registration_state: 'Delhi',
                    registration_date: '2024-03-01',
                    registration_validity: '2039-02-28',
                    fuel_type: 'petrol',
                    mileage: '13.3 km/l',
                    engine_capacity: '1984 cc TSI',
                    description: 'Luxury 7-seater European SUV with Canton audio and virtual cockpit.',
                    engine_number: 'EA888-99182',
                    chassis_number: 'TMBJJ123849182',
                    vehicle_identification_number: 'TMBJJ123849182',
                    doors: 5,
                    boot_space: '270 L',
                    max_passengers: 7,
                    seating_capacity: 7,
                    transmission: 'automatic',
                    price_per_day: 4500,
                    image_url: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d',
                    is_available: true
                }
            });
            await adminCreateVehicle(req, res);
            if (res.statusCode !== 201) throw new Error(`Create failed: ${res.data?.message}`);
            createdVehicleId = res.data.vehicle.vehicle_id;
            if (res.data.vehicle.registration_number !== regNumber) {
                throw new Error(`Registration number mismatch: ${res.data.vehicle.registration_number}`);
            }
        });

        // Test 2: Admin edits vehicle registration details
        await assertTest('Test 2: Admin updates vehicle registration details and specs', async () => {
            const { req, res } = mockReqRes({
                user: adminUser,
                params: { id: createdVehicleId },
                body: {
                    name: 'Kodiaq Sportline',
                    brand: 'Skoda',
                    model: 'Sportline 4x4',
                    category_id: 3,
                    manufacturing_year: 2024,
                    vehicle_color: 'Race Blue',
                    registration_number: `TEST-${testTimestamp.toString().slice(-6)}`,
                    registration_state: 'Delhi',
                    registration_date: '2024-03-01',
                    registration_validity: '2039-02-28',
                    fuel_type: 'petrol',
                    mileage: '13.8 km/l',
                    engine_capacity: '1984 cc TSI',
                    description: 'Updated sports edition with alcantara upholstery.',
                    engine_number: 'EA888-99182',
                    chassis_number: 'TMBJJ123849182',
                    vehicle_identification_number: 'TMBJJ123849182',
                    doors: 5,
                    boot_space: '270 L',
                    max_passengers: 7,
                    seating_capacity: 7,
                    transmission: 'automatic',
                    price_per_day: 4800,
                    image_url: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d',
                    is_available: true
                }
            });
            await adminUpdateVehicle(req, res);
            if (res.statusCode !== 200) throw new Error(`Update failed: ${res.data?.message}`);
            if (res.data.vehicle.name !== 'Kodiaq Sportline') throw new Error('Name update failed');
        });

        // Test 3: Search vehicle by registration number
        await assertTest('Test 3: Search vehicles using registration number', async () => {
            const regSearch = testTimestamp.toString().slice(-6);
            const { req, res } = mockReqRes({
                query: { search: regSearch }
            });
            await publicGetVehicles(req, res);
            if (res.statusCode !== 200) throw new Error(`Search failed with status ${res.statusCode}`);
            const list = Array.isArray(res.data) ? res.data : res.data.vehicles;
            const found = list.some(v => v.vehicle_id === createdVehicleId);
            if (!found) throw new Error('Vehicle not found by registration number search');
        });

        // Test 4: Verify public endpoint strips sensitive engine/chassis/VIN numbers
        await assertTest('Test 4: Customer vehicle details endpoint does NOT expose engine_number, chassis_number, or VIN', async () => {
            const { req, res } = mockReqRes({
                params: { id: createdVehicleId }
            });
            await publicGetVehicleById(req, res);
            if (res.statusCode !== 200) throw new Error(`Public fetch failed`);
            const v = res.data;
            if (v.engine_number || v.chassis_number || v.vehicle_identification_number) {
                throw new Error('SECURITY VIOLATION: Sensitive technical numbers exposed in public API response!');
            }
            if (!v.registration_number) {
                throw new Error('Public vehicle should display registration number');
            }
        });

        // --- FEATURE 2: VEHICLE DOCUMENT MANAGEMENT ---

        // Test 5: Add valid documents to created vehicle
        await assertTest('Test 5: Upload valid RC, Insurance, and PUC certificates for vehicle', async () => {
            // 1. RC
            await db.query(`
                INSERT INTO vehicle_documents (vehicle_id, document_type, document_number, issue_date, expiry_date, file_path, verification_status)
                VALUES (?, 'rc', 'RC-KODIAQ-001', '2024-03-01', '2039-02-28', 'kodiaq_rc.pdf', 'valid')
            `, [createdVehicleId]);

            // 2. Insurance (valid for 1 year)
            await db.query(`
                INSERT INTO vehicle_documents (vehicle_id, document_type, document_number, issue_date, expiry_date, file_path, verification_status)
                VALUES (?, 'insurance', 'INS-HDFC-KOD-001', '2026-03-01', '2027-03-01', 'kodiaq_ins.pdf', 'valid')
            `, [createdVehicleId]);

            // 3. PUC (valid for 6 months)
            await db.query(`
                INSERT INTO vehicle_documents (vehicle_id, document_type, document_number, issue_date, expiry_date, file_path, verification_status)
                VALUES (?, 'puc', 'PUC-DEL-KOD-001', '2026-09-01', '2027-03-01', 'kodiaq_puc.pdf', 'valid')
            `, [createdVehicleId]);

            const { req, res } = mockReqRes({
                user: adminUser,
                params: { vehicleId: createdVehicleId }
            });
            await getVehicleDocuments(req, res);
            if (res.statusCode !== 200) throw new Error(`Fetch docs failed`);
            if (res.data.documents.length !== 3) throw new Error(`Expected 3 documents, got ${res.data.documents.length}`);
            const allValid = res.data.documents.every(d => d.calculated_status === 'valid');
            if (!allValid) throw new Error('Expected all uploaded documents to have calculated_status "valid"');
        });

        // Test 6: Detect expiring and expired document alerts
        await assertTest('Test 6: Admin fleet document alerts detects expired and expiring soon documents', async () => {
            const { req, res } = mockReqRes({ user: adminUser });
            await getDocumentAlerts(req, res);
            if (res.statusCode !== 200) throw new Error(`Alerts fetch failed`);
            if (!res.data.summary || res.data.summary.expired < 1) {
                throw new Error('Expected at least 1 expired document alert (e.g. from seeded Verna)');
            }
        });

        // Test 7: Block booking for vehicle with expired insurance (Vehicle 4: Verna)
        await assertTest('Test 7: Backend blocks booking for vehicle with expired insurance (HTTP 400 compliance hold)', async () => {
            // Cust 1 needs verified licence to test vehicle document blocking
            await db.query(`
                INSERT INTO customer_licenses (user_id, license_number, holder_name, issue_date, expiry_date, vehicle_class, front_document_path, verification_status)
                VALUES (?, 'DL-TEST-CUST1', 'Test Cust One', '2020-01-01', '2040-01-01', 'LMV', 'front.jpg', 'verified')
            `, [cust1.user_id]);

            const { req, res } = mockReqRes({
                user: cust1,
                body: {
                    vehicleId: 4, // Vehicle 4 has expired insurance
                    pickupDatetime: '2027-06-10 10:00:00',
                    returnDatetime: '2027-06-10 14:00:00'
                }
            });
            await createBooking(req, res);
            if (res.statusCode !== 400) throw new Error(`Expected HTTP 400, got ${res.statusCode}`);
            if (res.data?.code !== 'VEHICLE_COMPLIANCE_HOLD') {
                throw new Error(`Expected code VEHICLE_COMPLIANCE_HOLD, got ${res.data?.code}`);
            }
        });

        // --- FEATURE 3: CUSTOMER DRIVING LICENCE ---

        // Test 8: Block booking when customer has NOT submitted licence
        await assertTest('Test 8: Block booking when customer has NOT submitted licence (HTTP 403 LICENSE_NOT_SUBMITTED)', async () => {
            const { req, res } = mockReqRes({
                user: cust2, // Cust 2 has not submitted licence yet
                body: {
                    vehicleId: 1, // Vehicle 1 (Swift) is valid
                    pickupDatetime: '2027-06-12 10:00:00',
                    returnDatetime: '2027-06-12 14:00:00'
                }
            });
            await createBooking(req, res);
            if (res.statusCode !== 403) throw new Error(`Expected HTTP 403, got ${res.statusCode}`);
            if (res.data?.code !== 'LICENSE_NOT_SUBMITTED') {
                throw new Error(`Expected code LICENSE_NOT_SUBMITTED, got ${res.data?.code}`);
            }
        });

        // Test 9: Customer submits driving licence -> sets status 'pending'
        await assertTest('Test 9: Customer submits licence and receives pending verification status', async () => {
            const { req, res } = mockReqRes({
                user: cust2,
                body: {
                    license_number: 'DL-0920220078912',
                    holder_name: 'Test Cust Two',
                    date_of_birth: '1996-05-15',
                    issue_date: '2022-06-01',
                    expiry_date: '2042-05-31',
                    vehicle_class: 'LMV'
                },
                files: {
                    front: [{ path: 'backend/uploads/customer_licenses/cust2_front.jpg' }]
                }
            });
            await submitLicense(req, res);
            if (res.statusCode !== 200) throw new Error(`Submission failed: ${res.data?.message}`);
            if (res.data?.status !== 'pending') throw new Error(`Expected status 'pending', got ${res.data?.status}`);
        });

        // Test 10: Block booking when customer licence is pending
        await assertTest('Test 10: Block booking when licence is pending admin approval (HTTP 403 LICENSE_PENDING)', async () => {
            const { req, res } = mockReqRes({
                user: cust2,
                body: {
                    vehicleId: 1,
                    pickupDatetime: '2027-06-12 10:00:00',
                    returnDatetime: '2027-06-12 14:00:00'
                }
            });
            await createBooking(req, res);
            if (res.statusCode !== 403) throw new Error(`Expected HTTP 403, got ${res.statusCode}`);
            if (res.data?.code !== 'LICENSE_PENDING') {
                throw new Error(`Expected code LICENSE_PENDING, got ${res.data?.code}`);
            }
        });

        // Test 11: Admin rejects licence with reason
        await assertTest('Test 11: Admin rejects licence with clear reason and customer receives notification', async () => {
            const [licRows] = await db.query('SELECT id FROM customer_licenses WHERE user_id = ?', [cust2.user_id]);
            const licId = licRows[0].id;

            const { req, res } = mockReqRes({
                user: adminUser,
                params: { id: licId },
                body: { rejection_reason: 'Front image was blurred and expiration date not readable.' }
            });
            await rejectLicense(req, res);
            if (res.statusCode !== 200) throw new Error(`Reject failed: ${res.data?.message}`);
            if (res.data?.status !== 'rejected') throw new Error(`Expected status rejected`);

            // Verify customer received notification
            const { req: rNotif, res: resNotif } = mockReqRes({ user: cust2 });
            await getMyNotifications(rNotif, resNotif);
            const notifs = resNotif.data.notifications;
            const rejNotif = notifs.find(n => n.type === 'license_rejected');
            if (!rejNotif) throw new Error('Customer did not receive rejection notification');
        });

        // Test 12: Customer resubmits licence after rejection
        await assertTest('Test 12: Customer resubmits updated licence documents', async () => {
            const { req, res } = mockReqRes({
                user: cust2,
                body: {
                    license_number: 'DL-0920220078912',
                    holder_name: 'Test Cust Two',
                    date_of_birth: '1996-05-15',
                    issue_date: '2022-06-01',
                    expiry_date: '2042-05-31',
                    vehicle_class: 'LMV'
                },
                files: {
                    front: [{ path: 'backend/uploads/customer_licenses/cust2_front_clear.jpg' }],
                    back: [{ path: 'backend/uploads/customer_licenses/cust2_back_clear.jpg' }]
                }
            });
            await submitLicense(req, res);
            if (res.statusCode !== 200) throw new Error(`Resubmission failed: ${res.data?.message}`);

            // Check status returned to pending
            const { req: rCheck, res: resCheck } = mockReqRes({ user: cust2 });
            await getMyLicense(rCheck, resCheck);
            if (resCheck.data.status !== 'pending') throw new Error(`Status should be 'pending' after resubmission`);
        });

        // Test 13: Admin approves / verifies licence
        await assertTest('Test 13: Admin approves licence and customer receives verified notification', async () => {
            const [licRows] = await db.query('SELECT id FROM customer_licenses WHERE user_id = ?', [cust2.user_id]);
            const licId = licRows[0].id;

            const { req, res } = mockReqRes({
                user: adminUser,
                params: { id: licId }
            });
            await verifyLicense(req, res);
            if (res.statusCode !== 200) throw new Error(`Verify failed: ${res.data?.message}`);
            if (res.data.status !== 'verified') throw new Error('Expected status verified');

            // Verify notification
            const { req: rNotif, res: resNotif } = mockReqRes({ user: cust2 });
            await getMyNotifications(rNotif, resNotif);
            const verifiedNotif = resNotif.data.notifications.find(n => n.type === 'license_verified');
            if (!verifiedNotif) throw new Error('Customer did not receive verified notification');
        });

        // Test 14: Masking licence numbers in admin list views
        await assertTest('Test 14: Admin licence list masks middle characters of licence number', async () => {
            const { req, res } = mockReqRes({ user: adminUser, query: {} });
            await getAllLicenses(req, res);
            if (res.statusCode !== 200) throw new Error('List failed');
            const lic = res.data.find(l => l.user_id === cust2.user_id);
            if (!lic) throw new Error('Licence for cust2 not found');
            if (!lic.masked_license_number.includes('••••••')) {
                throw new Error(`Masked number invalid: ${lic.masked_license_number}`);
            }
        });

        // Test 15: Booking succeeds now that customer is verified and vehicle is compliant
        await assertTest('Test 15: Booking confirmed successfully when customer is verified and vehicle is compliant', async () => {
            const { req, res } = mockReqRes({
                user: cust2,
                body: {
                    vehicleId: 1, // Swift: valid RC, Ins, PUC
                    pickupDatetime: '2027-07-01 10:00:00',
                    returnDatetime: '2027-07-01 14:00:00'
                }
            });
            await createBooking(req, res);
            if (res.statusCode !== 201) throw new Error(`Booking failed: ${res.data?.message}`);
            if (!res.data?.booking?.bookingId) throw new Error('No booking ID returned');
        });

        // Test 16: Licence class mismatch blocked (e.g. LMV renting a Bike)
        await assertTest('Test 16: Booking rejected when licence class does not match vehicle category (LMV trying to rent Classic 350 Bike)', async () => {
            const { req, res } = mockReqRes({
                user: cust2, // cust2 has 'LMV' licence
                body: {
                    vehicleId: 7, // Classic 350 (Bike)
                    pickupDatetime: '2027-07-02 10:00:00',
                    returnDatetime: '2027-07-02 14:00:00'
                }
            });
            await createBooking(req, res);
            if (res.statusCode !== 403) throw new Error(`Expected HTTP 403, got ${res.statusCode}`);
            if (res.data?.code !== 'LICENSE_CLASS_MISMATCH') {
                throw new Error(`Expected LICENSE_CLASS_MISMATCH, got ${res.data?.code}`);
            }
        });

    } finally {
        // Cleanup isolated test records
        console.log('\nCleaning up isolated test data...');
        if (createdVehicleId) {
            await db.query('DELETE FROM vehicle_documents WHERE vehicle_id = ?', [createdVehicleId]);
            await db.query('DELETE FROM vehicles WHERE vehicle_id = ?', [createdVehicleId]);
        }
        await db.query('DELETE FROM bookings WHERE user_id IN (?, ?)', [cust1.user_id, cust2.user_id]);
        await db.query('DELETE FROM notifications WHERE user_id IN (?, ?)', [cust1.user_id, cust2.user_id]);
        await db.query('DELETE FROM customer_licenses WHERE user_id IN (?, ?)', [cust1.user_id, cust2.user_id]);
        await db.query('DELETE FROM users WHERE user_id IN (?, ?)', [cust1.user_id, cust2.user_id]);
        console.log('Cleanup completed.\n');
    }

    console.log('================================================================');
    console.log(`Test Results: ${passedCount} Passed, ${failedCount} Failed`);
    console.log('================================================================');
    if (failedCount > 0) {
        process.exit(1);
    }
}

runTestSuite()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('Test suite runner crashed:', err);
        process.exit(1);
    });

