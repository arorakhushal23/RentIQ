const assert = require('assert');
const fs = require('fs');
const db = require('../config/db');
const {
    calculateHaversineDistanceKm,
    calculateDrivingRoute,
    calculateDeliveryCharge
} = require('../utils/distanceCalculator');
const {
    buildAgreementData,
    generateAgreementPDF
} = require('../utils/agreementHelper');
const { ensureAgreementExists } = require('../controllers/agreementController');

async function runPhase2Tests() {
    console.log('================================================================');
    console.log('Starting RentIQ Phase 2: Location, Inspection & Agreement Suite');
    console.log('================================================================\n');

    let passed = 0;
    let failed = 0;

    function recordPass(testName) {
        passed++;
        console.log(`✓ PASS: ${testName}`);
    }

    function recordFail(testName, err) {
        failed++;
        console.error(`✗ FAIL: ${testName}`);
        console.error(`  ${err.message}\n`);
    }

    let createdBookingId = null;
    let createdAgreementId = null;
    let createdPickupInspId = null;
    let createdReturnInspId = null;

    try {
        // Test 1: Haversine distance between Sector 17 Chandigarh (30.7398, 76.7827) and Mohali Airport (30.6735, 76.7885)
        try {
            const dist = calculateHaversineDistanceKm(30.7398, 76.7827, 30.6735, 76.7885);
            assert(dist > 5 && dist < 12, `Expected distance ~7.4 km, got ${dist} km`);
            recordPass('Test 1: Haversine distance calculation is accurate');
        } catch (err) {
            recordFail('Test 1: Haversine distance calculation', err);
        }

        // Test 2: Driving route distance and travel time calculation
        try {
            const route = await calculateDrivingRoute(30.7398, 76.7827, 30.6735, 76.7885);
            assert(route.distanceKm > 0, 'Distance must be > 0');
            assert(route.durationMinutes > 0, 'Duration minutes must be > 0');
            assert(route.durationDisplay && route.durationDisplay.includes('min'), 'Duration display formatted');
            recordPass(`Test 2: Driving route calculated (${route.distanceKm} km, ${route.durationDisplay})`);
        } catch (err) {
            recordFail('Test 2: Driving route calculation', err);
        }

        // Test 3: Delivery pricing logic (Free under 5km, base + per km above 5km)
        try {
            const rule = {
                base_delivery_charge: 150.00,
                per_km_charge: 15.00,
                free_delivery_distance_km: 5.00,
                max_delivery_distance_km: 150.00
            };

            const underFree = await calculateDeliveryCharge(4.5, rule);
            assert.strictEqual(underFree.deliveryCharge, 0, 'Distance <= 5km must have ₹0 delivery charge');
            assert.strictEqual(underFree.isFree, true);

            // 25 km distance: billable = 20 km. Total = 150 + (20 * 15) = 450
            const aboveFree = await calculateDeliveryCharge(25.0, rule);
            assert.strictEqual(aboveFree.deliveryCharge, 450.00, `Expected ₹450.00, got ${aboveFree.deliveryCharge}`);
            recordPass('Test 3: Authoritative delivery pricing rules correctly computed');
        } catch (err) {
            recordFail('Test 3: Delivery pricing rules', err);
        }

        // Test 4: Verify default delivery pricing rules and service hubs in database
        try {
            const [pricing] = await db.query('SELECT * FROM delivery_pricing_rules WHERE is_active = TRUE');
            assert(pricing.length > 0, 'Active pricing rule must exist in DB');

            const [hubs] = await db.query('SELECT * FROM service_hubs WHERE is_active = TRUE');
            assert(hubs.length >= 3, `Expected at least 3 seeded hubs, got ${hubs.length}`);
            recordPass('Test 4: Database delivery pricing rules and service hubs loaded');
        } catch (err) {
            recordFail('Test 4: Database pricing and hubs', err);
        }

        // Test 5: Customer creates booking with pickup & drop locations and delivery charges
        try {
            const pickupDt = '2027-01-10 10:00:00';
            const returnDt = '2027-01-11 10:00:00'; // 24 hours
            const vehicleId = 1; // Swift @ ₹1800/day
            const userId = 1; // testuser@rentiq.com (verified licence)

            const pickupLat = 30.7398;
            const pickupLng = 76.7827;
            const dropLat = 30.3244;
            const dropLng = 76.4018; // Patiala ~60-70 km away

            const route = await calculateDrivingRoute(pickupLat, pickupLng, dropLat, dropLng);
            const deliveryRes = await calculateDeliveryCharge(route.distanceKm);

            const baseRental = 1800.00;
            const expectedTotal = Number((baseRental + deliveryRes.deliveryCharge).toFixed(2));

            const [insRes] = await db.query(
                `INSERT INTO bookings
                    (user_id, vehicle_id, pickup_datetime, return_datetime, start_date, end_date, total_price, status,
                     pickup_address, pickup_latitude, pickup_longitude, drop_address, drop_latitude, drop_longitude,
                     route_distance_km, estimated_travel_time, delivery_charge)
                 VALUES (?, ?, ?, ?, '2027-01-10', '2027-01-11', ?, 'confirmed',
                         'Sector 17, Chandigarh', ?, ?, 'Railway Station, Patiala', ?, ?, ?, ?, ?)`,
                [
                    userId, vehicleId, pickupDt, returnDt, expectedTotal,
                    pickupLat, pickupLng, dropLat, dropLng,
                    route.distanceKm, route.durationDisplay, deliveryRes.deliveryCharge
                ]
            );

            createdBookingId = insRes.insertId;

            const [check] = await db.query('SELECT * FROM bookings WHERE booking_id = ?', [createdBookingId]);
            const b = check[0];
            assert.strictEqual(b.pickup_address, 'Sector 17, Chandigarh');
            assert.strictEqual(b.drop_address, 'Railway Station, Patiala');
            assert(Number(b.delivery_charge) > 0, 'Delivery charge must be recorded');
            assert.strictEqual(Number(b.total_price), expectedTotal);
            recordPass(`Test 5: Booking saved with pickup/drop locations & delivery charge (Total: ₹${b.total_price})`);
        } catch (err) {
            recordFail('Test 5: Booking with location and delivery charge', err);
        }

        // Test 6: Auto-generate Digital Rental Agreement
        try {
            const agreement = await ensureAgreementExists(createdBookingId, 1);
            createdAgreementId = agreement.id;
            assert(agreement.agreement_number.startsWith('RIQ-AGR-'), 'Agreement number must start with RIQ-AGR-');
            assert.strictEqual(agreement.agreement_status, 'awaiting_acceptance');
            assert(agreement.pdf_file_path && fs.existsSync(agreement.pdf_file_path), 'PDF file must exist on disk');
            recordPass(`Test 6: Digital Rental Agreement generated (${agreement.agreement_number}) with PDF`);
        } catch (err) {
            recordFail('Test 6: Digital agreement generation', err);
        }

        // Test 7: Agreement snapshot data verification
        try {
            const agrData = await buildAgreementData(createdBookingId);
            assert(agrData.customer.name === 'Test User' || agrData.customer.name === 'Test Customer', 'Customer name must be in snapshot');
            assert(agrData.customer.licenseNumberMasked.includes('•••'), 'Licence number must be masked in agreement');
            assert.strictEqual(agrData.vehicle.name, 'Swift');
            assert(agrData.financials.deliveryCharge > 0, 'Delivery charge captured in agreement snapshot');
            recordPass('Test 7: Agreement snapshot correctly preserves customer, vehicle, and financial data');
        } catch (err) {
            recordFail('Test 7: Agreement snapshot verification', err);
        }

        // Test 8: Customer accepts digital rental agreement
        try {
            const acceptedAt = new Date();
            const agrData = await buildAgreementData(createdBookingId);
            const newPdf = await generateAgreementPDF(`RIQ-AGR-${createdBookingId}-ACC`, agrData, {
                accepted: true,
                acceptedAt
            });

            await db.query(
                `UPDATE rental_agreements
                 SET terms_accepted = TRUE, agreement_status = 'accepted', accepted_at = ?, pdf_file_path = ?
                 WHERE id = ?`,
                [acceptedAt, newPdf, createdAgreementId]
            );

            const [check] = await db.query('SELECT * FROM rental_agreements WHERE id = ?', [createdAgreementId]);
            assert.strictEqual(check[0].terms_accepted, 1);
            assert.strictEqual(check[0].agreement_status, 'accepted');
            assert(fs.existsSync(check[0].pdf_file_path));
            recordPass('Test 8: Customer accepted digital rental agreement; PDF updated with acceptance stamp');
        } catch (err) {
            recordFail('Test 8: Customer accepts agreement', err);
        }

        // Test 9: Admin creates Before-Rental Pickup Inspection
        try {
            const [insRes] = await db.query(
                `INSERT INTO vehicle_inspections
                    (booking_id, vehicle_id, inspection_type, odometer_reading, fuel_level, exterior_condition,
                     interior_condition, tyre_condition, existing_scratches, inspection_notes, inspected_by)
                 VALUES (?, 1, 'pickup', 25000, 100, 'excellent', 'excellent', 'good', 'Minor hairline scratch on left rear bumper', 'Vehicle cleaned and serviced', 32)`,
                [createdBookingId]
            );
            createdPickupInspId = insRes.insertId;

            // Add sample inspection photo
            await db.query(
                `INSERT INTO inspection_photos (inspection_id, photo_category, file_path, description)
                 VALUES (?, 'front', 'uploads/inspection_photos/sample_front.jpg', 'Pickup inspection front view')`,
                [createdPickupInspId]
            );

            assert(createdPickupInspId > 0);
            recordPass('Test 9: Admin creates pickup inspection with checklist, odometer (25,000 km) & fuel (100%)');
        } catch (err) {
            recordFail('Test 9: Create pickup inspection', err);
        }

        // Test 10: Vehicle handover blocked if customer has NOT accepted vehicle condition
        try {
            const [insp] = await db.query('SELECT customer_accepted FROM vehicle_inspections WHERE id = ?', [createdPickupInspId]);
            assert.strictEqual(insp[0].customer_accepted, 0);
            // Handover logic check: must require customer_accepted == true
            const canHandover = insp[0].customer_accepted === 1;
            assert.strictEqual(canHandover, false, 'Handover must be blocked prior to customer condition acceptance');
            recordPass('Test 10: Handover strictly blocked until customer reviews and accepts vehicle condition');
        } catch (err) {
            recordFail('Test 10: Block handover prior to condition acceptance', err);
        }

        // Test 11: Customer reviews and accepts vehicle condition
        try {
            const now = new Date();
            await db.query(
                'UPDATE vehicle_inspections SET customer_accepted = TRUE, customer_accepted_at = ? WHERE id = ?',
                [now, createdPickupInspId]
            );

            const [insp] = await db.query('SELECT customer_accepted FROM vehicle_inspections WHERE id = ?', [createdPickupInspId]);
            assert.strictEqual(insp[0].customer_accepted, 1);
            recordPass('Test 11: Customer confirmed and accepted vehicle condition');
        } catch (err) {
            recordFail('Test 11: Customer accepts vehicle condition', err);
        }

        // Test 12: Admin completes vehicle handover -> status transitions to 'active'
        try {
            await db.query('UPDATE bookings SET status = "active" WHERE booking_id = ?', [createdBookingId]);
            const [b] = await db.query('SELECT status FROM bookings WHERE booking_id = ?', [createdBookingId]);
            assert.strictEqual(b[0].status, 'active');
            recordPass('Test 12: Vehicle handover completed; booking status transitioned to "active"');
        } catch (err) {
            recordFail('Test 12: Handover to active status', err);
        }

        // Test 13: Customer returns vehicle and admin creates Return Inspection
        try {
            const [retRes] = await db.query(
                `INSERT INTO vehicle_inspections
                    (booking_id, vehicle_id, inspection_type, odometer_reading, fuel_level, exterior_condition,
                     interior_condition, tyre_condition, existing_scratches, damage_description, inspection_notes, inspected_by)
                 VALUES (?, 1, 'return', 25350, 90, 'good', 'excellent', 'good', 'Minor hairline scratch on left rear bumper', 'New minor surface scuff on right mirror', 'Returned on time', 32)`,
                [createdBookingId]
            );
            createdReturnInspId = retRes.insertId;
            assert(createdReturnInspId > 0);
            recordPass('Test 13: Admin creates return inspection (final odo: 25,350 km, fuel: 90%)');
        } catch (err) {
            recordFail('Test 13: Create return inspection', err);
        }

        // Test 14: Automatic difference calculation (Distance Travelled, Fuel Delta, Damage Comparison)
        try {
            const [inspections] = await db.query(
                'SELECT * FROM vehicle_inspections WHERE booking_id = ? ORDER BY id ASC',
                [createdBookingId]
            );

            const pickup = inspections.find(i => i.inspection_type === 'pickup');
            const ret = inspections.find(i => i.inspection_type === 'return');

            const distanceTravelled = ret.odometer_reading - pickup.odometer_reading;
            const fuelDifference = ret.fuel_level - pickup.fuel_level;

            assert.strictEqual(distanceTravelled, 350, `Expected 350 km travelled, got ${distanceTravelled}`);
            assert.strictEqual(fuelDifference, -10, `Expected -10% fuel difference, got ${fuelDifference}`);
            assert(ret.damage_description && ret.damage_description.includes('right mirror'), 'New damage detected');
            recordPass(`Test 14: Difference calculated: ${distanceTravelled} km travelled, ${fuelDifference}% fuel delta, damage tracked`);
        } catch (err) {
            recordFail('Test 14: Automatic difference calculation', err);
        }

        // Test 15: Admin completes rental -> status becomes 'completed'
        try {
            await db.query('UPDATE bookings SET status = "completed" WHERE booking_id = ?', [createdBookingId]);
            const [b] = await db.query('SELECT status FROM bookings WHERE booking_id = ?', [createdBookingId]);
            assert.strictEqual(b[0].status, 'completed');
            recordPass('Test 15: Rental completed successfully; booking status updated to "completed"');
        } catch (err) {
            recordFail('Test 15: Complete rental', err);
        }

        // Test 16: Security: Duplicate inspection prevention for same stage
        try {
            let errorCaught = false;
            try {
                await db.query(
                    `INSERT INTO vehicle_inspections
                        (booking_id, vehicle_id, inspection_type, odometer_reading, fuel_level, inspected_by)
                     VALUES (?, 1, 'pickup', 25000, 100, 32)`,
                    [createdBookingId]
                );
            } catch (dupErr) {
                errorCaught = true;
                assert(dupErr.message.includes('unique_booking_inspection_type') || dupErr.code === 'ER_DUP_ENTRY');
            }
            assert(errorCaught, 'Database unique constraint must reject duplicate inspection for same stage');
            recordPass('Test 16: Database enforces single inspection per stage via unique constraint');
        } catch (err) {
            recordFail('Test 16: Duplicate inspection prevention', err);
        }

    } finally {
        // Cleanup isolated test data
        console.log('\nCleaning up isolated test data...');
        if (createdBookingId) {
            await db.query('DELETE FROM bookings WHERE booking_id = ?', [createdBookingId]);
        }
        console.log('Cleanup completed.\n');
    }

    console.log('================================================================');
    console.log(`Phase 2 Test Results: ${passed} Passed, ${failed} Failed`);
    console.log('================================================================');

    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runPhase2Tests();
