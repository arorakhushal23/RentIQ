const db = require('../config/db');
const { calculateDocumentStatus } = require('../utils/documentStatusHelper');
const {
    evaluateVehicleAvailability,
    batchEvaluateVehicleAvailability
} = require('../utils/vehicleAvailabilityHelper');

/**
 * Formats a public vehicle record, stripping sensitive admin-only fields
 */
function formatPublicVehicle(v) {
    return {
        vehicle_id: v.vehicle_id,
        category_id: v.category_id,
        name: v.name,
        brand: v.brand,
        model: v.model,
        category: v.category,
        seating_capacity: Number(v.seating_capacity),
        transmission: v.transmission,
        price_per_day: Number(v.price_per_day),
        is_available: Boolean(v.booking_eligible !== undefined ? v.booking_eligible : v.is_available),
        operational_is_available: Boolean(v.operational_is_available !== undefined ? v.operational_is_available : v.is_available),
        operational_status: v.operational_status || (v.is_available ? 'active' : 'inactive'),
        booking_eligible: Boolean(v.booking_eligible !== undefined ? v.booking_eligible : v.is_available),
        availability_status: v.availability_status || (v.is_available ? 'available' : 'unavailable'),
        availability_code: v.availability_code || null,
        availability_reason: v.availability_reason || null,
        customer_message: v.customer_message || (v.is_available ? 'Available for rental' : 'This vehicle is currently unavailable for rental.'),
        availability_badge: v.availability_badge || {
            text: v.is_available ? 'Available' : 'Unavailable',
            variant: v.is_available ? 'success' : 'danger'
        },
        compliance: v.compliance || null,
        image_url: v.image_url,
        manufacturing_year: v.manufacturing_year ? Number(v.manufacturing_year) : null,
        vehicle_color: v.vehicle_color,
        registration_number: v.registration_number,
        registration_state: v.registration_state,
        registration_validity: v.registration_validity,
        fuel_type: v.fuel_type || 'petrol',
        mileage: v.mileage,
        engine_capacity: v.engine_capacity,
        description: v.description,
        doors: v.doors !== null && v.doors !== undefined ? Number(v.doors) : 4,
        boot_space: v.boot_space,
        max_passengers: v.max_passengers ? Number(v.max_passengers) : Number(v.seating_capacity)
    };
}

const getVehicles = async (req, res) => {
    try {
        const conditions = [];
        const params = [];

        // Availability filter: default to available only unless explicitly requested
        const availability = req.query.availability;
        if (availability === 'unavailable') {
            conditions.push('v.is_available = FALSE');
        } else if (availability === 'all') {
            // no availability constraint
        } else {
            conditions.push('v.is_available = TRUE');
        }

        // Search by vehicle name, brand, category, or registration number
        if (req.query.search && typeof req.query.search === 'string' && req.query.search.trim()) {
            conditions.push('(LOWER(v.name) LIKE ? OR LOWER(v.brand) LIKE ? OR LOWER(c.name) LIKE ? OR LOWER(COALESCE(v.registration_number, "")) LIKE ?)');
            const searchTerm = `%${req.query.search.trim().toLowerCase()}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        // Filter by category
        if (req.query.category && typeof req.query.category === 'string' && req.query.category.toLowerCase() !== 'all') {
            conditions.push('LOWER(c.name) = LOWER(?)');
            params.push(req.query.category.trim());
        }

        // Filter by transmission
        if (req.query.transmission && typeof req.query.transmission === 'string' && req.query.transmission.toLowerCase() !== 'all') {
            conditions.push('LOWER(v.transmission) = LOWER(?)');
            params.push(req.query.transmission.trim());
        }

        // Filter by fuel type
        const fuelType = req.query.fuelType || req.query.fuel_type;
        if (fuelType && typeof fuelType === 'string' && fuelType.toLowerCase() !== 'all') {
            conditions.push('LOWER(v.fuel_type) = LOWER(?)');
            params.push(fuelType.trim());
        }

        // Filter by seating capacity
        if (req.query.seats && req.query.seats !== 'all' && !isNaN(Number(req.query.seats))) {
            conditions.push('v.seating_capacity = ?');
            params.push(Number(req.query.seats));
        }

        // Filter by price range
        if (req.query.minPrice !== undefined && req.query.minPrice !== '' && !isNaN(Number(req.query.minPrice))) {
            conditions.push('v.price_per_day >= ?');
            params.push(Number(req.query.minPrice));
        }

        if (req.query.maxPrice !== undefined && req.query.maxPrice !== '' && !isNaN(Number(req.query.maxPrice))) {
            conditions.push('v.price_per_day <= ?');
            params.push(Number(req.query.maxPrice));
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Sorting
        let orderByClause = 'ORDER BY v.vehicle_id ASC';
        const sortBy = req.query.sortBy;
        if (sortBy === 'price-low') {
            orderByClause = 'ORDER BY v.price_per_day ASC, v.vehicle_id ASC';
        } else if (sortBy === 'price-high') {
            orderByClause = 'ORDER BY v.price_per_day DESC, v.vehicle_id ASC';
        } else if (sortBy === 'name-asc') {
            orderByClause = 'ORDER BY v.name ASC, v.vehicle_id ASC';
        }

        const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;

        if (isPaginated) {
            const countQuery = `
                SELECT COUNT(*) AS total
                FROM vehicles v
                JOIN categories c ON v.category_id = c.category_id
                ${whereClause}
            `;
            const [countResult] = await db.query(countQuery, params);
            const totalItems = countResult[0]?.total || 0;

            const requestedPage = parseInt(req.query.page, 10);
            const requestedLimit = parseInt(req.query.limit, 10);

            const limit = !isNaN(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 100) : 12;
            const totalPages = Math.max(1, Math.ceil(totalItems / limit));
            const page = !isNaN(requestedPage) && requestedPage > 0 ? requestedPage : 1;
            const offset = (page - 1) * limit;

            const dataQuery = `
                SELECT
                    v.vehicle_id,
                    v.category_id,
                    v.name,
                    v.brand,
                    v.model,
                    c.name AS category,
                    v.seating_capacity,
                    v.transmission,
                    v.price_per_day,
                    v.is_available,
                    v.image_url,
                    v.manufacturing_year,
                    v.vehicle_color,
                    v.registration_number,
                    v.registration_state,
                    v.registration_validity,
                    v.fuel_type,
                    v.mileage,
                    v.engine_capacity,
                    v.description,
                    v.doors,
                    v.boot_space,
                    v.max_passengers
                FROM vehicles v
                JOIN categories c ON v.category_id = c.category_id
                ${whereClause}
                ${orderByClause}
                LIMIT ? OFFSET ?
            `;

            const [vehicles] = await db.query(dataQuery, [...params, limit, offset]);
            const evaluatedVehicles = await batchEvaluateVehicleAvailability(vehicles);

            return res.status(200).json({
                vehicles: evaluatedVehicles.map(formatPublicVehicle),
                pagination: {
                    totalItems,
                    totalPages,
                    currentPage: page,
                    limit,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            });
        }

        const [vehicles] = await db.query(`
            SELECT
                v.vehicle_id,
                v.category_id,
                v.name,
                v.brand,
                v.model,
                c.name AS category,
                v.seating_capacity,
                v.transmission,
                v.price_per_day,
                v.is_available,
                v.image_url,
                v.manufacturing_year,
                v.vehicle_color,
                v.registration_number,
                v.registration_state,
                v.registration_validity,
                v.fuel_type,
                v.mileage,
                v.engine_capacity,
                v.description,
                v.doors,
                v.boot_space,
                v.max_passengers
            FROM vehicles v
            JOIN categories c ON v.category_id = c.category_id
            ${whereClause}
            ${orderByClause}
        `, params);

        const evaluatedVehicles = await batchEvaluateVehicleAvailability(vehicles);
        return res.status(200).json(evaluatedVehicles.map(formatPublicVehicle));
    } catch (error) {
        console.error('Error fetching vehicles:', error.message);
        return res.status(500).json({
            message: 'Failed to fetch vehicles'
        });
    }
};

const getVehicleById = async (req, res) => {
    try {
        const { id } = req.params;

        // Fetch vehicle with all public fields. EXCLUDE engine_number, chassis_number, VIN
        const [vehicles] = await db.query(`
            SELECT
                v.vehicle_id,
                v.category_id,
                v.name,
                v.brand,
                v.model,
                c.name AS category,
                v.seating_capacity,
                v.transmission,
                v.price_per_day,
                v.is_available,
                v.image_url,
                v.manufacturing_year,
                v.vehicle_color,
                v.registration_number,
                v.registration_state,
                v.registration_validity,
                v.fuel_type,
                v.mileage,
                v.engine_capacity,
                v.description,
                v.doors,
                v.boot_space,
                v.max_passengers
            FROM vehicles v
            JOIN categories c ON v.category_id = c.category_id
            WHERE v.vehicle_id = ?
        `, [id]);

        if (vehicles.length === 0) {
            return res.status(404).json({
                message: 'Vehicle not found'
            });
        }

        const rawVehicle = vehicles[0];
        const evalResult = await evaluateVehicleAvailability(rawVehicle);

        const vehicle = formatPublicVehicle({
            ...rawVehicle,
            booking_eligible: evalResult.bookingEligible,
            operational_status: evalResult.operationalStatus,
            operational_is_available: evalResult.operationalIsAvailable,
            availability_status: evalResult.availabilityStatus,
            availability_code: evalResult.statusCode,
            availability_reason: evalResult.displayReason,
            customer_message: evalResult.customerMessage,
            availability_badge: evalResult.badge,
            compliance: evalResult.compliance
        });

        return res.status(200).json({
            ...vehicle,
            is_available: evalResult.bookingEligible,
            booking_eligible: evalResult.bookingEligible,
            availability_status: evalResult.availabilityStatus,
            availability_code: evalResult.statusCode,
            unavailability_reason: evalResult.customerMessage,
            unavailability_code: evalResult.statusCode,
            compliance: evalResult.compliance,
            maintenance: evalResult.maintenance
        });
    } catch (error) {
        console.error('Error fetching vehicle:', error.message);
        return res.status(500).json({
            message: 'Failed to fetch vehicle'
        });
    }
};

/**
 * Public: Get all vehicle categories
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

module.exports = {
    getVehicles,
    getVehicleById,
    getCategories
};
