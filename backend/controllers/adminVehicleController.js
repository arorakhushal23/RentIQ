const db = require('../config/db');

/**
 * Admin Vehicle Controller
 *
 * File: backend/controllers/adminVehicleController.js
 * Handles fleet inspection, vehicle creation, vehicle modification,
 * category retrieval, and availability status updates for administrators.
 */

/**
 * Validates optional image URL input according to security policies:
 * - Omitted or empty string returns null.
 * - Maximum length 255 characters.
 * - Absolute URLs must use http:// or https://.
 * - Relative paths (e.g. /vehicles/swift.jpg) are permitted.
 * - Disallows dangerous pseudoprotocols (e.g. javascript:, data:).
 */
function validateImageUrl(url) {
    if (url === undefined || url === null) {
        return { valid: true, value: null };
    }
    if (typeof url !== 'string') {
        return { valid: false, error: 'image_url must be a string' };
    }
    const trimmed = url.trim();
    if (trimmed.length === 0) {
        return { valid: true, value: null };
    }
    if (trimmed.length > 255) {
        return { valid: false, error: 'image_url must not exceed 255 characters' };
    }

    if (trimmed.includes('://')) {
        try {
            const parsed = new URL(trimmed);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                return { valid: false, error: 'Absolute image URL must use HTTP or HTTPS protocol' };
            }
        } catch (_) {
            return { valid: false, error: 'Invalid URL format' };
        }
    } else {
        const lower = trimmed.toLowerCase();
        if (
            lower.startsWith('javascript:') ||
            lower.startsWith('data:') ||
            lower.startsWith('vbscript:')
        ) {
            return { valid: false, error: 'Invalid relative image path' };
        }
    }

    return { valid: true, value: trimmed };
}

/**
 * Validates a positive integer value (e.g. IDs, seat counts).
 */
function parsePositiveInt(val) {
    const num = Number(val);
    if (!Number.isInteger(num) || num <= 0) {
        return null;
    }
    return num;
}

/**
 * Formats a raw database row into consistent response types.
 */
function formatVehicleRow(row) {
    return {
        vehicle_id: row.vehicle_id,
        category_id: row.category_id,
        name: row.name,
        brand: row.brand,
        seating_capacity: Number(row.seating_capacity),
        transmission: row.transmission,
        price_per_day: Number(row.price_per_day),
        is_available: Boolean(row.is_available),
        image_url: row.image_url,
        created_at: row.created_at,
        category: row.category,
        total_bookings: Number(row.total_bookings) || 0
    };
}

/**
 * GET /api/admin/vehicles
 * Returns all vehicles (including unavailable) with categories and total booking count.
 */
const getAllVehicles = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                v.vehicle_id,
                v.category_id,
                v.name,
                v.brand,
                v.seating_capacity,
                v.transmission,
                v.price_per_day,
                v.is_available,
                v.image_url,
                v.created_at,
                c.name AS category,
                (SELECT COUNT(*) FROM bookings b WHERE b.vehicle_id = v.vehicle_id) AS total_bookings
            FROM vehicles v
            JOIN categories c ON v.category_id = c.category_id
            ORDER BY v.vehicle_id DESC
        `);

        const vehicles = rows.map(formatVehicleRow);
        return res.status(200).json(vehicles);
    } catch (error) {
        console.error('Error fetching admin vehicles:', error.message);
        return res.status(500).json({
            message: 'Failed to fetch vehicles'
        });
    }
};

/**
 * GET /api/admin/categories
 * Returns all vehicle categories for dropdown selection.
 */
const getCategories = async (req, res) => {
    try {
        const [categories] = await db.query(
            'SELECT category_id, name FROM categories ORDER BY category_id ASC'
        );

        return res.status(200).json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error.message);
        return res.status(500).json({
            message: 'Failed to fetch categories'
        });
    }
};

/**
 * POST /api/admin/vehicles
 * Creates a new vehicle record in the fleet.
 */
const createVehicle = async (req, res) => {
    try {
        const {
            name,
            category_id,
            brand,
            seating_capacity,
            transmission,
            price_per_day,
            image_url,
            is_available
        } = req.body;

        // 1. Validate vehicle name
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ message: 'Name is required and cannot be empty' });
        }
        const trimmedName = name.trim();
        if (trimmedName.length > 100) {
            return res.status(400).json({ message: 'Name must not exceed 100 characters' });
        }

        // 2. Validate category_id
        const categoryId = parsePositiveInt(category_id);
        if (!categoryId) {
            return res.status(400).json({ message: 'Category ID is required and must be a positive integer' });
        }
        const [categoryRows] = await db.query(
            'SELECT category_id FROM categories WHERE category_id = ?',
            [categoryId]
        );
        if (categoryRows.length === 0) {
            return res.status(400).json({ message: 'Invalid category: Category does not exist' });
        }

        // 3. Validate seating_capacity
        const seats = parsePositiveInt(seating_capacity);
        if (!seats) {
            return res.status(400).json({ message: 'Seating capacity is required and must be a positive integer' });
        }

        // 4. Validate transmission
        if (!transmission || (transmission !== 'automatic' && transmission !== 'manual')) {
            return res.status(400).json({ message: 'Transmission must be either "automatic" or "manual"' });
        }

        // 5. Validate price_per_day
        const price = Number(price_per_day);
        if (isNaN(price) || !isFinite(price) || price <= 0) {
            return res.status(400).json({ message: 'Price per day is required and must be a finite positive number' });
        }

        // 6. Validate optional brand
        let validatedBrand = null;
        if (brand !== undefined && brand !== null) {
            if (typeof brand !== 'string') {
                return res.status(400).json({ message: 'Brand must be a string' });
            }
            const trimmed = brand.trim();
            if (trimmed.length > 50) {
                return res.status(400).json({ message: 'Brand must not exceed 50 characters' });
            }
            validatedBrand = trimmed.length > 0 ? trimmed : null;
        }

        // 7. Validate optional image_url
        const imgCheck = validateImageUrl(image_url);
        if (!imgCheck.valid) {
            return res.status(400).json({ message: imgCheck.error });
        }

        // 8. Validate optional is_available (defaults to true)
        let validatedIsAvailable = true;
        if (is_available !== undefined && is_available !== null) {
            if (typeof is_available === 'boolean') {
                validatedIsAvailable = is_available;
            } else if (is_available === 0 || is_available === 1) {
                validatedIsAvailable = Boolean(is_available);
            } else {
                return res.status(400).json({ message: 'is_available must be a boolean or 0/1' });
            }
        }

        // 9. Insert vehicle
        const [result] = await db.query(
            `INSERT INTO vehicles (
                category_id, name, brand, seating_capacity, transmission, price_per_day, is_available, image_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                categoryId,
                trimmedName,
                validatedBrand,
                seats,
                transmission,
                price,
                validatedIsAvailable,
                imgCheck.value
            ]
        );

        const newVehicleId = result.insertId;

        // 10. Fetch inserted record with joined category
        const [newRows] = await db.query(
            `SELECT
                v.vehicle_id,
                v.category_id,
                v.name,
                v.brand,
                v.seating_capacity,
                v.transmission,
                v.price_per_day,
                v.is_available,
                v.image_url,
                v.created_at,
                c.name AS category,
                0 AS total_bookings
            FROM vehicles v
            JOIN categories c ON v.category_id = c.category_id
            WHERE v.vehicle_id = ?`,
            [newVehicleId]
        );

        return res.status(201).json({
            message: 'Vehicle created successfully',
            vehicle: formatVehicleRow(newRows[0])
        });
    } catch (error) {
        console.error('Error creating vehicle:', error.message);
        return res.status(500).json({
            message: 'Failed to create vehicle'
        });
    }
};

/**
 * PUT /api/admin/vehicles/:id
 * Updates all specifications of an existing vehicle.
 */
const updateVehicle = async (req, res) => {
    try {
        const vehicleId = parsePositiveInt(req.params.id);
        if (!vehicleId) {
            return res.status(400).json({ message: 'Invalid vehicle ID: Must be a positive integer' });
        }

        // 1. Confirm vehicle exists
        const [existingRows] = await db.query(
            'SELECT vehicle_id, is_available FROM vehicles WHERE vehicle_id = ?',
            [vehicleId]
        );
        if (existingRows.length === 0) {
            return res.status(404).json({ message: 'Vehicle not found' });
        }

        const {
            name,
            category_id,
            brand,
            seating_capacity,
            transmission,
            price_per_day,
            image_url,
            is_available
        } = req.body;

        // 2. Validate required name
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ message: 'Name is required and cannot be empty' });
        }
        const trimmedName = name.trim();
        if (trimmedName.length > 100) {
            return res.status(400).json({ message: 'Name must not exceed 100 characters' });
        }

        // 3. Validate category_id
        const categoryId = parsePositiveInt(category_id);
        if (!categoryId) {
            return res.status(400).json({ message: 'Category ID is required and must be a positive integer' });
        }
        const [categoryRows] = await db.query(
            'SELECT category_id FROM categories WHERE category_id = ?',
            [categoryId]
        );
        if (categoryRows.length === 0) {
            return res.status(400).json({ message: 'Invalid category: Category does not exist' });
        }

        // 4. Validate seating_capacity
        const seats = parsePositiveInt(seating_capacity);
        if (!seats) {
            return res.status(400).json({ message: 'Seating capacity is required and must be a positive integer' });
        }

        // 5. Validate transmission
        if (!transmission || (transmission !== 'automatic' && transmission !== 'manual')) {
            return res.status(400).json({ message: 'Transmission must be either "automatic" or "manual"' });
        }

        // 6. Validate price_per_day
        const price = Number(price_per_day);
        if (isNaN(price) || !isFinite(price) || price <= 0) {
            return res.status(400).json({ message: 'Price per day is required and must be a finite positive number' });
        }

        // 7. Validate optional brand
        let validatedBrand = null;
        if (brand !== undefined && brand !== null) {
            if (typeof brand !== 'string') {
                return res.status(400).json({ message: 'Brand must be a string' });
            }
            const trimmed = brand.trim();
            if (trimmed.length > 50) {
                return res.status(400).json({ message: 'Brand must not exceed 50 characters' });
            }
            validatedBrand = trimmed.length > 0 ? trimmed : null;
        }

        // 8. Validate optional image_url
        const imgCheck = validateImageUrl(image_url);
        if (!imgCheck.valid) {
            return res.status(400).json({ message: imgCheck.error });
        }

        // 9. Validate optional is_available (retains current value if omitted)
        let validatedIsAvailable = Boolean(existingRows[0].is_available);
        if (is_available !== undefined && is_available !== null) {
            if (typeof is_available === 'boolean') {
                validatedIsAvailable = is_available;
            } else if (is_available === 0 || is_available === 1) {
                validatedIsAvailable = Boolean(is_available);
            } else {
                return res.status(400).json({ message: 'is_available must be a boolean or 0/1' });
            }
        }

        // 10. Update vehicle record
        await db.query(
            `UPDATE vehicles
            SET
                category_id = ?,
                name = ?,
                brand = ?,
                seating_capacity = ?,
                transmission = ?,
                price_per_day = ?,
                is_available = ?,
                image_url = ?
            WHERE vehicle_id = ?`,
            [
                categoryId,
                trimmedName,
                validatedBrand,
                seats,
                transmission,
                price,
                validatedIsAvailable,
                imgCheck.value,
                vehicleId
            ]
        );

        // 11. Fetch updated record with category and booking count
        const [updatedRows] = await db.query(
            `SELECT
                v.vehicle_id,
                v.category_id,
                v.name,
                v.brand,
                v.seating_capacity,
                v.transmission,
                v.price_per_day,
                v.is_available,
                v.image_url,
                v.created_at,
                c.name AS category,
                (SELECT COUNT(*) FROM bookings b WHERE b.vehicle_id = v.vehicle_id) AS total_bookings
            FROM vehicles v
            JOIN categories c ON v.category_id = c.category_id
            WHERE v.vehicle_id = ?`,
            [vehicleId]
        );

        return res.status(200).json({
            message: 'Vehicle updated successfully',
            vehicle: formatVehicleRow(updatedRows[0])
        });
    } catch (error) {
        console.error('Error updating vehicle:', error.message);
        return res.status(500).json({
            message: 'Failed to update vehicle'
        });
    }
};

/**
 * PATCH /api/admin/vehicles/:id/status
 * Updates only the is_available availability flag of a vehicle.
 */
const updateVehicleStatus = async (req, res) => {
    try {
        const vehicleId = parsePositiveInt(req.params.id);
        if (!vehicleId) {
            return res.status(400).json({ message: 'Invalid vehicle ID: Must be a positive integer' });
        }

        const { is_available } = req.body;

        // Must be an explicit boolean or numeric 0/1
        if (
            is_available === undefined ||
            is_available === null ||
            (typeof is_available !== 'boolean' && is_available !== 0 && is_available !== 1)
        ) {
            return res.status(400).json({
                message: 'is_available is required and must be an explicit boolean or 0/1'
            });
        }

        const newStatus = Boolean(is_available);

        // Confirm vehicle exists
        const [existing] = await db.query(
            'SELECT vehicle_id FROM vehicles WHERE vehicle_id = ?',
            [vehicleId]
        );
        if (existing.length === 0) {
            return res.status(404).json({ message: 'Vehicle not found' });
        }

        // Update availability status
        await db.query(
            'UPDATE vehicles SET is_available = ? WHERE vehicle_id = ?',
            [newStatus, vehicleId]
        );

        return res.status(200).json({
            message: 'Vehicle status updated successfully',
            vehicle_id: vehicleId,
            is_available: newStatus
        });
    } catch (error) {
        console.error('Error updating vehicle status:', error.message);
        return res.status(500).json({
            message: 'Failed to update vehicle status'
        });
    }
};

module.exports = {
    getAllVehicles,
    getCategories,
    createVehicle,
    updateVehicle,
    updateVehicleStatus
};
