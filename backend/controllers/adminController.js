const db = require('../config/db');

/**
 * Admin Controller
 *
 * File: backend/controllers/adminController.js
 * Handles administrative business logic and statistical calculations for RentIQ.
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
                (SELECT COUNT(*) FROM bookings WHERE status = 'active') AS activeBookings,
                (SELECT COUNT(*) FROM bookings WHERE status = 'completed') AS completedBookings,
                (SELECT COUNT(*) FROM bookings WHERE status = 'cancelled') AS cancelledBookings,
                (SELECT COALESCE(SUM(total_price), 0) FROM bookings WHERE status IN ('confirmed', 'active', 'completed')) AS totalRevenue,
                (SELECT COUNT(*) FROM customer_licenses WHERE verification_status = 'pending') AS pendingLicenses,
                (SELECT COUNT(*) FROM customer_licenses WHERE verification_status = 'verified' AND expiry_date >= CURRENT_DATE) AS verifiedLicenses,
                (SELECT COUNT(*) FROM customer_licenses WHERE verification_status = 'rejected') AS rejectedLicenses,
                (SELECT COUNT(*) FROM customer_licenses WHERE expiry_date < CURRENT_DATE) AS expiredLicenses,
                (SELECT COUNT(*) FROM vehicle_documents) AS totalDocuments,
                (SELECT COUNT(*) FROM vehicle_documents WHERE expiry_date < CURRENT_DATE OR verification_status IN ('expired', 'rejected')) AS expiredDocuments,
                (SELECT COUNT(*) FROM vehicle_documents WHERE expiry_date >= CURRENT_DATE AND expiry_date <= DATE_ADD(CURRENT_DATE, INTERVAL 30 DAY)) AS expiringDocuments,
                (SELECT COUNT(*) FROM bookings b WHERE b.status = 'confirmed' AND NOT EXISTS (SELECT 1 FROM vehicle_inspections vi WHERE vi.booking_id = b.booking_id AND vi.inspection_type = 'pickup')) AS pendingPickupInspections,
                (SELECT COUNT(*) FROM bookings b WHERE b.status = 'active' AND NOT EXISTS (SELECT 1 FROM vehicle_inspections vi WHERE vi.booking_id = b.booking_id AND vi.inspection_type = 'return')) AS pendingReturnInspections,
                (SELECT COUNT(*) FROM vehicle_inspections) AS totalInspections,
                (SELECT COUNT(*) FROM rental_agreements) AS totalAgreements,
                (SELECT COUNT(*) FROM rental_agreements WHERE agreement_status = 'awaiting_acceptance') AS pendingAgreements,
                (SELECT COUNT(*) FROM rental_agreements WHERE agreement_status = 'accepted') AS acceptedAgreements,
                (SELECT COUNT(DISTINCT vehicle_id) FROM vehicle_maintenance WHERE status = 'in_progress') AS vehiclesUnderMaintenance,
                (SELECT COUNT(*) FROM vehicle_maintenance WHERE status = 'scheduled' AND start_date >= CURRENT_DATE) AS upcomingMaintenance,
                (SELECT COUNT(*) FROM maintenance_reminders WHERE status = 'pending' AND reminder_type = 'overdue') AS overdueMaintenanceReminders,
                (SELECT COALESCE(SUM(cost), 0) FROM vehicle_maintenance WHERE status IN ('completed', 'in_progress')) AS totalMaintenanceExpense,
                (SELECT COUNT(*) FROM pricing_rules WHERE is_active = TRUE) AS activePricingRules,
                (SELECT COUNT(*) FROM seasonal_pricing WHERE is_active = TRUE) AS activeSeasonalRules
        `);

        const statsRow = rows[0] || {};

        const stats = {
            totalVehicles: Number(statsRow.totalVehicles) || 0,
            availableVehicles: Number(statsRow.availableVehicles) || 0,
            totalCustomers: Number(statsRow.totalCustomers) || 0,
            totalBookings: Number(statsRow.totalBookings) || 0,
            pendingBookings: Number(statsRow.pendingBookings) || 0,
            confirmedBookings: Number(statsRow.confirmedBookings) || 0,
            activeBookings: Number(statsRow.activeBookings) || 0,
            completedBookings: Number(statsRow.completedBookings) || 0,
            cancelledBookings: Number(statsRow.cancelledBookings) || 0,
            totalRevenue: Number(statsRow.totalRevenue) || 0,
            // Compliance & Verification metrics
            pendingLicenses: Number(statsRow.pendingLicenses) || 0,
            verifiedLicenses: Number(statsRow.verifiedLicenses) || 0,
            rejectedLicenses: Number(statsRow.rejectedLicenses) || 0,
            expiredLicenses: Number(statsRow.expiredLicenses) || 0,
            totalDocuments: Number(statsRow.totalDocuments) || 0,
            expiredDocuments: Number(statsRow.expiredDocuments) || 0,
            expiringDocuments: Number(statsRow.expiringDocuments) || 0,
            // Phase 2: Inspection & Agreement metrics
            pendingPickupInspections: Number(statsRow.pendingPickupInspections) || 0,
            pendingReturnInspections: Number(statsRow.pendingReturnInspections) || 0,
            totalInspections: Number(statsRow.totalInspections) || 0,
            totalAgreements: Number(statsRow.totalAgreements) || 0,
            pendingAgreements: Number(statsRow.pendingAgreements) || 0,
            acceptedAgreements: Number(statsRow.acceptedAgreements) || 0,
            // Phase 3: Vehicle Maintenance & Smart Pricing metrics
            vehiclesUnderMaintenance: Number(statsRow.vehiclesUnderMaintenance) || 0,
            upcomingMaintenance: Number(statsRow.upcomingMaintenance) || 0,
            overdueMaintenanceReminders: Number(statsRow.overdueMaintenanceReminders) || 0,
            totalMaintenanceExpense: Number(statsRow.totalMaintenanceExpense) || 0,
            activePricingRules: Number(statsRow.activePricingRules) || 0,
            activeSeasonalRules: Number(statsRow.activeSeasonalRules) || 0
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
