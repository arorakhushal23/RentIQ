const db = require('../config/db');

const getVehicles = async (req, res) => {
    try {
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
            WHERE v.is_available = TRUE
            ORDER BY v.vehicle_id
        `);

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