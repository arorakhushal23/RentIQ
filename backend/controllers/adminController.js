const db = require('../config/db');

/**
 * Admin Controller
 *
 * File: backend/controllers/adminController.js
 * Handles administrative business logic and statistical calculations for RentIQ.
 */

/**
 * Retrieve high-level operational statistics for the Admin Dashboard.
 *
 * Metrics:
 * - totalVehicles: Total vehicle records in fleet.
 * - availableVehicles: Fleet vehicles currently flagged as available (is_available = true).
 * - totalCustomers: Registered users with the 'customer' role.
 * - totalBookings: Lifetime bookings count across all statuses.
 * - pendingBookings: Bookings awaiting review/confirmation.
 * - confirmedBookings: Confirmed upcoming/active bookings.
 * - completedBookings: Successfully concluded rentals.
 * - cancelledBookings: Cancelled bookings.
 * - totalRevenue: Aggregate monetary booking value from confirmed and completed bookings
 *                 (bookings.total_price). Note: This reflects provisional booking value,
 *                 not necessarily verified payment receipts, as payment gateway records
 *                 are not yet populated by the booking flow.
 */
const getDashboardStats = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                (SELECT COUNT(*) FROM vehicles) AS totalVehicles,
                (SELECT COUNT(*) FROM vehicles WHERE is_available = TRUE) AS availableVehicles,
                (SELECT COUNT(*) FROM users WHERE role = 'customer') AS totalCustomers,
                (SELECT COUNT(*) FROM bookings) AS totalBookings,
                (SELECT COUNT(*) FROM bookings WHERE status = 'pending') AS pendingBookings,
                (SELECT COUNT(*) FROM bookings WHERE status = 'confirmed') AS confirmedBookings,
                (SELECT COUNT(*) FROM bookings WHERE status = 'completed') AS completedBookings,
                (SELECT COUNT(*) FROM bookings WHERE status = 'cancelled') AS cancelledBookings,
                (SELECT COALESCE(SUM(total_price), 0) FROM bookings WHERE status IN ('confirmed', 'completed')) AS totalRevenue
        `);

        const statsRow = rows[0] || {};

        const stats = {
            totalVehicles: Number(statsRow.totalVehicles) || 0,
            availableVehicles: Number(statsRow.availableVehicles) || 0,
            totalCustomers: Number(statsRow.totalCustomers) || 0,
            totalBookings: Number(statsRow.totalBookings) || 0,
            pendingBookings: Number(statsRow.pendingBookings) || 0,
            confirmedBookings: Number(statsRow.confirmedBookings) || 0,
            completedBookings: Number(statsRow.completedBookings) || 0,
            cancelledBookings: Number(statsRow.cancelledBookings) || 0,
            totalRevenue: Number(statsRow.totalRevenue) || 0
        };

        return res.status(200).json({
            message: 'Dashboard statistics retrieved successfully',
            stats
        });
    } catch (error) {
        console.error('Error fetching dashboard statistics:', error.message);

        return res.status(500).json({
            message: 'Failed to retrieve dashboard statistics'
        });
    }
};

module.exports = {
    getDashboardStats
};
