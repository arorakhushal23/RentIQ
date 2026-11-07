const db = require('../config/db')
const {
    parseDateTime,
    calculateRentalDuration,
    calculateRentalPrice
} = require('../utils/bookingUtils')
const { checkVehicleDocumentEligibility } = require('../utils/documentStatusHelper')
const {
    calculateDrivingRoute,
    calculateDeliveryCharge
} = require('../utils/distanceCalculator')
const { ensureAgreementExists } = require('./agreementController')

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

        // Location & Delivery calculation
        const rawPickupAddr = req.body.pickupAddress || req.body.pickup_address || 'RentIQ Central Hub, Sector 17, Chandigarh'
        const rawDropAddr = req.body.dropAddress || req.body.drop_address || rawPickupAddr

        const pLat = req.body.pickupLatitude !== undefined ? req.body.pickupLatitude : req.body.pickupLat !== undefined ? req.body.pickupLat : req.body.pickup_latitude
        const pLng = req.body.pickupLongitude !== undefined ? req.body.pickupLongitude : req.body.pickupLng !== undefined ? req.body.pickupLng : req.body.pickup_longitude
        const dLat = req.body.dropLatitude !== undefined ? req.body.dropLatitude : req.body.dropLat !== undefined ? req.body.dropLat : req.body.drop_latitude
        const dLng = req.body.dropLongitude !== undefined ? req.body.dropLongitude : req.body.dropLng !== undefined ? req.body.dropLng : req.body.drop_longitude

        let routeDistanceKm = 0.00
        let estimatedTravelTime = '0 mins'
        let deliveryCharge = 0.00

        if (pLat !== undefined && pLng !== undefined && dLat !== undefined && dLng !== undefined && !isNaN(Number(pLat)) && !isNaN(Number(pLng))) {
            const route = await calculateDrivingRoute(pLat, pLng, dLat, dLng)
            routeDistanceKm = route.distanceKm
            estimatedTravelTime = route.durationDisplay
            const deliveryRes = await calculateDeliveryCharge(routeDistanceKm)
            deliveryCharge = deliveryRes.deliveryCharge
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

        // 1b. Customer Driving Licence Verification Check
        const [licenses] = await connection.query(
            `SELECT verification_status, expiry_date, vehicle_class
             FROM customer_licenses
             WHERE user_id = ?
             LIMIT 1`,
            [userId]
        )

        if (licenses.length === 0 || licenses[0].verification_status === 'not_submitted') {
            await connection.rollback()
            return res.status(403).json({
                eligible: false,
                code: 'LICENSE_NOT_SUBMITTED',
                message: 'Driving licence required: You must submit and verify your driving licence in your profile before booking a vehicle.',
                redirectUrl: '/profile?tab=license'
            })
        }

        const customerLic = licenses[0]

        if (customerLic.verification_status === 'pending') {
            await connection.rollback()
            return res.status(403).json({
                eligible: false,
                code: 'LICENSE_PENDING',
                message: 'Licence verification pending: Your driving licence is awaiting administrator approval. You will receive an update once verified.',
                redirectUrl: '/profile?tab=license'
            })
        }

        if (customerLic.verification_status === 'rejected') {
            await connection.rollback()
            return res.status(403).json({
                eligible: false,
                code: 'LICENSE_REJECTED',
                message: 'Licence verification rejected: Please review the rejection reason in your profile and submit updated documents.',
                redirectUrl: '/profile?tab=license'
            })
        }

        const todayDate = new Date()
        todayDate.setHours(0, 0, 0, 0)
        const licExp = new Date(customerLic.expiry_date)
        licExp.setHours(0, 0, 0, 0)

        if (licExp.getTime() < todayDate.getTime()) {
            await connection.rollback()
            return res.status(403).json({
                eligible: false,
                code: 'LICENSE_EXPIRED',
                message: 'Driving licence expired: Your driving licence on file has expired. Please upload updated documents in your profile.',
                redirectUrl: '/profile?tab=license'
            })
        }

        // Check vehicle class compatibility
        const vehicleCategoryLower = (vehicle.category_name || '').toLowerCase()
        const isTwoWheeler = ['bike', 'scooter'].includes(vehicleCategoryLower)
        const userClass = (customerLic.vehicle_class || '').toUpperCase()

        if (isTwoWheeler) {
            const twoWheelerClasses = ['MCWG', 'MCWOG', 'TWO_WHEELER', 'ALL', 'LMV+MCWG']
            const matchesTwoWheeler = twoWheelerClasses.some(c => userClass.includes(c))
            if (!matchesTwoWheeler) {
                await connection.rollback()
                return res.status(403).json({
                    eligible: false,
                    code: 'LICENSE_CLASS_MISMATCH',
                    message: `Licence class mismatch: A motorcycle/two-wheeler endorsement (MCWG) is required for two-wheelers. Your current licence class is ${customerLic.vehicle_class}.`,
                    redirectUrl: '/profile?tab=license'
                })
            }
        } else {
            const fourWheelerClasses = ['LMV', 'LMV-NT', 'FOUR_WHEELER', 'ALL', 'LMV+MCWG', 'HMV']
            const matchesFourWheeler = fourWheelerClasses.some(c => userClass.includes(c))
            if (!matchesFourWheeler) {
                await connection.rollback()
                return res.status(403).json({
                    eligible: false,
                    code: 'LICENSE_CLASS_MISMATCH',
                    message: `Licence class mismatch: A Light Motor Vehicle endorsement (LMV) is required to rent a four-wheeler. Your current licence class is ${customerLic.vehicle_class}.`,
                    redirectUrl: '/profile?tab=license'
                })
            }
        }

        // 1c. Vehicle Document Compliance Check
        const [vehDocs] = await connection.query(
            `SELECT document_type, expiry_date, verification_status
             FROM vehicle_documents
             WHERE vehicle_id = ?`,
            [vehicleId]
        )

        const docEligibility = checkVehicleDocumentEligibility(vehDocs, vehicle.category_name)
        if (!docEligibility.eligible) {
            await connection.rollback()
            return res.status(400).json({
                eligible: false,
                code: 'VEHICLE_COMPLIANCE_HOLD',
                message: 'This vehicle is temporarily unavailable due to routine compliance maintenance. Please choose another vehicle.'
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
              AND status IN ('pending', 'confirmed', 'active')
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
        const [overlaps] = await connection.query(
            `
            SELECT booking_id
            FROM bookings
            WHERE vehicle_id = ?
              AND status IN ('pending', 'confirmed', 'active')
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
        const baseRentalPrice = calculateRentalPrice(vehicle.price_per_day, durationInfo.durationHours)
        const totalPrice = Number((baseRentalPrice + deliveryCharge).toFixed(2))

        // 5. Insert booking with location and delivery charge within the serialized transaction
        const [result] = await connection.query(
            `
            INSERT INTO bookings
                (user_id, vehicle_id, pickup_datetime, return_datetime, start_date, end_date, total_price, status,
                 pickup_address, pickup_latitude, pickup_longitude, drop_address, drop_latitude, drop_longitude,
                 route_distance_km, estimated_travel_time, delivery_charge)
            VALUES
                (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                userId,
                vehicleId,
                pickupParsed.formatted,
                returnParsed.formatted,
                pickupParsed.dateOnly,
                returnParsed.dateOnly,
                totalPrice,
                rawPickupAddr,
                pLat !== undefined && !isNaN(Number(pLat)) ? Number(pLat) : null,
                pLng !== undefined && !isNaN(Number(pLng)) ? Number(pLng) : null,
                rawDropAddr,
                dLat !== undefined && !isNaN(Number(dLat)) ? Number(dLat) : null,
                dLng !== undefined && !isNaN(Number(dLng)) ? Number(dLng) : null,
                routeDistanceKm,
                estimatedTravelTime,
                deliveryCharge
            ]
        )

        const bookingId = result.insertId
        await connection.commit()

        // 6. Generate digital rental agreement snapshot automatically
        let agreement = null
        try {
            agreement = await ensureAgreementExists(bookingId, userId)
        } catch (agrErr) {
            console.error('Notice: Auto-generating agreement failed (will generate on view):', agrErr.message)
        }

        return res.status(201).json({
            message: 'Booking created successfully',
            booking: {
                bookingId,
                booking_id: bookingId,
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
                baseRentalPrice,
                base_rental_price: baseRentalPrice,
                deliveryCharge,
                delivery_charge: deliveryCharge,
                routeDistanceKm,
                route_distance_km: routeDistanceKm,
                estimatedTravelTime,
                estimated_travel_time: estimatedTravelTime,
                pickupAddress: rawPickupAddr,
                pickup_address: rawPickupAddr,
                dropAddress: rawDropAddr,
                drop_address: rawDropAddr,
                totalPrice,
                total_price: totalPrice,
                status: 'pending',
                agreementId: agreement ? agreement.id : null,
                agreementNumber: agreement ? agreement.agreement_number : null
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
                v.registration_number,
                v.image_url,
                c.name AS category_name,
                b.pickup_datetime,
                b.return_datetime,
                b.pickup_datetime AS start_date,
                b.return_datetime AS end_date,
                b.pickup_address,
                b.pickup_latitude,
                b.pickup_longitude,
                b.drop_address,
                b.drop_latitude,
                b.drop_longitude,
                b.route_distance_km,
                b.estimated_travel_time,
                b.delivery_charge,
                b.total_price,
                b.status,
                b.created_at,
                ra.id AS agreement_id,
                ra.agreement_number,
                ra.agreement_status,
                ra.terms_accepted,
                (SELECT id FROM vehicle_inspections vi WHERE vi.booking_id = b.booking_id AND vi.inspection_type = 'pickup') AS pickup_inspection_id,
                (SELECT customer_accepted FROM vehicle_inspections vi WHERE vi.booking_id = b.booking_id AND vi.inspection_type = 'pickup') AS pickup_customer_accepted,
                (SELECT id FROM vehicle_inspections vi WHERE vi.booking_id = b.booking_id AND vi.inspection_type = 'return') AS return_inspection_id
            FROM bookings b
            JOIN vehicles v
                ON b.vehicle_id = v.vehicle_id
            LEFT JOIN categories c
                ON v.category_id = c.category_id
            LEFT JOIN rental_agreements ra
                ON b.booking_id = ra.booking_id
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
            return res.status(400).json({
                message: 'Booking cancellation failed'
            })
        }

        // Also update agreement status to cancelled if exists
        await db.query('UPDATE rental_agreements SET agreement_status = "cancelled" WHERE booking_id = ?', [bookingId])

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
