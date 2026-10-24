const db = require('../config/db')
const {
    parseDateTime,
    calculateRentalDuration,
    calculateRentalPrice
} = require('../utils/bookingUtils')

const createBooking = async (req, res) => {
    let connection
    try {
        const userId = req.user && req.user.user_id
        if (!userId) {
            return res.status(401).json({
                message: 'Authentication required'
            })
        }

        const rawVehicleId = req.body.vehicleId !== undefined ? req.body.vehicleId : req.body.vehicle_id
        const vehicleId = Number(rawVehicleId)

        const rawPickup = req.body.pickupDatetime || req.body.pickup_datetime || req.body.startDate || req.body.start_date
        const rawReturn = req.body.returnDatetime || req.body.return_datetime || req.body.endDate || req.body.end_date

        if (!rawVehicleId || !rawPickup || !rawReturn) {
            return res.status(400).json({
                message: 'All booking fields (vehicleId, pickup datetime, return datetime) are required'
            })
        }

        if (!Number.isInteger(vehicleId) || vehicleId <= 0) {
            return res.status(400).json({
                message: 'Invalid vehicle ID: Must be a positive integer'
            })
        }

        const pickupParsed = parseDateTime(rawPickup)
        if (!pickupParsed.valid) {
            return res.status(400).json({
                message: `Invalid pickup datetime: ${pickupParsed.error}`
            })
        }

        const returnParsed = parseDateTime(rawReturn)
        if (!returnParsed.valid) {
            return res.status(400).json({
                message: `Invalid return datetime: ${returnParsed.error}`
            })
        }

        // Reject pickup times in the past (allow small 60s buffer for request latency)
        const now = new Date()
        if (pickupParsed.date.getTime() < now.getTime() - 60000) {
            return res.status(400).json({
                message: 'Pickup date and time cannot be in the past'
            })
        }

        // Return datetime must be strictly after pickup datetime
        if (returnParsed.date.getTime() <= pickupParsed.date.getTime()) {
            return res.status(400).json({
                message: 'Return date and time must be after pickup date and time'
            })
        }

        // Acquire dedicated connection from the pool for the transaction
        connection = await db.getConnection()
        await connection.beginTransaction()

        // 1. Lock the vehicle row with FOR UPDATE to serialize concurrent bookings for this vehicle
        const [vehicles] = await connection.query(
            `
            SELECT
                v.vehicle_id,
                v.name AS vehicle_name,
                v.brand AS vehicle_brand,
                v.image_url,
                c.name AS category_name,
                v.price_per_day,
                v.is_available
            FROM vehicles v
            LEFT JOIN categories c ON v.category_id = c.category_id
            WHERE v.vehicle_id = ?
            FOR UPDATE
            `,
            [vehicleId]
        )

        if (vehicles.length === 0) {
            await connection.rollback()
            return res.status(404).json({
                message: 'Vehicle not found'
            })
        }

        const vehicle = vehicles[0]

        if (!vehicle.is_available) {
            await connection.rollback()
            return res.status(400).json({
                message: 'Vehicle is currently unavailable'
            })
        }

        // 2. Prevent the same user from creating a duplicate active booking for the exact same vehicle and interval
        const [userDuplicates] = await connection.query(
            `
            SELECT booking_id
            FROM bookings
            WHERE user_id = ?
              AND vehicle_id = ?
              AND pickup_datetime = ?
              AND return_datetime = ?
              AND status IN ('pending', 'confirmed')
            LIMIT 1
            `,
            [userId, vehicleId, pickupParsed.formatted, returnParsed.formatted]
        )

        if (userDuplicates.length > 0) {
            await connection.rollback()
            return res.status(409).json({
                message: 'You already have an active booking for this vehicle and selected dates/times'
            })
        }

        // 3. Prevent overlapping active bookings for the same vehicle
        // Half-open interval rule: existing.pickup_datetime < newReturn AND existing.return_datetime > newPickup
        // Allows adjacent bookings (e.g. one ends at 12:00, another starts at 12:00).
        // Cancelled and completed bookings do not block availability.
        const [overlaps] = await connection.query(
            `
            SELECT booking_id
            FROM bookings
            WHERE vehicle_id = ?
              AND status IN ('pending', 'confirmed')
              AND pickup_datetime < ?
              AND return_datetime > ?
            LIMIT 1
            `,
            [vehicleId, returnParsed.formatted, pickupParsed.formatted]
        )

        if (overlaps.length > 0) {
            await connection.rollback()
            return res.status(409).json({
                message: 'Vehicle is already booked for the selected dates/times. Please choose different times or another vehicle.'
            })
        }

        // 4. Calculate authoritative price and duration
        const durationInfo = calculateRentalDuration(pickupParsed.date, returnParsed.date)
        const totalPrice = calculateRentalPrice(vehicle.price_per_day, durationInfo.durationHours)

        // 5. Insert booking within the serialized transaction
        const [result] = await connection.query(
            `
            INSERT INTO bookings
                (user_id, vehicle_id, pickup_datetime, return_datetime, start_date, end_date, total_price, status)
            VALUES
                (?, ?, ?, ?, ?, ?, ?, 'pending')
            `,
            [
                userId,
                vehicleId,
                pickupParsed.formatted,
                returnParsed.formatted,
                pickupParsed.dateOnly,
                returnParsed.dateOnly,
                totalPrice
            ]
        )

        await connection.commit()

        return res.status(201).json({
            message: 'Booking created successfully',
            booking: {
                bookingId: result.insertId,
                booking_id: result.insertId,
                userId,
                user_id: userId,
                vehicleId,
                vehicle_id: vehicleId,
                vehicleName: vehicle.vehicle_name,
                vehicle_name: vehicle.vehicle_name,
                vehicleBrand: vehicle.vehicle_brand,
                vehicle_brand: vehicle.vehicle_brand,
                imageUrl: vehicle.image_url,
                image_url: vehicle.image_url,
                categoryName: vehicle.category_name,
                category_name: vehicle.category_name,
                pickupDatetime: pickupParsed.formatted,
                pickup_datetime: pickupParsed.formatted,
                returnDatetime: returnParsed.formatted,
                return_datetime: returnParsed.formatted,
                startDate: pickupParsed.formatted,
                start_date: pickupParsed.formatted,
                endDate: returnParsed.formatted,
                end_date: returnParsed.formatted,
                duration: durationInfo.display,
                durationHours: durationInfo.durationHours,
                totalPrice,
                total_price: totalPrice,
                status: 'pending'
            }
        })

    } catch (error) {
        if (connection) {
            try {
                await connection.rollback()
            } catch (rollbackErr) {
                console.error('Error rolling back booking transaction:', rollbackErr.message)
            }
        }

        console.error('Error creating booking:', error.message)

        return res.status(500).json({
            message: 'Failed to create booking'
        })
    } finally {
        if (connection) {
            connection.release()
        }
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
                v.brand AS vehicle_brand,
                v.image_url,
                c.name AS category_name,
                b.pickup_datetime,
                b.return_datetime,
                b.pickup_datetime AS start_date,
                b.return_datetime AS end_date,
                b.total_price,
                b.status,
                b.created_at
            FROM bookings b
            JOIN vehicles v
                ON b.vehicle_id = v.vehicle_id
            LEFT JOIN categories c
                ON v.category_id = c.category_id
            WHERE b.user_id = ?
            ORDER BY b.booking_id DESC
            `,
            [userId]
        )

        const formattedBookings = bookings.map(b => {
            const dur = calculateRentalDuration(b.pickup_datetime, b.return_datetime)
            return {
                ...b,
                duration: dur.display,
                durationHours: dur.durationHours
            }
        })

        res.status(200).json({
            bookings: formattedBookings
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
                v.brand AS vehicle_brand,
                v.image_url,
                c.name AS category_name,
                b.pickup_datetime,
                b.return_datetime,
                b.pickup_datetime AS start_date,
                b.return_datetime AS end_date,
                b.total_price,
                b.status,
                b.created_at
            FROM bookings b
            JOIN vehicles v
                ON b.vehicle_id = v.vehicle_id
            LEFT JOIN categories c
                ON v.category_id = c.category_id
            WHERE b.booking_id = ? AND b.user_id = ?
            `,
            [bookingId, userId]
        )

        const updated = updatedRows[0]
        const dur = calculateRentalDuration(updated.pickup_datetime, updated.return_datetime)

        return res.status(200).json({
            message: 'Booking cancelled successfully',
            booking: {
                ...updated,
                duration: dur.display,
                durationHours: dur.durationHours
            }
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