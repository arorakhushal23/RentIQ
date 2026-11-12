const db = require('../config/db');
const { calculateDocumentStatus } = require('../utils/documentStatusHelper');
const {
    evaluateVehicleAvailability,
    batchEvaluateVehicleAvailability
} = require('../utils/vehicleAvailabilityHelper');

/**
 * Validates optional image URL input according to security policies
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

function parsePositiveInt(val) {
    if (val === undefined || val === null || val === '') return null;
    const num = Number(val);
    if (!Number.isInteger(num) || num <= 0) {
        return null;
    }
    return num;
}

/**
 * Formats a raw database row into consistent response types for administrator views
 */
function formatVehicleAdminRow(row) {
    const isOp = row.operational_is_available !== undefined
        ? Boolean(row.operational_is_available)
        : (row.is_available === true || row.is_available === 1 || row.is_available === '1');

    return {
        vehicle_id: row.vehicle_id,
        category_id: row.category_id,
        name: row.name,
        brand: row.brand,
        model: row.model,
        manufacturing_year: row.manufacturing_year ? Number(row.manufacturing_year) : null,
        vehicle_color: row.vehicle_color,
        registration_number: row.registration_number,
        registration_state: row.registration_state,
        registration_date: row.registration_date,
        registration_validity: row.registration_validity,
        fuel_type: row.fuel_type || 'petrol',
        mileage: row.mileage,
        engine_capacity: row.engine_capacity,
        description: row.description,
        engine_number: row.engine_number,
        chassis_number: row.chassis_number,
        vehicle_identification_number: row.vehicle_identification_number,
        doors: row.doors !== null && row.doors !== undefined ? Number(row.doors) : 4,
        boot_space: row.boot_space,
        max_passengers: row.max_passengers ? Number(row.max_passengers) : null,
        seating_capacity: Number(row.seating_capacity),
        transmission: row.transmission,
        price_per_day: Number(row.price_per_day),
        // Operational switch state (for activate/deactivate button)
        is_available: isOp,
        operational_is_available: isOp,
        operational_status: row.operational_status || (isOp ? 'active' : 'inactive'),
        // Unified Booking Eligibility
        booking_eligible: Boolean(row.booking_eligible !== undefined ? row.booking_eligible : isOp),
        availability_status: row.availability_status || (isOp ? 'available' : 'unavailable'),
        availability_code: row.availability_code || (isOp ? 'AVAILABLE' : 'VEHICLE_UNAVAILABLE'),
        availability_reason: row.availability_reason || (isOp ? 'Vehicle is operational and fully compliant' : 'Vehicle is manually deactivated'),
        customer_message: row.customer_message || (isOp ? 'Available for rental' : 'This vehicle is currently unavailable for rental.'),
        availability_badge: row.availability_badge || {
            text: isOp ? 'Available' : 'Unavailable',
            variant: isOp ? 'success' : 'danger',
            className: isOp ? 'is-available' : 'is-unavailable'
        },
        compliance: row.compliance,
        image_url: row.image_url,
        created_at: row.created_at,
        category: row.category,
        total_bookings: Number(row.total_bookings) || 0,
        total_documents: Number(row.total_documents) || 0,
        expired_documents: Number(row.expired_documents) || 0
    };
}

/**
 * GET /api/admin/vehicles
 * Returns all vehicles with search and filter capabilities
 */
const getAllVehicles = async (req, res) => {
    try {
        const { search, category, fuelType, status } = req.query;
        const conditions = [];
        const params = [];

        if (search && search.trim()) {
            const q = `%${search.trim().toLowerCase()}%`;
            conditions.push('(LOWER(v.name) LIKE ? OR LOWER(v.brand) LIKE ? OR LOWER(c.name) LIKE ? OR LOWER(COALESCE(v.registration_number, "")) LIKE ? OR LOWER(COALESCE(v.model, "")) LIKE ?)');
            params.push(q, q, q, q, q);
        }

        if (category && category !== 'all') {
            conditions.push('LOWER(c.name) = LOWER(?)');
            params.push(category.trim());
        }

        if (fuelType && fuelType !== 'all') {
            conditions.push('v.fuel_type = ?');
            params.push(fuelType.toLowerCase());
        }

        const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const [rows] = await db.query(`
            SELECT
                v.vehicle_id,
                v.category_id,
                v.name,
                v.brand,
                v.model,
                v.manufacturing_year,
                v.vehicle_color,
                v.registration_number,
                v.registration_state,
                v.registration_date,
                v.registration_validity,
                v.fuel_type,
                v.mileage,
                v.engine_capacity,
                v.description,
                v.engine_number,
                v.chassis_number,
                v.vehicle_identification_number,
                v.doors,
                v.boot_space,
                v.max_passengers,
                v.seating_capacity,
                v.transmission,
                v.price_per_day,
                v.is_available,
                v.image_url,
                v.created_at,
                c.name AS category,
                (SELECT COUNT(*) FROM bookings b WHERE b.vehicle_id = v.vehicle_id) AS total_bookings,
                (SELECT COUNT(*) FROM vehicle_documents vd WHERE vd.vehicle_id = v.vehicle_id) AS total_documents,
                (SELECT COUNT(*) FROM vehicle_documents vd WHERE vd.vehicle_id = v.vehicle_id AND (vd.expiry_date < CURRENT_DATE OR vd.verification_status IN ('expired', 'rejected'))) AS expired_documents
            FROM vehicles v
            JOIN categories c ON v.category_id = c.category_id
            ${whereSql}
            ORDER BY v.vehicle_id DESC
        `, params);

        // Evaluate actual booking eligibility across the entire fleet using unified helper
        const evaluatedRows = await batchEvaluateVehicleAvailability(rows);

        // Filter by unified availability status if requested
        let filtered = evaluatedRows;
        if (status && status !== 'all') {
            const sLower = status.toLowerCase();
            if (sLower === 'available') {
                filtered = evaluatedRows.filter(v => v.availability_status === 'available');
            } else if (sLower === 'compliance_required') {
                filtered = evaluatedRows.filter(v => v.availability_status === 'compliance_required');
            } else if (sLower === 'under_maintenance' || sLower === 'maintenance') {
                filtered = evaluatedRows.filter(v => v.availability_status === 'under_maintenance');
            } else if (sLower === 'unavailable') {
                filtered = evaluatedRows.filter(v => v.availability_status === 'unavailable');
            }
        }

        const vehicles = filtered.map(formatVehicleAdminRow);
        return res.status(200).json(vehicles);
    } catch (error) {
        console.error('Error fetching admin vehicles:', error.message);
        return res.status(500).json({
            message: 'Failed to fetch vehicles'
        });
    }
};

/**
 * GET /api/admin/vehicles/:id
 * Returns single vehicle complete details including sensitive numbers and documents
 */
const getVehicleByIdAdmin = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ message: 'Invalid vehicle ID' });
        }

        const [rows] = await db.query(`
            SELECT
                v.*,
                c.name AS category
            FROM vehicles v
            JOIN categories c ON v.category_id = c.category_id
            WHERE v.vehicle_id = ?
        `, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Vehicle not found' });
        }

        const vehicle = rows[0];

        // Fetch documents
        const [docs] = await db.query(
            'SELECT * FROM vehicle_documents WHERE vehicle_id = ? ORDER BY expiry_date ASC',
            [id]
        );

        const documents = docs.map(d => {
            const { status, daysRemaining } = calculateDocumentStatus(d.expiry_date, d.verification_status);
            return {
                ...d,
                calculated_status: status,
                days_remaining: daysRemaining
            };
        });

        // Evaluate availability using central helper
        const availability = await evaluateVehicleAvailability(vehicle, { documents: docs });

        return res.status(200).json({
            ...formatVehicleAdminRow({
                ...vehicle,
                operational_is_available: availability.operationalStatus === 'active',
                booking_eligible: availability.bookingEligible,
                availability_status: availability.availabilityStatus,
                availability_code: availability.statusCode,
                availability_reason: availability.displayReason,
                customer_message: availability.customerMessage,
                availability_badge: availability.badge,
                compliance: availability.compliance
            }),
            documents,
            availability
        });
    } catch (error) {
        console.error('Error fetching vehicle by id admin:', error);
        return res.status(500).json({ message: 'Failed to fetch vehicle details' });
    }
};

/**
 * GET /api/admin/categories
 */
const getCategories = async (req, res) => {
    try {
        const [categories] = await db.query(
            `SELECT category_id, name FROM categories
             ORDER BY CASE name
                 WHEN 'SUV' THEN 1
                 WHEN 'Sedan' THEN 2
                 WHEN 'Hatchback' THEN 3
                 WHEN 'MUV' THEN 4
                 WHEN 'Luxury' THEN 5
                 WHEN 'Sports' THEN 6
                 WHEN 'Other' THEN 7
                 ELSE 8
             END, name ASC`
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
 * Helper to validate vehicle payload
 */
async function validateVehiclePayload(body, vehicleId = null) {
    const {
        name,
        category_id,
        brand,
        model,
        manufacturing_year,
        vehicle_color,
        registration_number,
        registration_state,
        registration_date,
        registration_validity,
        fuel_type,
        mileage,
        engine_capacity,
        description,
        engine_number,
        chassis_number,
        vehicle_identification_number,
        doors,
        boot_space,
        max_passengers,
        seating_capacity,
        transmission,
        price_per_day,
        image_url,
        is_available
    } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
        return { valid: false, error: 'Vehicle name is required' };
    }
    const trimmedName = name.trim();
    if (trimmedName.length > 100) {
        return { valid: false, error: 'Vehicle name must not exceed 100 characters' };
    }

    const categoryId = parsePositiveInt(category_id);
    if (!categoryId) {
        return { valid: false, error: 'Category ID is required and must be a positive integer' };
    }
    const [catRows] = await db.query('SELECT category_id FROM categories WHERE category_id = ?', [categoryId]);
    if (catRows.length === 0) {
        return { valid: false, error: 'Category does not exist' };
    }

    const seats = parsePositiveInt(seating_capacity);
    if (!seats) {
        return { valid: false, error: 'Seating capacity is required and must be a positive whole number' };
    }

    if (!transmission || (transmission !== 'automatic' && transmission !== 'manual')) {
        return { valid: false, error: 'Transmission must be either "automatic" or "manual"' };
    }

    const price = Number(price_per_day);
    if (isNaN(price) || !isFinite(price) || price <= 0) {
        return { valid: false, error: 'Price per day must be a positive number' };
    }

    // Check registration number uniqueness if provided
    let regNo = null;
    if (registration_number && typeof registration_number === 'string' && registration_number.trim()) {
        regNo = registration_number.trim().toUpperCase();
        let dupQuery = 'SELECT vehicle_id FROM vehicles WHERE UPPER(registration_number) = ?';
        const dupParams = [regNo];
        if (vehicleId) {
            dupQuery += ' AND vehicle_id != ?';
            dupParams.push(vehicleId);
        }
        const [dupRows] = await db.query(dupQuery, dupParams);
        if (dupRows.length > 0) {
            return { valid: false, error: `Registration number "${regNo}" is already assigned to vehicle #${dupRows[0].vehicle_id}` };
        }
    }

    const imgCheck = validateImageUrl(image_url);
    if (!imgCheck.valid) {
        return { valid: false, error: imgCheck.error };
    }

    const validFuels = ['petrol', 'diesel', 'electric', 'hybrid', 'cng'];
    const safeFuel = fuel_type && validFuels.includes(fuel_type.toLowerCase()) ? fuel_type.toLowerCase() : 'petrol';

    let validatedIsAvailable = true;
    if (is_available !== undefined && is_available !== null) {
        if (typeof is_available === 'boolean') {
            validatedIsAvailable = is_available;
        } else if (is_available === 0 || is_available === 1 || is_available === '1' || is_available === '0') {
            validatedIsAvailable = Boolean(Number(is_available));
        }
    }

    return {
        valid: true,
        data: {
            name: trimmedName,
            category_id: categoryId,
            brand: brand ? brand.trim() : null,
            model: model ? model.trim() : null,
            manufacturing_year: manufacturing_year ? Number(manufacturing_year) : null,
            vehicle_color: vehicle_color ? vehicle_color.trim() : null,
            registration_number: regNo,
            registration_state: registration_state ? registration_state.trim() : null,
            registration_date: registration_date || null,
            registration_validity: registration_validity || null,
            fuel_type: safeFuel,
            mileage: mileage ? mileage.trim() : null,
            engine_capacity: engine_capacity ? engine_capacity.trim() : null,
            description: description ? description.trim() : null,
            engine_number: engine_number ? engine_number.trim() : null,
            chassis_number: chassis_number ? chassis_number.trim() : null,
            vehicle_identification_number: vehicle_identification_number ? vehicle_identification_number.trim() : null,
            doors: doors ? Number(doors) : 4,
            boot_space: boot_space ? boot_space.trim() : null,
            max_passengers: max_passengers ? Number(max_passengers) : seats,
            seating_capacity: seats,
            transmission,
            price_per_day: price,
            image_url: imgCheck.value,
            is_available: validatedIsAvailable
        }
    };
}

/**
 * POST /api/admin/vehicles
 */
const createVehicle = async (req, res) => {
    try {
        const check = await validateVehiclePayload(req.body);
        if (!check.valid) {
            return res.status(400).json({ message: check.error });
        }
        const d = check.data;

        const [result] = await db.query(`
            INSERT INTO vehicles (
                name, category_id, brand, model, manufacturing_year, vehicle_color,
                registration_number, registration_state, registration_date, registration_validity,
                fuel_type, mileage, engine_capacity, description, engine_number, chassis_number,
                vehicle_identification_number, doors, boot_space, max_passengers,
                seating_capacity, transmission, price_per_day, image_url, is_available
            ) VALUES (
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?, ?
            )
        `, [
            d.name, d.category_id, d.brand, d.model, d.manufacturing_year, d.vehicle_color,
            d.registration_number, d.registration_state, d.registration_date, d.registration_validity,
            d.fuel_type, d.mileage, d.engine_capacity, d.description, d.engine_number, d.chassis_number,
            d.vehicle_identification_number, d.doors, d.boot_space, d.max_passengers,
            d.seating_capacity, d.transmission, d.price_per_day, d.image_url, d.is_available
        ]);

        const [createdRows] = await db.query(`
            SELECT v.*, c.name AS category
            FROM vehicles v
            JOIN categories c ON v.category_id = c.category_id
            WHERE v.vehicle_id = ?
        `, [result.insertId]);

        return res.status(201).json({
            message: 'Vehicle created successfully',
            vehicle: formatVehicleAdminRow(createdRows[0])
        });
    } catch (error) {
        console.error('Error creating vehicle:', error);
        return res.status(500).json({ message: 'Failed to create vehicle' });
    }
};

/**
 * PUT /api/admin/vehicles/:id
 */
const updateVehicle = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ message: 'Invalid vehicle ID' });
        }

        const [existing] = await db.query('SELECT vehicle_id FROM vehicles WHERE vehicle_id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ message: 'Vehicle not found' });
        }

        const check = await validateVehiclePayload(req.body, id);
        if (!check.valid) {
            return res.status(400).json({ message: check.error });
        }
        const d = check.data;

        await db.query(`
            UPDATE vehicles SET
                name = ?, category_id = ?, brand = ?, model = ?, manufacturing_year = ?, vehicle_color = ?,
                registration_number = ?, registration_state = ?, registration_date = ?, registration_validity = ?,
                fuel_type = ?, mileage = ?, engine_capacity = ?, description = ?, engine_number = ?, chassis_number = ?,
                vehicle_identification_number = ?, doors = ?, boot_space = ?, max_passengers = ?,
                seating_capacity = ?, transmission = ?, price_per_day = ?, image_url = ?, is_available = ?
            WHERE vehicle_id = ?
        `, [
            d.name, d.category_id, d.brand, d.model, d.manufacturing_year, d.vehicle_color,
            d.registration_number, d.registration_state, d.registration_date, d.registration_validity,
            d.fuel_type, d.mileage, d.engine_capacity, d.description, d.engine_number, d.chassis_number,
            d.vehicle_identification_number, d.doors, d.boot_space, d.max_passengers,
            d.seating_capacity, d.transmission, d.price_per_day, d.image_url, d.is_available,
            id
        ]);

        const [updatedRows] = await db.query(`
            SELECT v.*, c.name AS category
            FROM vehicles v
            JOIN categories c ON v.category_id = c.category_id
            WHERE v.vehicle_id = ?
        `, [id]);

        return res.status(200).json({
            message: 'Vehicle updated successfully',
            vehicle: formatVehicleAdminRow(updatedRows[0])
        });
    } catch (error) {
        console.error('Error updating vehicle:', error);
        return res.status(500).json({ message: 'Failed to update vehicle' });
    }
};

/**
 * PATCH /api/admin/vehicles/:id/status
 */
const updateVehicleStatus = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ message: 'Invalid vehicle ID' });
        }

        const [existing] = await db.query('SELECT vehicle_id, is_available FROM vehicles WHERE vehicle_id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ message: 'Vehicle not found' });
        }

        const currentAvailable = Boolean(existing[0].is_available);
        const newAvailable = req.body.is_available !== undefined ? Boolean(req.body.is_available) : !currentAvailable;

        await db.query('UPDATE vehicles SET is_available = ? WHERE vehicle_id = ?', [newAvailable, id]);

        return res.status(200).json({
            message: `Vehicle marked as ${newAvailable ? 'available' : 'unavailable'}`,
            vehicle_id: id,
            is_available: newAvailable
        });
    } catch (error) {
        console.error('Error toggling vehicle status:', error);
        return res.status(500).json({ message: 'Failed to update vehicle availability' });
    }
};

module.exports = {
    getAllVehicles,
    getVehicleByIdAdmin,
    getCategories,
    createVehicle,
    updateVehicle,
    updateVehicleStatus
};
