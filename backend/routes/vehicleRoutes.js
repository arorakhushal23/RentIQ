const express = require('express');

const {
    getVehicles,
    getVehicleById,
    getCategories
} = require('../controllers/vehicleController');

const router = express.Router();

router.get('/categories', getCategories);
router.get('/', getVehicles);
router.get('/:id', getVehicleById);

module.exports = router;
