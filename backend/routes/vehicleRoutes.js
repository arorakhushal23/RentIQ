const express = require('express');

const {
    getVehicles,
    getVehicleById
} = require('../controllers/vehicleController');

const router = express.Router();

router.get('/', getVehicles);

router.get('/:id', getVehicleById);

module.exports = router;