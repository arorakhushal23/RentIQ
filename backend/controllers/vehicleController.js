const db = require('../config/db');

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

        // Search by vehicle name or brand
        if (req.query.search && typeof req.query.search === 'string' && req.query.search.trim()) {
            conditions.push('(LOWER(v.name) LIKE ? OR LOWER(v.brand) LIKE ?)');
            const searchTerm = `%${req.query.search.trim().toLowerCase()}%`;
            params.push(searchTerm, searchTerm);
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
            // Count query for total matching records
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
                    v.name,
                    v.brand,
                    c.name AS category,
                    v.seating_capacity,
                    v.transmission,
                    v.price_per_day,
                    v.is_available,
                    v.image_url
                FROM vehicles v
                JOIN categories c
                    ON v.category_id = c.category_id
                ${whereClause}
                ${orderByClause}
                LIMIT ? OFFSET ?
            `;

            // Note: MySQL requires numeric limit/offset values
            const [vehicles] = await db.query(dataQuery, [...params, limit, offset]);

            return res.status(200).json({
                vehicles,
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

        // Backwards compatibility: return array directly if pagination params are omitted
        const [vehicles] = await db.query(`
            SELECT
                v.vehicle_id,
                v.name,
                v.brand,
                c.name AS category,
                v.seating_capacity,
                v.transmission,
                v.price_per_day,
                v.is_available,
                v.image_url
            FROM vehicles v
            JOIN categories c
                ON v.category_id = c.category_id
            ${whereClause}
            ${orderByClause}
        `, params);

        res.status(200).json(vehicles);

    } catch (error) {
        console.error('Error fetching vehicles:', error.message);

        res.status(500).json({
            message: 'Failed to fetch vehicles'
        });
    }
};
const getVehicleById = async (req, res) => {
    try {
        const { id } = req.params;

        const [vehicles] = await db.query(
            `
            SELECT
                v.vehicle_id,
                v.name,
                v.brand,
                c.name AS category,
                v.seating_capacity,
                v.transmission,
                v.price_per_day,
                v.is_available,
                v.image_url
            FROM vehicles v
            JOIN categories c
                ON v.category_id = c.category_id
            WHERE v.vehicle_id = ?
            `,
            [id]
        );

        if (vehicles.length === 0) {
            return res.status(404).json({
                message: 'Vehicle not found'
            });
        }

        res.status(200).json(vehicles[0]);

    } catch (error) {
        console.error('Error fetching vehicle:', error.message);

        res.status(500).json({
            message: 'Failed to fetch vehicle'
        });
    }
};

module.exports = {
    getVehicles,
    getVehicleById
};