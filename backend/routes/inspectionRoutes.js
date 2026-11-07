const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
    getInspectionsByBooking,
    customerAcceptInspection,
    downloadInspectionPhoto
} = require('../controllers/inspectionController');

// All inspection routes require authentication
router.use(authMiddleware);

router.get('/booking/:bookingId', getInspectionsByBooking);
router.post('/:id/accept', customerAcceptInspection);
router.get('/photo/:photoId', downloadInspectionPhoto);

module.exports = router;

