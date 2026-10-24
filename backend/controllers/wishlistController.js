const db = require('../config/db');

/**
 * Get current customer's wishlist with full vehicle and category details
 * GET /api/wishlist
 */
exports.getWishlist = async (req, res) => {
    try {
        const userId = req.user.user_id;

        const [wishlistItems] = await db.query(
            `SELECT 
                w.user_id,
                w.vehicle_id,
                w.added_at,
                v.name,
                v.brand,
                v.seating_capacity,
                v.transmission,
                v.price_per_day,
                v.is_available,
                v.image_url,
                c.category_id,
                c.name AS category
             FROM wishlist w
             JOIN vehicles v ON w.vehicle_id = v.vehicle_id
             JOIN categories c ON v.category_id = c.category_id
             WHERE w.user_id = ?
             ORDER BY w.added_at DESC`,
            [userId]
        );

        return res.status(200).json({
            success: true,
            count: wishlistItems.length,
            data: wishlistItems
        });
    } catch (error) {
        console.error('Error fetching wishlist:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve wishlist',
            error: error.message
        });
    }
};

/**
 * Add a vehicle to current customer's wishlist
 * POST /api/wishlist or POST /api/wishlist/:vehicleId
 */
exports.addToWishlist = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const rawId = req.params.vehicleId || req.body.vehicleId || req.body.vehicle_id;
        const vehicleId = parseInt(rawId, 10);

        if (!vehicleId || isNaN(vehicleId) || vehicleId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid vehicle ID provided'
            });
        }

        // Verify vehicle exists in catalog
        const [vehicles] = await db.query(
            'SELECT vehicle_id, name, brand FROM vehicles WHERE vehicle_id = ?',
            [vehicleId]
        );

        if (vehicles.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Vehicle not found'
            });
        }

        // Insert into wishlist (using INSERT IGNORE or ON DUPLICATE KEY UPDATE to handle concurrency safely)
        const [result] = await db.query(
            `INSERT INTO wishlist (user_id, vehicle_id, added_at)
             VALUES (?, ?, CURRENT_TIMESTAMP)
             ON DUPLICATE KEY UPDATE added_at = CURRENT_TIMESTAMP`,
            [userId, vehicleId]
        );

        const isNew = result.affectedRows === 1;

        return res.status(isNew ? 201 : 200).json({
            success: true,
            message: isNew ? 'Vehicle added to wishlist' : 'Vehicle already in wishlist',
            vehicle_id: vehicleId,
            vehicle: vehicles[0]
        });
    } catch (error) {
        console.error('Error adding to wishlist:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to add vehicle to wishlist',
            error: error.message
        });
    }
};

/**
 * Remove a vehicle from current customer's wishlist
 * DELETE /api/wishlist/:vehicleId
 */
exports.removeFromWishlist = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const rawId = req.params.vehicleId || req.body.vehicleId || req.body.vehicle_id;
        const vehicleId = parseInt(rawId, 10);

        if (!vehicleId || isNaN(vehicleId) || vehicleId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid vehicle ID provided'
            });
        }

        const [result] = await db.query(
            'DELETE FROM wishlist WHERE user_id = ? AND vehicle_id = ?',
            [userId, vehicleId]
        );

        if (result.affectedRows === 0) {
            return res.status(200).json({
                success: true,
                message: 'Vehicle was not in wishlist',
                vehicle_id: vehicleId
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Vehicle removed from wishlist',
            vehicle_id: vehicleId
        });
    } catch (error) {
        console.error('Error removing from wishlist:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to remove vehicle from wishlist',
            error: error.message
        });
    }
};
