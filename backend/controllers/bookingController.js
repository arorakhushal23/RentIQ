const db = require('../config/db')

const createBooking = async (req, res) => {
    try {
        const {
            vehicleId,
            startDate,
            endDate
        } = req.body

        const userId = req.user.user_id

        // Basic validation
        if (!vehicleId || !startDate || !endDate) {
            return res.status(400).json({
                message: 'All booking fields are required'
            })
        }

        // Make sure the end date is after the start date
        if (endDate <= startDate) {
            return res.status(400).json({
                message: 'End date must be after start date'
            })
        }

        // Get vehicle and check availability
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

        // Calculate rental days
        const start = new Date(startDate)
        const end = new Date(endDate)

        const difference = end - start

        const rentalDays =
            difference / (1000 * 60 * 60 * 24)

        // Calculate price on the server
        const totalPrice =
            rentalDays * Number(vehicle.price_per_day)

        // Create booking
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


module.exports = {
    createBooking,
    getMyBookings
}