/**
 * Location & Delivery Pricing Controller
 *
 * File: backend/controllers/locationController.js
 */

const db = require('../config/db');
const {
    calculateDrivingRoute,
    calculateDeliveryCharge
} = require('../utils/distanceCalculator');

/**
 * Public/User: Calculate route distance, duration and delivery fee
 */
const calculateRoute = async (req, res) => {
    try {
        const { pickupLat, pickupLng, dropLat, dropLng } = req.body;

        if (pickupLat === undefined || pickupLng === undefined || dropLat === undefined || dropLng === undefined) {
            return res.status(400).json({
                message: 'pickupLat, pickupLng, dropLat, and dropLng coordinates are required.'
            });
        }

        const route = await calculateDrivingRoute(pickupLat, pickupLng, dropLat, dropLng);
        const delivery = await calculateDeliveryCharge(route.distanceKm);

        return res.status(200).json({
            route_distance_km: route.distanceKm,
            estimated_travel_time: route.durationDisplay,
            duration_minutes: route.durationMinutes,
            delivery_charge: delivery.deliveryCharge,
            is_free_delivery: delivery.isFree,
            free_distance_km: delivery.freeDistanceKm,
            pricing_rule: {
                base_delivery_charge: delivery.rule.base_delivery_charge,
                per_km_charge: delivery.rule.per_km_charge,
                free_delivery_distance_km: delivery.rule.free_delivery_distance_km,
                max_delivery_distance_km: delivery.rule.max_delivery_distance_km
            }
        });
    } catch (err) {
        console.error('Error calculating route:', err.message);
        return res.status(500).json({
            message: 'Failed to calculate driving route and delivery fee'
        });
    }
};

/**
 * Get active service hubs for pickup/drop suggestions
 */
const getServiceHubs = async (req, res) => {
    try {
        const [hubs] = await db.query(
            `SELECT id, hub_name, address, latitude, longitude, city, is_active
             FROM service_hubs
             WHERE is_active = TRUE
             ORDER BY city ASC, hub_name ASC`
        );

        return res.status(200).json({ hubs });
    } catch (err) {
        console.error('Error fetching service hubs:', err.message);
        return res.status(500).json({ message: 'Failed to fetch service hubs' });
    }
};

/**
 * Get current delivery pricing configuration
 */
const getDeliveryPricing = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, base_delivery_charge, per_km_charge, free_delivery_distance_km, max_delivery_distance_km, is_active, updated_at
             FROM delivery_pricing_rules
             WHERE is_active = TRUE
             ORDER BY id DESC
             LIMIT 1`
        );

        const pricing = rows[0] || {
            id: 1,
            base_delivery_charge: 150.00,
            per_km_charge: 15.00,
            free_delivery_distance_km: 5.00,
            max_delivery_distance_km: 150.00
        };

        return res.status(200).json({ pricing });
    } catch (err) {
        console.error('Error fetching delivery pricing:', err.message);
        return res.status(500).json({ message: 'Failed to fetch delivery pricing' });
    }
};

/**
 * Admin: Update delivery pricing rules
 */
const updateDeliveryPricing = async (req, res) => {
    try {
        const {
            base_delivery_charge,
            per_km_charge,
            free_delivery_distance_km,
            max_delivery_distance_km
        } = req.body;

        const base = Number(base_delivery_charge);
        const perKm = Number(per_km_charge);
        const freeKm = Number(free_delivery_distance_km);
        const maxKm = Number(max_delivery_distance_km);

        if (isNaN(base) || base < 0 || isNaN(perKm) || perKm < 0 || isNaN(freeKm) || freeKm < 0 || isNaN(maxKm) || maxKm <= freeKm) {
            return res.status(400).json({
                message: 'Invalid pricing parameters: Rates must be non-negative numbers and max distance must exceed free distance.'
            });
        }

        // Deactivate older active rules
        await db.query('UPDATE delivery_pricing_rules SET is_active = FALSE WHERE is_active = TRUE');

        // Insert new active pricing rule
        const [result] = await db.query(
            `INSERT INTO delivery_pricing_rules 
                (base_delivery_charge, per_km_charge, free_delivery_distance_km, max_delivery_distance_km, is_active)
             VALUES (?, ?, ?, ?, TRUE)`,
            [base, perKm, freeKm, maxKm]
        );

        return res.status(200).json({
            message: 'Delivery pricing rules updated successfully',
            pricing: {
                id: result.insertId,
                base_delivery_charge: base,
                per_km_charge: perKm,
                free_delivery_distance_km: freeKm,
                max_delivery_distance_km: maxKm,
                is_active: true
            }
        });
    } catch (err) {
        console.error('Error updating delivery pricing:', err.message);
        return res.status(500).json({ message: 'Failed to update delivery pricing' });
    }
};

/**
 * Admin: Get all service hubs
 */
const getAllServiceHubsAdmin = async (req, res) => {
    try {
        const [hubs] = await db.query(
            `SELECT id, hub_name, address, latitude, longitude, city, is_active, created_at
             FROM service_hubs
             ORDER BY id DESC`
        );

        return res.status(200).json({ hubs });
    } catch (err) {
        console.error('Error fetching admin hubs:', err.message);
        return res.status(500).json({ message: 'Failed to fetch hubs' });
    }
};

/**
 * Admin: Create a new service hub
 */
const createServiceHub = async (req, res) => {
    try {
        const { hub_name, address, latitude, longitude, city } = req.body;

        if (!hub_name || !address || latitude === undefined || longitude === undefined || !city) {
            return res.status(400).json({
                message: 'All hub fields (hub_name, address, latitude, longitude, city) are required.'
            });
        }

        const [result] = await db.query(
            `INSERT INTO service_hubs (hub_name, address, latitude, longitude, city, is_active)
             VALUES (?, ?, ?, ?, ?, TRUE)`,
            [hub_name.trim(), address.trim(), Number(latitude), Number(longitude), city.trim()]
        );

        return res.status(201).json({
            message: 'Service hub created successfully',
            hub: {
                id: result.insertId,
                hub_name: hub_name.trim(),
                address: address.trim(),
                latitude: Number(latitude),
                longitude: Number(longitude),
                city: city.trim(),
                is_active: true
            }
        });
    } catch (err) {
        console.error('Error creating service hub:', err.message);
        return res.status(500).json({ message: 'Failed to create service hub' });
    }
};

/**
 * Admin: Delete a service hub
 */
const deleteServiceHub = async (req, res) => {
    try {
        const hubId = Number(req.params.id);
        if (!Number.isInteger(hubId) || hubId <= 0) {
            return res.status(400).json({ message: 'Invalid hub ID' });
        }

        await db.query('DELETE FROM service_hubs WHERE id = ?', [hubId]);
        return res.status(200).json({ message: 'Service hub deleted successfully' });
    } catch (err) {
        console.error('Error deleting service hub:', err.message);
        return res.status(500).json({ message: 'Failed to delete service hub' });
    }
};

/**
 * Admin: Get booking location routes for map visualization
 */
const getBookingLocationsMap = async (req, res) => {
    try {
        const [bookings] = await db.query(
            `SELECT 
                b.booking_id,
                b.user_id,
                u.name AS customer_name,
                u.email AS customer_email,
                v.name AS vehicle_name,
                v.brand AS vehicle_brand,
                v.registration_number,
                b.pickup_address,
                b.pickup_latitude,
                b.pickup_longitude,
                b.drop_address,
                b.drop_latitude,
                b.drop_longitude,
                b.route_distance_km,
                b.estimated_travel_time,
                b.delivery_charge,
                b.total_price,
                b.status,
                b.pickup_datetime,
                b.return_datetime
             FROM bookings b
             JOIN users u ON b.user_id = u.user_id
             JOIN vehicles v ON b.vehicle_id = v.vehicle_id
             WHERE b.pickup_latitude IS NOT NULL AND b.pickup_longitude IS NOT NULL
             ORDER BY b.booking_id DESC
             LIMIT 100`
        );

        return res.status(200).json({ bookings });
    } catch (err) {
        console.error('Error fetching booking locations for map:', err.message);
        return res.status(500).json({ message: 'Failed to fetch booking locations' });
    }
};

module.exports = {
    calculateRoute,
    getServiceHubs,
    getDeliveryPricing,
    updateDeliveryPricing,
    getAllServiceHubsAdmin,
    createServiceHub,
    deleteServiceHub,
    getBookingLocationsMap
};

