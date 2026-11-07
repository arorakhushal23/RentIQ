/**
 * Smart Pricing & Additional Charges Routes
 *
 * File: backend/routes/pricingRoutes.js
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const {
    calculatePrice,
    getPricingConfig,
    createPricingRule,
    updatePricingRule,
    togglePricingRule,
    deletePricingRule,
    createSeasonalRule,
    updateSeasonalRule,
    toggleSeasonalRule,
    deleteSeasonalRule,
    createAdditionalChargeRule,
    updateAdditionalChargeRule,
    deleteAdditionalChargeRule,
    getBookingPriceBreakdown,
    computeAndApplyPostRentalCharges
} = require('../controllers/pricingController');

// 1. Public or Customer Pricing Endpoints
router.post('/calculate', calculatePrice);
router.get('/config', getPricingConfig);
router.get('/breakdown/:bookingId', getBookingPriceBreakdown);

// 2. Admin Protected Endpoints
router.post('/rules', authMiddleware, adminMiddleware, createPricingRule);
router.put('/rules/:id', authMiddleware, adminMiddleware, updatePricingRule);
router.patch('/rules/:id/toggle', authMiddleware, adminMiddleware, togglePricingRule);
router.delete('/rules/:id', authMiddleware, adminMiddleware, deletePricingRule);

router.post('/seasonal', authMiddleware, adminMiddleware, createSeasonalRule);
router.put('/seasonal/:id', authMiddleware, adminMiddleware, updateSeasonalRule);
router.patch('/seasonal/:id/toggle', authMiddleware, adminMiddleware, toggleSeasonalRule);
router.delete('/seasonal/:id', authMiddleware, adminMiddleware, deleteSeasonalRule);

router.post('/charges', authMiddleware, adminMiddleware, createAdditionalChargeRule);
router.put('/charges/:id', authMiddleware, adminMiddleware, updateAdditionalChargeRule);
router.delete('/charges/:id', authMiddleware, adminMiddleware, deleteAdditionalChargeRule);

router.post('/post-rental/:bookingId', authMiddleware, adminMiddleware, computeAndApplyPostRentalCharges);

module.exports = router;

