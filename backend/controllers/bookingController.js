const db = require('../config/db')

const createBooking = async (req, res) => {
    try {
        const {
            vehicleId,
            startDate,
            endDate
        } = req.body

        const userId = req.user.user_id

        if (!vehicleId || !startDate || !endDate) {
            return res.status(400).json({
                message: 'All booking fields are required'
            })
        }

        if (endDate <= startDate) {
            return res.status(400).json({
                message: 'End date must be after start date'
            })
        }

        const [vehicles] = await db.query(
            `
            SELECT
                vehicle_id,
                price_per_day,
                is_available
            FROM vehicles
            WHERE vehicle_id = ?
            `,
            [vehicleId]
        )

        if (vehicles.length === 0) {
            return res.status(404).json({
                message: 'Vehicle not found'
            })
        }

        const vehicle = vehicles[0]

        if (!vehicle.is_available) {
            return res.status(400).json({
                message: 'Vehicle is currently unavailable'
            })
        }

        const start = new Date(startDate)
        const end = new Date(endDate)

        const difference = end - start

        const rentalDays =
            difference / (1000 * 60 * 60 * 24)

        const totalPrice =
            rentalDays * Number(vehicle.price_per_day)

        const [result] = await db.query(
            `
            INSERT INTO bookings
                (user_id, vehicle_id, start_date, end_date, total_price, status)
            VALUES
                (?, ?, ?, ?, ?, 'pending')
            `,
            [
                userId,
                vehicleId,
                startDate,
                endDate,
                totalPrice
            ]
        )

        res.status(201).json({
            message: 'Booking created successfully',
            booking: {
                bookingId: result.insertId,
                userId,
                vehicleId,
                startDate,
                endDate,
                rentalDays,
                totalPrice,
                status: 'pending'
            }
        })

    } catch (error) {
        console.error('Error creating booking:', error.message)

        res.status(500).json({
            message: 'Failed to create booking'
        })
    }
}


const getMyBookings = async (req, res) => {
    try {
        const userId = req.user.user_id

        const [bookings] = await db.query(
            `
            SELECT
                b.booking_id,
                b.vehicle_id,
                v.name AS vehicle_name,
                b.start_date,
                b.end_date,
                b.total_price,
                b.status,
                b.created_at
            FROM bookings b
            JOIN vehicles v
                ON b.vehicle_id = v.vehicle_id
            WHERE b.user_id = ?
            ORDER BY b.created_at DESC
            `,
            [userId]
        )

        res.status(200).json({
            bookings
        })

    } catch (error) {
        console.error('Error fetching bookings:', error.message)

        res.status(500).json({
            message: 'Failed to fetch bookings'
        })
    }
}


const cancelBooking = async (req, res) => {
    try {
        const userId = req.user && req.user.user_id
        if (!userId) {
            return res.status(401).json({
                message: 'Authentication required'
            })
        }

        const rawId = req.params.id
        const bookingId = Number(rawId)
        if (!Number.isInteger(bookingId) || bookingId <= 0) {
            return res.status(400).json({
                message: 'Invalid booking ID: Must be a positive integer'
            })
        }

        // 1. Fetch booking to inspect existence, ownership, and current status
        const [bookings] = await db.query(
            'SELECT booking_id, user_id, status FROM bookings WHERE booking_id = ?',
            [bookingId]
        )

        if (bookings.length === 0) {
            return res.status(404).json({
                message: 'Booking not found'
            })
        }

        const booking = bookings[0]

        // 2. Ownership check: Must belong to authenticated customer
        if (booking.user_id !== userId) {
            return res.status(403).json({
                message: 'You are not authorized to cancel this booking'
            })
        }

        // 3. Status checks: Reject terminal statuses and invalid transitions
        if (booking.status === 'cancelled') {
            return res.status(400).json({
                message: 'Booking is already cancelled'
            })
        }

        if (booking.status === 'completed') {
            return res.status(400).json({
                message: 'Cannot cancel a completed booking'
            })
        }

        const CANCELLABLE_STATUSES = ['pending', 'confirmed']
        if (!CANCELLABLE_STATUSES.includes(booking.status)) {
            return res.status(400).json({
                message: `Booking cannot be cancelled in "${booking.status}" status`
            })
        }

        // 4. Safe atomic update enforcing ownership and eligible status
        const [updateResult] = await db.query(
            `
            UPDATE bookings
            SET status = 'cancelled'
            WHERE booking_id = ?
              AND user_id = ?
              AND status IN ('pending', 'confirmed')
            `,
            [bookingId, userId]
        )

        if (updateResult.affectedRows === 0) {
            // Concurrent status change or modification between check and update
            const [currentRows] = await db.query(
                'SELECT status FROM bookings WHERE booking_id = ? AND user_id = ?',
                [bookingId, userId]
            )

            if (currentRows.length === 0) {
                return res.status(404).json({
                    message: 'Booking not found'
                })
            }

            const currentStatus = currentRows[0].status
            if (currentStatus === 'cancelled') {
                return res.status(400).json({
                    message: 'Booking is already cancelled'
                })
            }

            if (currentStatus === 'completed') {
                return res.status(400).json({
                    message: 'Cannot cancel a completed booking'
                })
            }

            return res.status(400).json({
                message: `Booking could not be cancelled in its current status ("${currentStatus}")`
            })
        }

        // 5. Fetch updated booking record with joined vehicle name matching getMyBookings
        const [updatedRows] = await db.query(
            `
            SELECT
                b.booking_id,
                b.vehicle_id,
                v.name AS vehicle_name,
                b.start_date,
                b.end_date,
                b.total_price,
                b.status,
                b.created_at
            FROM bookings b
            JOIN vehicles v
                ON b.vehicle_id = v.vehicle_id
            WHERE b.booking_id = ? AND b.user_id = ?
            `,
            [bookingId, userId]
        )

        return res.status(200).json({
            message: 'Booking cancelled successfully',
            booking: updatedRows[0]
        })

    } catch (error) {
        console.error('Error cancelling booking:', error.message)

        return res.status(500).json({
            message: 'Failed to cancel booking'
        })
    }
}


module.exports = {
    createBooking,
    getMyBookings,
    cancelBooking
}