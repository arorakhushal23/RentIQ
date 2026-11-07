const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const { getDashboardStats } = require('../controllers/adminController');
const {
    getAllVehicles,
    getVehicleByIdAdmin,
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
const {
    getVehicleDocuments,
    uploadDocument,
    updateDocument,
    deleteDocument,
    downloadDocument,
    getDocumentAlerts
} = require('../controllers/vehicleDocumentController');
const {
    getAllLicenses,
    getLicenseById,
    verifyLicense,
    rejectLicense,
    downloadAdminLicenseDoc
} = require('../controllers/licenseController');
const { uploadVehicleDocument } = require('../utils/fileUpload');

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
router.get('/vehicles/:id', getVehicleByIdAdmin);
router.get('/categories', getCategories);
router.post('/vehicles', createVehicle);
router.put('/vehicles/:id', updateVehicle);
router.patch('/vehicles/:id/status', updateVehicleStatus);

// Vehicle Document management
router.get('/documents/alerts', getDocumentAlerts);
router.get('/vehicles/:vehicleId/documents', getVehicleDocuments);
router.post('/vehicles/:vehicleId/documents', uploadVehicleDocument.single('file'), uploadDocument);
router.put('/documents/:id', updateDocument);
router.delete('/documents/:id', deleteDocument);
router.get('/documents/:id/download', downloadDocument);

// Customer Driving Licence verification
router.get('/licenses', getAllLicenses);
router.get('/licenses/:id', getLicenseById);
router.patch('/licenses/:id/verify', verifyLicense);
router.patch('/licenses/:id/reject', rejectLicense);
router.get('/licenses/:id/document/:side', downloadAdminLicenseDoc);

// Booking management
router.get('/bookings', getAllBookings);
router.get('/bookings/:id', getBookingById);
router.patch('/bookings/:id/status', updateBookingStatus);

module.exports = router;
