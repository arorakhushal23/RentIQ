/**
 * RentIQ Phase 3 Comprehensive Test Suite
 *
 * Tests:
 * 1. Vehicle Maintenance Management System (KPIs, Records, Invoices, Conflicts, Reminders, Availability Sync)
 * 2. Smart Pricing and Additional Charges System (Base, Weekend, Seasonal, Discounts, Add-ons, Post-Rental Charges)
 *
 * File: backend/scripts/testPhase3Suite.js
 */

const assert = require('assert');
const db = require('../config/db');
const {
    checkVehicleMaintenanceConflict,
    checkMaintenanceBookingConflict,
    checkMaintenanceOverlap,
    syncVehicleAvailability,
    evaluateMaintenanceReminders,
    getMaintenanceDashboardStats
} = require('../utils/maintenanceHelper');
const {
    calculateAuthoritativePrice,
    saveBookingPriceBreakdown,
    calculatePostRentalCharges,
    saveBookingAdditionalCharges
} = require('../utils/pricingEngine');

async function runPhase3Tests() {
    console.log('================================================================');
    console.log('Starting RentIQ Phase 3: Vehicle Maintenance & Smart Pricing Suite');
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

    let testMaintenanceId = null;
    let testBookingId = null;
    let testPickupInspId = null;
    let testReturnInspId = null;
    let createdRuleId = null;

    try {
        // Test 1: Smart Pricing Engine - Base daily calculation & Weekend Peak Surcharge
        try {
            // Vehicle 1 has price_per_day = 1800.00
            // Pick a weekend interval: Friday 2027-02-12 to Sunday 2027-02-14 (2 rental days, Friday & Saturday nights)
            const pricingRes = await calculateAuthoritativePrice({
                vehicleId: 1,
                pickupDatetime: '2027-02-12 10:00:00',
                returnDatetime: '2027-02-14 10:00:00',
                selectedAddonIds: [],
                deliveryDistanceKm: 0
            });

            assert.strictEqual(pricingRes.rentalDays, 2, 'Rental days should be 2');
            assert.strictEqual(pricingRes.baseRentalPrice, 3600.00, 'Base price 2 days * 1800 = 3600');
            assert(pricingRes.weekendAdjustment > 0, `Weekend surcharge expected (>0), got ${pricingRes.weekendAdjustment}`);
            assert.strictEqual(pricingRes.weekendDaysCount, 2, 'Should match 2 weekend days (Friday, Saturday)');
            assert.strictEqual(pricingRes.finalTotal, Number((3600 + pricingRes.weekendAdjustment).toFixed(2)));
            recordPass(`Test 1: Base pricing & Weekend surcharge applied (+₹${pricingRes.weekendAdjustment})`);
        } catch (err) {
            recordFail('Test 1: Base pricing & Weekend surcharge', err);
        }

        // Test 2: Smart Pricing Engine - Weekly Long Duration Discount (7+ Days, 10% off)
        try {
            // 8 days rental on non-weekend or mixed
            const pricingRes = await calculateAuthoritativePrice({
                vehicleId: 1,
                pickupDatetime: '2027-03-01 10:00:00',
                returnDatetime: '2027-03-09 10:00:00', // 8 days
                selectedAddonIds: [],
                deliveryDistanceKm: 0
            });

            assert.strictEqual(pricingRes.rentalDays, 8);
            const expectedBase = 8 * 1800; // 14400
            assert.strictEqual(pricingRes.baseRentalPrice, expectedBase);
            assert(pricingRes.durationDiscount > 0, `Weekly discount should apply, got ${pricingRes.durationDiscount}`);
            assert(pricingRes.discountRuleName && pricingRes.discountRuleName.includes('Weekly'), 'Weekly discount rule matched');
            recordPass(`Test 2: Weekly rental discount applied (-₹${pricingRes.durationDiscount})`);
        } catch (err) {
            recordFail('Test 2: Weekly rental discount', err);
        }

        // Test 3: Smart Pricing Engine - Seasonal Holiday Peak (+20% in Winter Peak)
        try {
            // Seeded season is 2026-12-15 to 2027-01-05
            const pricingRes = await calculateAuthoritativePrice({
                vehicleId: 1,
                pickupDatetime: '2026-12-20 10:00:00',
                returnDatetime: '2026-12-22 10:00:00', // 2 days
                selectedAddonIds: [],
                deliveryDistanceKm: 0
            });

            assert.strictEqual(pricingRes.rentalDays, 2);
            assert(pricingRes.seasonalAdjustment > 0, `Seasonal adjustment should be > 0, got ${pricingRes.seasonalAdjustment}`);
            assert(pricingRes.seasonName && pricingRes.seasonName.includes('Winter'), 'Matched Winter Peak season');
            recordPass(`Test 3: Seasonal peak surcharge applied (+₹${pricingRes.seasonalAdjustment} for ${pricingRes.seasonName})`);
        } catch (err) {
            recordFail('Test 3: Seasonal holiday peak', err);
        }

        // Test 4: Smart Pricing Engine - Selected Add-on Accessories (GPS + Child Seat)
        try {
            // Rule 5: GPS (150/d), Rule 6: Child Seat (200/d)
            const pricingRes = await calculateAuthoritativePrice({
                vehicleId: 1,
                pickupDatetime: '2027-04-10 10:00:00',
                returnDatetime: '2027-04-12 10:00:00', // 2 days
                selectedAddonIds: [5, 6],
                deliveryDistanceKm: 10
            });

            assert.strictEqual(pricingRes.appliedAddons.length, 2, 'Should attach 2 addons');
            const expectedAddons = (150 * 2) + (200 * 2); // 700
            assert.strictEqual(pricingRes.addonsTotal, expectedAddons, `Expected addon total ₹${expectedAddons}, got ${pricingRes.addonsTotal}`);
            assert(pricingRes.deliveryCharge > 0, 'Delivery charge for 10 km should be added');
            recordPass(`Test 4: Add-ons (GPS + Child Seat = ₹${pricingRes.addonsTotal}) & delivery calculated`);
        } catch (err) {
            recordFail('Test 4: Add-on accessories & delivery', err);
        }

        // Test 5: Vehicle Maintenance - Create record for Vehicle 2
        try {
            const [veh] = await db.query('SELECT vehicle_id, is_available FROM vehicles WHERE vehicle_id = 2');
            assert(veh.length > 0, 'Vehicle 2 must exist');

            const [maintRes] = await db.query(
                `INSERT INTO vehicle_maintenance
                    (vehicle_id, maintenance_category, service_date, start_date, end_date,
                     odometer_reading, service_center, description, parts_replaced, cost,
                     next_service_date, next_service_odometer, status, created_by)
                 VALUES (2, 'brake_servicing', '2027-05-01', '2027-05-01', '2027-05-03',
                         35200, 'RentIQ Central Workshop', 'Full front disc brake pad replacement & fluid bleed',
                         'Brake Pads, Dot 4 Brake Fluid', 4200.00,
                         '2027-11-01', 45000, 'in_progress', 1)`
            );

            testMaintenanceId = maintRes.insertId;
            assert(testMaintenanceId > 0, 'Maintenance record created');
            recordPass(`Test 5: Maintenance record created (#${testMaintenanceId} - brake_servicing)`);
        } catch (err) {
            recordFail('Test 5: Create maintenance record', err);
        }

        // Test 6: Vehicle Availability Synchronization - 'in_progress' sets is_available = 0
        try {
            const syncRes = await syncVehicleAvailability(2);
            assert.strictEqual(syncRes.available, false, 'Vehicle should be unavailable while maintenance is in progress');

            const [checkVeh] = await db.query('SELECT is_available FROM vehicles WHERE vehicle_id = 2');
            assert.strictEqual(checkVeh[0].is_available, 0, 'Database is_available column must be 0 (false)');
            recordPass('Test 6: Vehicle availability synced to unavailable (0) during active maintenance');
        } catch (err) {
            recordFail('Test 6: Availability sync (under maintenance)', err);
        }

        // Test 7: Booking Conflict Validation - Customer booking blocked during maintenance
        try {
            const conflict = await checkVehicleMaintenanceConflict(2, '2027-05-02 10:00:00', '2027-05-04 10:00:00');
            assert.strictEqual(conflict.hasConflict, true, 'Maintenance conflict must be detected');
            assert(conflict.message && conflict.message.includes('brake_servicing'), 'Conflict message mentions category');
            recordPass(`Test 7: Booking conflict correctly blocked during maintenance period`);
        } catch (err) {
            recordFail('Test 7: Booking conflict check', err);
        }

        // Test 8: Maintenance Overlap Prevention
        try {
            const overlap = await checkMaintenanceOverlap(2, '2027-05-02', '2027-05-05');
            assert.strictEqual(overlap.hasConflict, true, 'Overlap must be detected');
            assert(overlap.message.includes('overlapping'), 'Overlap message confirmed');
            recordPass('Test 8: Prevented overlapping maintenance periods for the same vehicle');
        } catch (err) {
            recordFail('Test 8: Maintenance overlap prevention', err);
        }

        // Test 9: Maintenance Booking Conflict Prevention
        try {
            // Check vehicle 1 where there is an existing booking around 2026-09-01
            const bConflict = await checkMaintenanceBookingConflict(1, '2026-08-30', '2026-09-05');
            assert(bConflict.count > 0, 'Should detect existing customer bookings during proposed maintenance');
            recordPass(`Test 9: Guarded existing customer bookings against conflicting maintenance (${bConflict.count} booking detected)`);
        } catch (err) {
            recordFail('Test 9: Maintenance booking conflict check', err);
        }

        // Test 10: Vehicle Availability Restoration - Completing maintenance restores availability
        try {
            await db.query("UPDATE vehicle_maintenance SET status = 'completed' WHERE id = ?", [testMaintenanceId]);
            const syncRes = await syncVehicleAvailability(2);
            assert.strictEqual(syncRes.available, true, 'Vehicle should be restored to available when maintenance completes');

            const [checkVeh] = await db.query('SELECT is_available FROM vehicles WHERE vehicle_id = 2');
            assert.strictEqual(checkVeh[0].is_available, 1, 'Database is_available column restored to 1');
            recordPass('Test 10: Vehicle availability restored to available (1) upon maintenance completion');
        } catch (err) {
            recordFail('Test 10: Availability restoration', err);
        }

        // Test 11: Vehicle Maintenance Dashboard Stats Aggregation
        try {
            const stats = await getMaintenanceDashboardStats();
            assert(stats.totalVehicles > 0, 'Total vehicles must be > 0');
            assert(stats.totalMaintenanceExpenses >= 4200, `Expenses should include test record (>=4200), got ${stats.totalMaintenanceExpenses}`);
            assert(Array.isArray(stats.recentActivities), 'recentActivities is array');
            assert(stats.recentActivities.length > 0, 'recentActivities has records');
            recordPass(`Test 11: Dashboard KPIs aggregated (Total vehicles: ${stats.totalVehicles}, Expense: ₹${stats.totalMaintenanceExpenses})`);
        } catch (err) {
            recordFail('Test 11: Dashboard KPIs aggregation', err);
        }

        // Test 12: Automated Maintenance Reminders Evaluation
        try {
            // The completed record had next_service_date = 2027-11-01 and next_service_odometer = 45000
            // Let's insert a test record with overdue date to test overdue reminder generation
            await db.query(
                `INSERT INTO vehicle_maintenance
                    (vehicle_id, maintenance_category, service_date, start_date, odometer_reading,
                     service_center, description, cost, next_service_date, status)
                 VALUES (2, 'oil_change', '2026-08-01', '2026-08-01', 30000,
                         'Quick Lube', 'Engine oil change', 1500, '2026-10-01', 'completed')`
            );

            await evaluateMaintenanceReminders();

            const [reminders] = await db.query(
                "SELECT * FROM maintenance_reminders WHERE vehicle_id = 2 AND reminder_type = 'overdue'"
            );
            assert(reminders.length > 0, 'Overdue maintenance reminder should be generated');
            recordPass(`Test 12: Automated maintenance reminder created (${reminders[0].title})`);
        } catch (err) {
            recordFail('Test 12: Maintenance reminder evaluation', err);
        }

        // Test 13: Maintenance Reminder Status Update (Mark completed or rescheduled)
        try {
            const [reminders] = await db.query('SELECT id FROM maintenance_reminders WHERE vehicle_id = 2 LIMIT 1');
            assert(reminders.length > 0);
            const remId = reminders[0].id;

            await db.query("UPDATE maintenance_reminders SET status = 'completed' WHERE id = ?", [remId]);
            const [updated] = await db.query('SELECT status FROM maintenance_reminders WHERE id = ?', [remId]);
            assert.strictEqual(updated[0].status, 'completed');
            recordPass(`Test 13: Maintenance reminder marked completed (#${remId})`);
        } catch (err) {
            recordFail('Test 13: Reminder update', err);
        }

        // Test 14: Booking Price Breakdown Snapshot Persistence
        try {
            const pickupDt = '2027-06-04 10:00:00'; // Friday
            const returnDt = '2027-06-06 10:00:00'; // Sunday (2 days, weekend peak)
            const vehicleId = 1;
            const userId = 1;

            const breakdown = await calculateAuthoritativePrice({
                vehicleId,
                pickupDatetime: pickupDt,
                returnDatetime: returnDt,
                selectedAddonIds: [5], // GPS
                deliveryDistanceKm: 15
            });

            const [bkRes] = await db.query(
                `INSERT INTO bookings
                    (user_id, vehicle_id, pickup_datetime, return_datetime, start_date, end_date,
                     total_price, status, pickup_address, drop_address, route_distance_km, delivery_charge)
                 VALUES (?, ?, ?, ?, '2027-06-04', '2027-06-06', ?, 'confirmed',
                         'Sector 17, Chandigarh', 'Zirakpur, Punjab', 15.0, ?)`,
                [userId, vehicleId, pickupDt, returnDt, breakdown.finalTotal, breakdown.deliveryCharge]
            );

            testBookingId = bkRes.insertId;
            await saveBookingPriceBreakdown(testBookingId, breakdown);

            const [checkBk] = await db.query('SELECT * FROM booking_price_breakdown WHERE booking_id = ?', [testBookingId]);
            assert.strictEqual(checkBk.length, 1);
            const stored = checkBk[0];
            assert.strictEqual(Number(stored.base_price), breakdown.baseRentalPrice);
            assert.strictEqual(Number(stored.final_total), breakdown.finalTotal);
            assert.strictEqual(Number(stored.addons_total), breakdown.addonsTotal);
            recordPass(`Test 14: Immutable booking price breakdown snapshot saved (Booking #${testBookingId}, Total: ₹${stored.final_total})`);
        } catch (err) {
            recordFail('Test 14: Price breakdown persistence', err);
        }

        // Test 15: Post-Rental Additional Charges (Late Return, Excess Km, Fuel Deficit)
        try {
            // Create Pickup Inspection: Odometer 20,000 km, Fuel 90%
            const [pInsp] = await db.query(
                `INSERT INTO vehicle_inspections
                    (booking_id, vehicle_id, inspection_type, odometer_reading, fuel_level, exterior_condition, inspected_by)
                 VALUES (?, 1, 'pickup', 20000, 90, 'good', 1)`,
                [testBookingId]
            );
            testPickupInspId = pInsp.insertId;

            // Create Return Inspection: Odometer 20,600 km (allowed 2 days * 250 = 500 km -> 100 excess km), Fuel 75% (15% deficit)
            // Returned 3 hours late
            const actualReturnTime = new Date('2027-06-06 13:00:00'); // 3 hours past 10:00:00 scheduled return
            const [rInsp] = await db.query(
                `INSERT INTO vehicle_inspections
                    (booking_id, vehicle_id, inspection_type, odometer_reading, fuel_level, exterior_condition, inspected_by, created_at)
                 VALUES (?, 1, 'return', 20600, 75, 'good', 1, ?)`,
                [testBookingId, actualReturnTime]
            );
            testReturnInspId = rInsp.insertId;

            const postCharges = await calculatePostRentalCharges(testBookingId);
            assert(postCharges.itemizedCharges.length >= 2, 'Should calculate late return, excess km, and fuel charges');

            const lateCharge = postCharges.itemizedCharges.find(c => c.chargeType === 'late_return');
            const excessKmCharge = postCharges.itemizedCharges.find(c => c.chargeType === 'excess_km');
            const fuelCharge = postCharges.itemizedCharges.find(c => c.chargeType === 'fuel_refill');

            assert(lateCharge && lateCharge.totalCharge > 0, 'Late return fee calculated');
            assert(excessKmCharge && excessKmCharge.totalCharge === 1200, `Excess km fee should be 100km * ₹12 = ₹1200, got ₹${excessKmCharge ? excessKmCharge.totalCharge : 0}`);
            assert(fuelCharge && fuelCharge.totalCharge === 225, `Fuel deficit fee should be 15% * ₹15 = ₹225, got ₹${fuelCharge ? fuelCharge.totalCharge : 0}`);

            await saveBookingAdditionalCharges(testBookingId, postCharges.itemizedCharges);

            const [checkPost] = await db.query('SELECT * FROM booking_additional_charges WHERE booking_id = ?', [testBookingId]);
            assert.strictEqual(checkPost.length, postCharges.itemizedCharges.length);
            recordPass(`Test 15: Post-rental charges evaluated & itemized (Late: ₹${lateCharge.totalCharge}, Excess Km: ₹${excessKmCharge.totalCharge}, Fuel: ₹${fuelCharge.totalCharge})`);
        } catch (err) {
            recordFail('Test 15: Post-rental additional charges', err);
        }

        // Test 16: Pricing Rule Management (Admin CRUD & Toggle)
        try {
            const [newRule] = await db.query(
                `INSERT INTO pricing_rules (rule_name, rule_type, adjustment_type, adjustment_value, priority, is_active)
                 VALUES ('Festive Weekend Flash Sale', 'weekend', 'percentage', 10.00, 5, TRUE)`
            );
            createdRuleId = newRule.insertId;

            // Toggle
            await db.query('UPDATE pricing_rules SET is_active = NOT is_active WHERE id = ?', [createdRuleId]);
            const [toggled] = await db.query('SELECT is_active FROM pricing_rules WHERE id = ?', [createdRuleId]);
            assert.strictEqual(toggled[0].is_active, 0, 'Rule should be inactive after toggle');

            // Clean up test rule
            await db.query('DELETE FROM pricing_rules WHERE id = ?', [createdRuleId]);
            recordPass('Test 16: Pricing rules administrative management and status toggling');
        } catch (err) {
            recordFail('Test 16: Pricing rule management', err);
        }

    } finally {
        // Clean up test artifacts
        if (testBookingId) {
            try {
                await db.query('DELETE FROM bookings WHERE booking_id = ?', [testBookingId]);
            } catch (_) {}
        }
        if (testMaintenanceId) {
            try {
                await db.query('DELETE FROM vehicle_maintenance WHERE id = ?', [testMaintenanceId]);
            } catch (_) {}
        }
        await db.end();
    }

    console.log('\n================================================================');
    console.log(`Phase 3 Test Results: ${passed} Passed, ${failed} Failed`);
    console.log('================================================================');

    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runPhase3Tests();
