/**
 * RentIQ Comprehensive Booking Test Suite
 *
 * Runs all 16 test cases specified in the project requirements:
 * 1. A 2-hour rental
 * 2. A 3-hour rental
 * 3. A 24-hour rental
 * 4. A 48-hour rental
 * 5. A booking crossing midnight
 * 6. A return datetime before pickup
 * 7. A pickup time in the past
 * 8. A booking that overlaps an existing active reservation
 * 9. Adjacent reservations that do not overlap
 * 10. Cancelled and completed bookings not blocking availability
 * 11. Two concurrent overlapping booking requests
 * 12. Same-user duplicate submissions
 * 13. Correct authoritative backend pricing and currency rounding
 * 14. Existing booking records surviving migration
 * 15. Booking cancellation and admin status workflows
 * 16. Correct display of times in My Bookings and Admin Bookings
 */

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env') })
const jwt = require('jsonwebtoken')
const db = require('../config/db')
const {
    createBooking,
    getMyBookings,
    cancelBooking
} = require('../controllers/bookingController')
const {
    getAllBookings,
    getBookingById,
    updateBookingStatus
} = require('../controllers/adminBookingController')

// Track created test booking IDs for complete cleanup
const createdBookingIds = []

// Helper to mock express req/res
function mockReqRes({ body = {}, params = {}, query = {}, user = null }) {
    const req = { body, params, query, user, headers: {}, header: () => null }
    const res = {
        statusCode: 200,
        data: null,
        status(code) {
            this.statusCode = code
            return this
        },
        json(payload) {
            this.data = payload
            return this
        }
    }
    return { req, res }
}

async function runTestSuite() {
    console.log('====================================================')
    console.log('Starting RentIQ Datetime Booking Test Suite (16 Cases)')
    console.log('====================================================\n')

    // Find test user and test admin
    const [users] = await db.query('SELECT user_id, role, email FROM users')
    const customerUser = users.find(u => u.role === 'customer') || { user_id: 2 }
    const secondCustomer = users.filter(u => u.role === 'customer')[1] || { user_id: 11 }
    const adminUser = users.find(u => u.role === 'admin') || { user_id: 12 }

    // Pick vehicle 1 (Swift, price_per_day = 1800.00)
    const [vehicles] = await db.query('SELECT * FROM vehicles WHERE vehicle_id = 1')
    const vehicle = vehicles[0]
    console.log(`Using Vehicle: #${vehicle.vehicle_id} ${vehicle.name} (${vehicle.brand}) @ ₹${vehicle.price_per_day}/day`)

    // We use future dates far in the future to avoid any collision with existing real bookings
    // Base future date: 2027-05-10
    const baseDate = '2027-05-10'

    let passedCount = 0
    let failedCount = 0

    async function assertTest(name, fn) {
        try {
            await fn()
            console.log(`✓ PASS: ${name}`)
            passedCount++
        } catch (err) {
            console.error(`✗ FAIL: ${name}`)
            console.error(`  Error: ${err.message}`)
            failedCount++
        }
    }

    try {
        // Test 1: A 2-hour rental
        await assertTest('Test 1: A 2-hour rental (₹1,800/day costs ₹150)', async () => {
            const { req, res } = mockReqRes({
                user: customerUser,
                body: {
                    vehicleId: vehicle.vehicle_id,
                    pickupDatetime: `${baseDate} 10:00:00`,
                    returnDatetime: `${baseDate} 12:00:00`
                }
            })
            await createBooking(req, res)
            if (res.statusCode !== 201) throw new Error(`Status ${res.statusCode}: ${res.data?.message}`)
            const b = res.data.booking
            createdBookingIds.push(b.bookingId)
            if (Number(b.totalPrice) !== 150) throw new Error(`Expected price 150, got ${b.totalPrice}`)
            if (b.duration !== '2 hours') throw new Error(`Expected duration '2 hours', got '${b.duration}'`)
        })

        // Test 2: A 3-hour rental
        await assertTest('Test 2: A 3-hour rental (₹1,800/day costs ₹225)', async () => {
            const { req, res } = mockReqRes({
                user: customerUser,
                body: {
                    vehicleId: vehicle.vehicle_id,
                    pickupDatetime: `${baseDate} 13:00:00`,
                    returnDatetime: `${baseDate} 16:00:00`
                }
            })
            await createBooking(req, res)
            if (res.statusCode !== 201) throw new Error(`Status ${res.statusCode}: ${res.data?.message}`)
            const b = res.data.booking
            createdBookingIds.push(b.bookingId)
            if (Number(b.totalPrice) !== 225) throw new Error(`Expected price 225, got ${b.totalPrice}`)
            if (b.duration !== '3 hours') throw new Error(`Expected duration '3 hours', got '${b.duration}'`)
        })

        // Test 3: A 24-hour rental
        await assertTest('Test 3: A 24-hour rental (₹1,800/day costs ₹1,800)', async () => {
            const { req, res } = mockReqRes({
                user: customerUser,
                body: {
                    vehicleId: vehicle.vehicle_id,
                    pickupDatetime: `2027-05-12 10:00:00`,
                    returnDatetime: `2027-05-13 10:00:00`
                }
            })
            await createBooking(req, res)
            if (res.statusCode !== 201) throw new Error(`Status ${res.statusCode}: ${res.data?.message}`)
            const b = res.data.booking
            createdBookingIds.push(b.bookingId)
            if (Number(b.totalPrice) !== 1800) throw new Error(`Expected price 1800, got ${b.totalPrice}`)
            if (b.duration !== '1 day') throw new Error(`Expected duration '1 day', got '${b.duration}'`)
        })

        // Test 4: A 48-hour rental
        await assertTest('Test 4: A 48-hour rental (₹1,800/day costs ₹3,600)', async () => {
            const { req, res } = mockReqRes({
                user: customerUser,
                body: {
                    vehicleId: vehicle.vehicle_id,
                    pickupDatetime: `2027-05-14 10:00:00`,
                    returnDatetime: `2027-05-16 10:00:00`
                }
            })
            await createBooking(req, res)
            if (res.statusCode !== 201) throw new Error(`Status ${res.statusCode}: ${res.data?.message}`)
            const b = res.data.booking
            createdBookingIds.push(b.bookingId)
            if (Number(b.totalPrice) !== 3600) throw new Error(`Expected price 3600, got ${b.totalPrice}`)
            if (b.duration !== '2 days') throw new Error(`Expected duration '2 days', got '${b.duration}'`)
        })

        // Test 5: A booking crossing midnight
        await assertTest('Test 5: A booking crossing midnight (22:00 to 04:00 = 6 hours)', async () => {
            const { req, res } = mockReqRes({
                user: customerUser,
                body: {
                    vehicleId: vehicle.vehicle_id,
                    pickupDatetime: `2027-05-17 22:00:00`,
                    returnDatetime: `2027-05-18 04:00:00`
                }
            })
            await createBooking(req, res)
            if (res.statusCode !== 201) throw new Error(`Status ${res.statusCode}: ${res.data?.message}`)
            const b = res.data.booking
            createdBookingIds.push(b.bookingId)
            if (Number(b.totalPrice) !== 450) throw new Error(`Expected price 450, got ${b.totalPrice}`)
            if (b.duration !== '6 hours') throw new Error(`Expected duration '6 hours', got '${b.duration}'`)
        })

        // Test 6: A return datetime before pickup
        await assertTest('Test 6: A return datetime before pickup is rejected with HTTP 400', async () => {
            const { req, res } = mockReqRes({
                user: customerUser,
                body: {
                    vehicleId: vehicle.vehicle_id,
                    pickupDatetime: `2027-05-19 14:00:00`,
                    returnDatetime: `2027-05-19 12:00:00`
                }
            })
            await createBooking(req, res)
            if (res.statusCode !== 400) throw new Error(`Expected status 400, got ${res.statusCode}`)
        })

        // Test 7: A pickup time in the past
        await assertTest('Test 7: A pickup time in the past is rejected with HTTP 400', async () => {
            const { req, res } = mockReqRes({
                user: customerUser,
                body: {
                    vehicleId: vehicle.vehicle_id,
                    pickupDatetime: `2021-01-01 10:00:00`,
                    returnDatetime: `2021-01-01 12:00:00`
                }
            })
            await createBooking(req, res)
            if (res.statusCode !== 400) throw new Error(`Expected status 400, got ${res.statusCode}`)
        })

        // Test 8: A booking that overlaps an existing active reservation
        await assertTest('Test 8: A booking that overlaps an active reservation is rejected with HTTP 409', async () => {
            // Create active reservation: 2027-05-20 10:00 to 14:00
            const { req: r1, res: res1 } = mockReqRes({
                user: customerUser,
                body: {
                    vehicleId: vehicle.vehicle_id,
                    pickupDatetime: `2027-05-20 10:00:00`,
                    returnDatetime: `2027-05-20 14:00:00`
                }
            })
            await createBooking(r1, res1)
            if (res1.statusCode !== 201) throw new Error(`Setup failed: ${res1.data?.message}`)
            createdBookingIds.push(res1.data.booking.bookingId)

            // Overlapping attempt: 2027-05-20 12:00 to 16:00
            const { req: r2, res: res2 } = mockReqRes({
                user: secondCustomer,
                body: {
                    vehicleId: vehicle.vehicle_id,
                    pickupDatetime: `2027-05-20 12:00:00`,
                    returnDatetime: `2027-05-20 16:00:00`
                }
            })
            await createBooking(r2, res2)
            if (res2.statusCode !== 409) throw new Error(`Expected status 409, got ${res2.statusCode}`)
        })

        // Test 9: Adjacent reservations that do not overlap
        await assertTest('Test 9: Adjacent reservations (end time == next start time) are allowed', async () => {
            // First reservation: 2027-05-21 10:00 to 12:00
            const { req: r1, res: res1 } = mockReqRes({
                user: customerUser,
                body: {
                    vehicleId: vehicle.vehicle_id,
                    pickupDatetime: `2027-05-21 10:00:00`,
                    returnDatetime: `2027-05-21 12:00:00`
                }
            })
            await createBooking(r1, res1)
            if (res1.statusCode !== 201) throw new Error(`Booking 1 failed: ${res1.data?.message}`)
            createdBookingIds.push(res1.data.booking.bookingId)

            // Adjacent reservation: starts exactly at 12:00 to 14:00
            const { req: r2, res: res2 } = mockReqRes({
                user: secondCustomer,
                body: {
                    vehicleId: vehicle.vehicle_id,
                    pickupDatetime: `2027-05-21 12:00:00`,
                    returnDatetime: `2027-05-21 14:00:00`
                }
            })
            await createBooking(r2, res2)
            if (res2.statusCode !== 201) throw new Error(`Adjacent booking failed: ${res2.data?.message}`)
            createdBookingIds.push(res2.data.booking.bookingId)
        })

        // Test 10: Cancelled and completed bookings not blocking availability
        await assertTest('Test 10: Cancelled and completed bookings do not block availability', async () => {
            // Create a booking: 2027-05-22 10:00 to 14:00
            const { req: r1, res: res1 } = mockReqRes({
                user: customerUser,
                body: {
                    vehicleId: vehicle.vehicle_id,
                    pickupDatetime: `2027-05-22 10:00:00`,
                    returnDatetime: `2027-05-22 14:00:00`
                }
            })
            await createBooking(r1, res1)
            const id1 = res1.data.booking.bookingId
            createdBookingIds.push(id1)

            // Cancel it
            const { req: rCancel, res: resCancel } = mockReqRes({
                user: customerUser,
                params: { id: id1 }
            })
            await cancelBooking(rCancel, resCancel)
            if (resCancel.statusCode !== 200) throw new Error(`Cancellation failed: ${resCancel.data?.message}`)

            // Now book the exact same slot again: should succeed
            const { req: r2, res: res2 } = mockReqRes({
                user: secondCustomer,
                body: {
                    vehicleId: vehicle.vehicle_id,
                    pickupDatetime: `2027-05-22 10:00:00`,
                    returnDatetime: `2027-05-22 14:00:00`
                }
            })
            await createBooking(r2, res2)
            if (res2.statusCode !== 201) throw new Error(`Booking over cancelled slot failed: ${res2.data?.message}`)
            createdBookingIds.push(res2.data.booking.bookingId)
        })

        // Test 11: Two concurrent overlapping booking requests
        await assertTest('Test 11: Two concurrent overlapping requests serialize via row locking', async () => {
            const slot = {
                pickupDatetime: `2027-05-23 10:00:00`,
                returnDatetime: `2027-05-23 13:00:00`
            }

            const { req: rA, res: resA } = mockReqRes({
                user: customerUser,
                body: { vehicleId: vehicle.vehicle_id, ...slot }
            })
            const { req: rB, res: resB } = mockReqRes({
                user: secondCustomer,
                body: { vehicleId: vehicle.vehicle_id, ...slot }
            })

            // Fire simultaneously
            await Promise.all([createBooking(rA, resA), createBooking(rB, resB)])

            const statuses = [resA.statusCode, resB.statusCode]
            const has201 = statuses.includes(201)
            const has409 = statuses.includes(409)

            if (!has201 || !has409) {
                throw new Error(`Expected exactly one 201 and one 409, got statuses: [${statuses.join(', ')}]`)
            }

            if (resA.statusCode === 201) createdBookingIds.push(resA.data.booking.bookingId)
            if (resB.statusCode === 201) createdBookingIds.push(resB.data.booking.bookingId)
        })

        // Test 12: Same-user duplicate submissions
        await assertTest('Test 12: Same-user duplicate submission for exact same slot is rejected with 409', async () => {
            const slot = {
                vehicleId: vehicle.vehicle_id,
                pickupDatetime: `2027-05-24 10:00:00`,
                returnDatetime: `2027-05-24 13:00:00`
            }
            const { req: r1, res: res1 } = mockReqRes({ user: customerUser, body: slot })
            await createBooking(r1, res1)
            if (res1.statusCode !== 201) throw new Error(`Setup failed: ${res1.data?.message}`)
            createdBookingIds.push(res1.data.booking.bookingId)

            // Exact same request from same user
            const { req: r2, res: res2 } = mockReqRes({ user: customerUser, body: slot })
            await createBooking(r2, res2)
            if (res2.statusCode !== 409) throw new Error(`Expected status 409 duplicate, got ${res2.statusCode}`)
        })

        // Test 13: Correct authoritative backend pricing and currency rounding
        await assertTest('Test 13: Client-submitted price is ignored; backend authoritative pricing and rounding enforced', async () => {
            // Vehicle price is ₹1,800/day. Hourly rate = ₹75.
            // Duration: 2.5 hours (150 mins) from 10:00 to 12:30 -> 2.5 * 75 = 187.5
            const { req, res } = mockReqRes({
                user: customerUser,
                body: {
                    vehicleId: vehicle.vehicle_id,
                    pickupDatetime: `2027-05-25 10:00:00`,
                    returnDatetime: `2027-05-25 12:30:00`,
                    totalPrice: 1.00 // Spoofed client total price
                }
            })
            await createBooking(req, res)
            if (res.statusCode !== 201) throw new Error(`Booking failed: ${res.data?.message}`)
            const b = res.data.booking
            createdBookingIds.push(b.bookingId)
            if (Number(b.totalPrice) !== 187.50) throw new Error(`Expected authoritative price 187.50, got ${b.totalPrice}`)
        })

        // Test 14: Existing booking records surviving migration
        await assertTest('Test 14: Existing booking records survived migration with intact IDs and datetimes', async () => {
            const [rows] = await db.query('SELECT booking_id, pickup_datetime, return_datetime, total_price, status FROM bookings WHERE booking_id IN (1, 2, 3)')
            if (rows.length < 3) throw new Error(`Expected original bookings 1, 2, 3 to exist, found ${rows.length}`)
            for (const r of rows) {
                if (!r.pickup_datetime || !r.return_datetime) {
                    throw new Error(`Booking #${r.booking_id} missing pickup_datetime or return_datetime`)
                }
            }
        })

        // Test 15: Booking cancellation and admin status workflows
        await assertTest('Test 15: Customer cancellation and admin status workflow transitions', async () => {
            // Customer creates booking
            const { req: rCreate, res: resCreate } = mockReqRes({
                user: customerUser,
                body: {
                    vehicleId: vehicle.vehicle_id,
                    pickupDatetime: `2027-05-26 10:00:00`,
                    returnDatetime: `2027-05-26 12:00:00`
                }
            })
            await createBooking(rCreate, resCreate)
            const id = resCreate.data.booking.bookingId
            createdBookingIds.push(id)

            // Admin updates status: pending -> confirmed
            const { req: rAdmin1, res: resAdmin1 } = mockReqRes({
                user: adminUser,
                params: { id },
                body: { status: 'confirmed' }
            })
            await updateBookingStatus(rAdmin1, resAdmin1)
            if (resAdmin1.statusCode !== 200) throw new Error(`Admin confirmation failed: ${resAdmin1.data?.message}`)
            if (resAdmin1.data.booking.status !== 'confirmed') throw new Error(`Expected confirmed status, got ${resAdmin1.data.booking.status}`)

            // Admin updates status: confirmed -> completed
            const { req: rAdmin2, res: resAdmin2 } = mockReqRes({
                user: adminUser,
                params: { id },
                body: { status: 'completed' }
            })
            await updateBookingStatus(rAdmin2, resAdmin2)
            if (resAdmin2.statusCode !== 200) throw new Error(`Admin completion failed: ${resAdmin2.data?.message}`)
            if (resAdmin2.data.booking.status !== 'completed') throw new Error(`Expected completed status, got ${resAdmin2.data.booking.status}`)

            // Customer attempts to cancel completed booking -> should be rejected with 400
            const { req: rCancel, res: resCancel } = mockReqRes({
                user: customerUser,
                params: { id }
            })
            await cancelBooking(rCancel, resCancel)
            if (resCancel.statusCode !== 400) throw new Error(`Expected 400 when cancelling completed booking, got ${resCancel.statusCode}`)
        })

        // Test 16: Correct display of times in My Bookings and Admin Bookings
        await assertTest('Test 16: Correct display of pickup and return times in My Bookings and Admin Bookings', async () => {
            // Test getMyBookings
            const { req: rMy, res: resMy } = mockReqRes({ user: customerUser })
            await getMyBookings(rMy, resMy)
            if (resMy.statusCode !== 200) throw new Error(`getMyBookings failed: ${resMy.data?.message}`)
            const myBookings = resMy.data.bookings
            if (!Array.isArray(myBookings) || myBookings.length === 0) throw new Error('Expected non-empty my bookings')
            const sampleMy = myBookings[0]
            if (!sampleMy.pickup_datetime || !sampleMy.return_datetime) {
                throw new Error('My bookings record missing pickup_datetime or return_datetime')
            }

            // Test getAllBookings (Admin)
            const { req: rAll, res: resAll } = mockReqRes({ user: adminUser, query: {} })
            await getAllBookings(rAll, resAll)
            if (resAll.statusCode !== 200) throw new Error(`getAllBookings failed: ${resAll.data?.message}`)
            const adminBookings = resAll.data
            if (!Array.isArray(adminBookings) || adminBookings.length === 0) throw new Error('Expected non-empty admin bookings')
            const sampleAdmin = adminBookings[0]
            if (!sampleAdmin.pickup_datetime || !sampleAdmin.return_datetime) {
                throw new Error('Admin booking row missing pickup_datetime or return_datetime')
            }

            // Test getBookingById (Admin)
            const { req: rById, res: resById } = mockReqRes({ user: adminUser, params: { id: sampleAdmin.booking_id } })
            await getBookingById(rById, resById)
            if (resById.statusCode !== 200) throw new Error(`getBookingById failed: ${resById.data?.message}`)
            if (!resById.data.pickup_datetime || !resById.data.return_datetime) {
                throw new Error('Admin getBookingById missing pickup_datetime or return_datetime')
            }
        })

    } finally {
        // Clean up ONLY created test bookings
        if (createdBookingIds.length > 0) {
            console.log(`\nCleaning up ${createdBookingIds.length} isolated test booking records...`)
            await db.query('DELETE FROM bookings WHERE booking_id IN (?)', [createdBookingIds])
            console.log('Cleanup completed. No real bookings affected.')
        }
        await db.end()
    }

    console.log('\n====================================================')
    console.log(`Test Results: ${passedCount} Passed, ${failedCount} Failed`)
    console.log('====================================================')

    if (failedCount > 0) {
        process.exit(1)
    } else {
        process.exit(0)
    }
}

runTestSuite().catch(err => {
    console.error('Test suite runner crashed:', err)
    process.exit(1)
})
