const db = require('../config/db');
const { calculateDocumentStatus } = require('../utils/documentStatusHelper');

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
        is_available: Boolean(v.is_available),
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

        // Search by vehicle name, brand, or registration number
        if (req.query.search && typeof req.query.search === 'string' && req.query.search.trim()) {
            conditions.push('(LOWER(v.name) LIKE ? OR LOWER(v.brand) LIKE ? OR LOWER(COALESCE(v.registration_number, "")) LIKE ?)');
            const searchTerm = `%${req.query.search.trim().toLowerCase()}%`;
            params.push(searchTerm, searchTerm, searchTerm);
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

            return res.status(200).json({
                vehicles: vehicles.map(formatPublicVehicle),
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

        return res.status(200).json(vehicles.map(formatPublicVehicle));
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

        const vehicle = formatPublicVehicle(vehicles[0]);

        // Compute high-level public compliance status without exposing private document numbers or files
        const [docs] = await db.query(
            'SELECT document_type, expiry_date, verification_status FROM vehicle_documents WHERE vehicle_id = ?',
            [id]
        );

        let rcValid = false;
        let insuranceValid = false;
        let pucValid = false;
        let commercialFitnessValid = false;

        for (const doc of docs) {
            const { status } = calculateDocumentStatus(doc.expiry_date, doc.verification_status);
            const isValidOrSoon = status === 'valid' || status === 'expiring_soon';
            if (doc.document_type === 'rc' && isValidOrSoon) rcValid = true;
            if (doc.document_type === 'insurance' && isValidOrSoon) insuranceValid = true;
            if (doc.document_type === 'puc' && isValidOrSoon) pucValid = true;
            if (doc.document_type === 'fitness' && isValidOrSoon) commercialFitnessValid = true;
        }

        const compliance = {
            rc_verified: rcValid,
            insurance_active: insuranceValid,
            puc_certified: pucValid,
            commercial_fitness: commercialFitnessValid,
            all_mandatory_compliant: rcValid && insuranceValid && pucValid
        };

        // Check active ongoing maintenance
        const [activeMaint] = await db.query(
            `SELECT id, maintenance_category FROM vehicle_maintenance
             WHERE vehicle_id = ?
               AND (status = 'in_progress' OR (status = 'scheduled' AND start_date <= CURDATE() AND (end_date IS NULL OR end_date >= CURDATE())))
             LIMIT 1`,
            [id]
        );

        const isCompliant = compliance.all_mandatory_compliant;
        const hasOngoingMaintenance = activeMaint.length > 0;
        const isCurrentlyAvailable = Boolean(vehicle.is_available) && isCompliant && !hasOngoingMaintenance;

        let unavailabilityReason = null;
        let unavailabilityCode = null;

        if (!vehicle.is_available) {
            unavailabilityReason = 'This vehicle is currently unavailable for rental. Please choose another vehicle.';
            unavailabilityCode = 'VEHICLE_UNAVAILABLE';
        } else if (hasOngoingMaintenance) {
            unavailabilityReason = `This vehicle is temporarily unavailable due to ongoing ${activeMaint[0].maintenance_category}. Please choose another vehicle.`;
            unavailabilityCode = 'VEHICLE_UNDER_MAINTENANCE';
        } else if (!isCompliant) {
            unavailabilityReason = 'This vehicle is temporarily unavailable due to routine compliance maintenance. Please choose another vehicle.';
            unavailabilityCode = 'VEHICLE_COMPLIANCE_HOLD';
        }

        return res.status(200).json({
            ...vehicle,
            is_available: isCurrentlyAvailable,
            unavailability_reason: unavailabilityReason,
            unavailability_code: unavailabilityCode,
            compliance
        });
    } catch (error) {
        console.error('Error fetching vehicle:', error.message);
        return res.status(500).json({
            message: 'Failed to fetch vehicle'
        });
    }
};

module.exports = {
    getVehicles,
    getVehicleById
};
