/**
 * Vehicle Maintenance Routes
 *
 * File: backend/routes/maintenanceRoutes.js
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const { uploadMaintenanceInvoice } = require('../utils/fileUpload');
const {
    getStats,
    getRecords,
    getRecordById,
    createRecord,
    updateRecord,
    deleteRecord,
    getVehicleHistory,
    getReminders,
    updateReminderStatus,
    downloadInvoice
} = require('../controllers/maintenanceController');

// All maintenance operations require authentication and admin authorization
router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/stats', getStats);
router.get('/records', getRecords);
router.get('/records/:id', getRecordById);
router.post('/records', uploadMaintenanceInvoice.single('invoice'), createRecord);
router.put('/records/:id', uploadMaintenanceInvoice.single('invoice'), updateRecord);
router.delete('/records/:id', deleteRecord);
router.get('/vehicle/:vehicleId', getVehicleHistory);
router.get('/reminders', getReminders);
router.put('/reminders/:id', updateReminderStatus);
router.get('/records/:id/invoice', downloadInvoice);

module.exports = router;

