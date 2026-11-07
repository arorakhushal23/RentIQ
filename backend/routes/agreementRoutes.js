const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
    getAgreementByBooking,
    acceptAgreement,
    downloadAgreementPDF
} = require('../controllers/agreementController');

// All agreement routes require authentication
router.use(authMiddleware);

router.get('/booking/:bookingId', getAgreementByBooking);
router.post('/:id/accept', acceptAgreement);
router.get('/:id/download', downloadAgreementPDF);

module.exports = router;

