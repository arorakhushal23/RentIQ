const express = require('express');
const router = express.Router();
const {
    calculateRoute,
    getServiceHubs,
    getDeliveryPricing
} = require('../controllers/locationController');

// Public/User endpoints
router.post('/calculate-route', calculateRoute);
router.get('/hubs', getServiceHubs);
router.get('/pricing', getDeliveryPricing);

module.exports = router;

