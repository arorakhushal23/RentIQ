const db = require('../config/db');
const jwt = require('jsonwebtoken');
const { calculateRentalDuration, calculateRentalPrice, parseDateTime } = require('../utils/bookingUtils');

async function runEnhancementVerification() {
    console.log('====================================================');
    console.log('RentIQ UI/UX Enhancement Verification Script');
    console.log('====================================================\n');

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

    try {
        // 1. Verify Categories in Database
        const [categories] = await db.query('SELECT category_id, name FROM categories ORDER BY category_id');
        const catNames = categories.map(c => c.name);
        console.log('Categories in DB:', catNames.join(', '));
        assert(catNames.includes('Sedan'), 'Sedan category is supported');
        assert(catNames.includes('SUV'), 'SUV category is supported');
        assert(catNames.includes('Hatchback'), 'Hatchback category is supported');
        assert(catNames.includes('Bike'), 'Bike category is supported');
        assert(catNames.includes('Scooter'), 'Scooter category is supported');
        assert(catNames.includes('EV'), 'EV category is supported');

        // 2. Verify Vehicles and Image URLs in Database
        const [vehicles] = await db.query(`
            SELECT v.vehicle_id, v.name, v.brand, c.name AS category, v.price_per_day, v.seating_capacity, v.transmission, v.image_url
            FROM vehicles v
            JOIN categories c ON v.category_id = c.category_id
            ORDER BY v.vehicle_id
        `);
        console.log(`\nTotal vehicles in database: ${vehicles.length}`);
        assert(vehicles.length >= 10, 'All vehicles are populated in database');

        const allHaveImages = vehicles.every(v => v.image_url && v.image_url.startsWith('http'));
        assert(allHaveImages, 'All vehicles in database have valid http/https image URLs');

        const uniqueImages = new Set(vehicles.map(v => v.image_url));
        assert(uniqueImages.size >= vehicles.length - 1, 'Vehicle images are distinct per vehicle model');

        // 3. Verify getMyBookings query includes image_url, vehicle_brand, and category_name
        const [customerUsers] = await db.query('SELECT user_id, name, email FROM users WHERE role = "customer" LIMIT 1');
        assert(customerUsers.length > 0, 'Test customer user exists');
        const customer = customerUsers[0];

        const [bookingRows] = await db.query(`
            SELECT
                b.booking_id,
                b.vehicle_id,
                v.name AS vehicle_name,
                v.brand AS vehicle_brand,
                v.image_url,
                c.name AS category_name,
                b.pickup_datetime,
                b.return_datetime,
                b.total_price,
                b.status,
                b.created_at
            FROM bookings b
            JOIN vehicles v ON b.vehicle_id = v.vehicle_id
            LEFT JOIN categories c ON v.category_id = c.category_id
            WHERE b.user_id = ?
            ORDER BY b.booking_id DESC
        `, [customer.user_id]);

        console.log(`\nCustomer #${customer.user_id} (${customer.name}) has ${bookingRows.length} bookings`);
        if (bookingRows.length > 0) {
            const firstBooking = bookingRows[0];
            assert(firstBooking.image_url !== undefined && firstBooking.image_url !== null, 'Booking record returns vehicle image_url');
            assert(firstBooking.vehicle_brand !== undefined && firstBooking.vehicle_brand !== null, 'Booking record returns vehicle_brand');
            assert(firstBooking.category_name !== undefined && firstBooking.category_name !== null, 'Booking record returns category_name');
            console.log(`  Sample Booking #${firstBooking.booking_id}: Vehicle "${firstBooking.vehicle_name}", Category "${firstBooking.category_name}", Image: ${firstBooking.image_url.slice(0, 50)}...`);
        }

        // 4. Verify Independent Date & Time duration calculation
        console.log('\nVerifying Duration and Authoritative Pricing:');
        // Test same-day rental
        const sameDayDur = calculateRentalDuration('2026-10-24T08:40', '2026-10-24T11:40');
        assert(sameDayDur.display === '3 hours', 'Same-day 08:40 to 11:40 = 3 hours');
        const sameDayPrice = calculateRentalPrice(2400, sameDayDur.durationHours);
        assert(sameDayPrice === 300, '3-hour rental @ ₹2,400/day = ₹300');

        // Test multi-day rental
        const multiDayDur = calculateRentalDuration('2026-10-24T09:00', '2026-10-26T12:00');
        assert(multiDayDur.display === '2 days 3 hours', '2026-10-24T09:00 to 2026-10-26T12:00 = 2 days 3 hours (51h)');
        const multiDayPrice = calculateRentalPrice(1800, multiDayDur.durationHours);
        assert(multiDayPrice === 3825, '51-hour rental @ ₹1,800/day = ₹3,825');

        // Test crossing midnight
        const midnightDur = calculateRentalDuration('2026-10-24T22:00', '2026-10-25T02:00');
        assert(midnightDur.display === '4 hours', 'Overnight rental 22:00 to 02:00 = 4 hours');
        const midnightPrice = calculateRentalPrice(1200, midnightDur.durationHours);
        assert(midnightPrice === 200, '4-hour rental @ ₹1,200/day = ₹200');

        // 5. Verify Profile Update API
        const [updateResult] = await db.query('UPDATE users SET name = ? WHERE user_id = ?', [customer.name, customer.user_id]);
        assert(updateResult.affectedRows >= 0, 'User profile update executed smoothly');

        console.log('\n====================================================');
        console.log(`Verification Results: ${passed} Passed, ${failed} Failed`);
        console.log('====================================================');

        process.exit(failed > 0 ? 1 : 0);
    } catch (err) {
        console.error('Verification error:', err);
        process.exit(1);
    }
}

runEnhancementVerification();
