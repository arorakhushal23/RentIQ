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
const {
    getDeliveryPricing,
    updateDeliveryPricing,
    getAllServiceHubsAdmin,
    createServiceHub,
    deleteServiceHub,
    getBookingLocationsMap
} = require('../controllers/locationController');
const {
    createInspection,
    uploadPhotos,
    getAllInspectionsAdmin,
    completeHandover,
    completeRental,
    downloadInspectionPhoto
} = require('../controllers/inspectionController');
const {
    getAllAgreementsAdmin,
    downloadAgreementPDF,
    ensureAgreementExists
} = require('../controllers/agreementController');
const {
    uploadVehicleDocument,
    uploadInspectionPhotos
} = require('../utils/fileUpload');

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

// Location & Delivery Pricing Management
router.get('/locations/pricing', getDeliveryPricing);
router.put('/locations/pricing', updateDeliveryPricing);
router.get('/locations/hubs', getAllServiceHubsAdmin);
router.post('/locations/hubs', createServiceHub);
router.delete('/locations/hubs/:id', deleteServiceHub);
router.get('/locations/routes', getBookingLocationsMap);

// Vehicle Inspection System (Pickup & Return)
router.get('/inspections', getAllInspectionsAdmin);
router.post('/inspections', uploadInspectionPhotos.array('photos', 10), createInspection);
router.post('/inspections/:id/photos', uploadInspectionPhotos.array('photos', 10), uploadPhotos);
router.post('/inspections/booking/:bookingId/handover', completeHandover);
router.post('/inspections/booking/:bookingId/complete-rental', completeRental);
router.get('/inspections/photo/:photoId', downloadInspectionPhoto);

// Rental Agreement Management
router.get('/agreements', getAllAgreementsAdmin);
router.get('/agreements/:id/download', downloadAgreementPDF);
router.post('/agreements/booking/:bookingId/generate', async (req, res) => {
    try {
        const agreement = await ensureAgreementExists(Number(req.params.bookingId), null);
        return res.status(200).json({ message: 'Agreement generated successfully', agreement });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
});

module.exports = router;
