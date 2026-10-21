const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const { getDashboardStats } = require('../controllers/adminController');
const {
    getAllVehicles,
    getCategories,
    createVehicle,
    updateVehicle,
    updateVehicleStatus
} = require('../controllers/adminVehicleController');
const {
    getAllBookings,
    getBookingById,
    updateBookingStatus
} = require('../controllers/adminBookingController');

/**
 * Admin Routes
 *
 * All routes mounted on this router require:
 * 1. Valid authentication token (authMiddleware)
 * 2. Active database verified administrator role (adminMiddleware)
 */
router.use(authMiddleware, adminMiddleware);

// Dashboard statistics
router.get('/dashboard', getDashboardStats);

// Vehicle management
router.get('/vehicles', getAllVehicles);
router.get('/categories', getCategories);
router.post('/vehicles', createVehicle);
router.put('/vehicles/:id', updateVehicle);
router.patch('/vehicles/:id/status', updateVehicleStatus);

// Booking management
router.get('/bookings', getAllBookings);
router.get('/bookings/:id', getBookingById);
router.patch('/bookings/:id/status', updateBookingStatus);

module.exports = router;

