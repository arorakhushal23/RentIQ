const express = require('express')

const {
    createBooking,
    getMyBookings,
    getBookingByIdCustomer,
    cancelBooking,
    checkVehicleAvailabilityEndpoint
} = require('../controllers/bookingController')

const authMiddleware = require('../middleware/authMiddleware')

const router = express.Router()

// Check vehicle availability (publicly accessible before or during booking creation)
router.post('/check-availability', checkVehicleAvailabilityEndpoint)
router.get('/check-availability', checkVehicleAvailabilityEndpoint)

router.post('/', authMiddleware, createBooking)

router.get('/my-bookings', authMiddleware, getMyBookings)

router.get('/:id', authMiddleware, getBookingByIdCustomer)

router.patch('/:id/cancel', authMiddleware, cancelBooking)

module.exports = router
