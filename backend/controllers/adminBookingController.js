const db = require('../config/db');

/**
 * Admin Booking Controller
 *
 * File: backend/controllers/adminBookingController.js
 * Handles administrative booking inspection, detailed record retrieval,
 * and status transition management for RentIQ.
 */

const VALID_STATUSES = ['pending', 'confirmed', 'cancelled', 'completed'];

const ALLOWED_TRANSITIONS = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['completed', 'cancelled'],
    completed: [],
    cancelled: []
};

/**
 * Parses and validates a positive integer identifier.
 */
function parsePositiveInt(val) {
    const num = Number(val);
    if (!Number.isInteger(num) || num <= 0) {
        return null;
    }
    return num;
}

/**
 * Formats a raw database row into structured response objects.
 * Includes both flat convenience attributes and nested objects.
 */
function formatBookingRow(row) {
    if (!row) return null;

    return {
        booking_id: row.booking_id,
        user_id: row.user_id,
        vehicle_id: row.vehicle_id,
        start_date: row.start_date,
        end_date: row.end_date,
        total_price: Number(row.total_price),
        status: row.status,
        created_at: row.created_at,

        // Flat convenience attributes
        customer_name: row.customer_name,
        customer_email: row.customer_email,
        vehicle_name: row.vehicle_name,
        vehicle_brand: row.vehicle_brand,

        // Structured entity details
        customer: {
            user_id: row.user_id,
            name: row.customer_name,
            email: row.customer_email,
            role: row.customer_role || 'customer'
        },
        vehicle: {
            vehicle_id: row.vehicle_id,
            name: row.vehicle_name,
            brand: row.vehicle_brand,
            category: row.category_name || null,
            image_url: row.vehicle_image_url || null,
            transmission: row.transmission || null,
            seating_capacity: row.seating_capacity ? Number(row.seating_capacity) : null,
            price_per_day: row.price_per_day ? Number(row.price_per_day) : null
        },
        payment: row.payment_id ? {
            payment_id: row.payment_id,
            amount: Number(row.payment_amount),
            payment_method: row.payment_method,
            payment_status: row.payment_status,
            paid_at: row.paid_at
        } : null
    };
}

/**
 * Base SELECT projection query for joined booking records.
 */
const BASE_BOOKING_SELECT = `
    SELECT
        b.booking_id,
        b.user_id,
        b.vehicle_id,
        b.start_date,
        b.end_date,
        b.total_price,
        b.status,
        b.created_at,
        u.name AS customer_name,
        u.email AS customer_email,
        u.role AS customer_role,
        v.name AS vehicle_name,
        v.brand AS vehicle_brand,
        v.image_url AS vehicle_image_url,
        v.price_per_day,
        v.seating_capacity,
        v.transmission,
        c.name AS category_name,
        p.payment_id,
        p.amount AS payment_amount,
        p.payment_method,
        p.payment_status,
        p.paid_at
    FROM bookings b
    JOIN users u ON b.user_id = u.user_id
    JOIN vehicles v ON b.vehicle_id = v.vehicle_id
    LEFT JOIN categories c ON v.category_id = c.category_id
    LEFT JOIN payments p ON b.booking_id = p.booking_id
`;

/**
 * GET /api/admin/bookings
 * Returns all bookings with customer, vehicle, and payment details.
 * Supports optional ?status= filtering and ?search= across booking ID, customer, and vehicle.
 * Sorted newest bookings first.
 */
const getAllBookings = async (req, res) => {
    try {
        const { status, search } = req.query;

        let query = `${BASE_BOOKING_SELECT} WHERE 1 = 1`;
        const queryParams = [];

        // 1. Optional status filter
        if (status && typeof status === 'string') {
            const trimmedStatus = status.trim().toLowerCase();
            if (trimmedStatus && trimmedStatus !== 'all') {
                if (!VALID_STATUSES.includes(trimmedStatus)) {
                    return res.status(400).json({
                        message: `Invalid status filter "${status}". Allowed values: ${VALID_STATUSES.join(', ')}, all`
                    });
                }
                query += ' AND b.status = ?';
                queryParams.push(trimmedStatus);
            }
        }

        // 2. Optional search filter across booking ID, customer name/email, vehicle name/brand
        if (search && typeof search === 'string') {
            const trimmedSearch = search.trim();
            if (trimmedSearch) {
                const searchPattern = `%${trimmedSearch}%`;
                query += `
                    AND (
                        CAST(b.booking_id AS CHAR) LIKE ? OR
                        u.name LIKE ? OR
                        u.email LIKE ? OR
                        v.name LIKE ? OR
                        v.brand LIKE ?
                    )
                `;
                queryParams.push(
                    searchPattern,
                    searchPattern,
                    searchPattern,
                    searchPattern,
                    searchPattern
                );
            }
        }

        // Sort newest bookings first
        query += ' ORDER BY b.booking_id DESC';

        const [rows] = await db.query(query, queryParams);
        const bookings = rows.map(formatBookingRow);

        return res.status(200).json(bookings);
    } catch (error) {
        console.error('Error fetching admin bookings:', error.message);
        return res.status(500).json({
            message: 'Failed to fetch bookings'
        });
    }
};

/**
 * GET /api/admin/bookings/:id
 * Returns complete details for a single booking including customer, vehicle, and payment info.
 * Returns 404 if booking is not found.
 */
const getBookingById = async (req, res) => {
    try {
        const bookingId = parsePositiveInt(req.params.id);
        if (!bookingId) {
            return res.status(400).json({
                message: 'Invalid booking ID: Must be a positive integer'
            });
        }

        const query = `${BASE_BOOKING_SELECT} WHERE b.booking_id = ?`;
        const [rows] = await db.query(query, [bookingId]);

        if (rows.length === 0) {
            return res.status(404).json({
                message: 'Booking not found'
            });
        }

        return res.status(200).json(formatBookingRow(rows[0]));
    } catch (error) {
        console.error('Error fetching booking details:', error.message);
        return res.status(500).json({
            message: 'Failed to fetch booking details'
        });
    }
};

/**
 * PATCH /api/admin/bookings/:id/status
 * Updates status of a booking applying allowed lifecycle transitions:
 *   pending -> confirmed or cancelled
 *   confirmed -> completed or cancelled
 *   completed -> no further changes
 *   cancelled -> no further changes
 */
const updateBookingStatus = async (req, res) => {
    try {
        const bookingId = parsePositiveInt(req.params.id);
        if (!bookingId) {
            return res.status(400).json({
                message: 'Invalid booking ID: Must be a positive integer'
            });
        }

        const { status } = req.body;
        if (!status || typeof status !== 'string' || !status.trim()) {
            return res.status(400).json({
                message: 'Status is required and must be a string'
            });
        }

        const newStatus = status.trim().toLowerCase();
        if (!VALID_STATUSES.includes(newStatus)) {
            return res.status(400).json({
                message: `Invalid status value "${status}". Allowed values: ${VALID_STATUSES.join(', ')}`
            });
        }

        // Verify booking exists
        const [existing] = await db.query(
            'SELECT booking_id, status FROM bookings WHERE booking_id = ?',
            [bookingId]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                message: 'Booking not found'
            });
        }

        const currentStatus = existing[0].status;

        // If identical
        if (currentStatus === newStatus) {
            return res.status(400).json({
                message: `Booking is already in "${newStatus}" status`
            });
        }

        // Disallow modifications to terminal statuses
        if (currentStatus === 'completed' || currentStatus === 'cancelled') {
            return res.status(400).json({
                message: `Cannot update booking status: Bookings in "${currentStatus}" status are final and cannot be modified`
            });
        }

        // Verify lifecycle transition
        const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
        if (!allowed.includes(newStatus)) {
            return res.status(400).json({
                message: `Invalid status transition from "${currentStatus}" to "${newStatus}". Allowed transitions from "${currentStatus}" are: ${allowed.join(', ')}`
            });
        }

        // Update status in MySQL
        await db.query(
            'UPDATE bookings SET status = ? WHERE booking_id = ?',
            [newStatus, bookingId]
        );

        // Fetch updated booking record with joined data
        const query = `${BASE_BOOKING_SELECT} WHERE b.booking_id = ?`;
        const [updatedRows] = await db.query(query, [bookingId]);

        return res.status(200).json({
            message: 'Booking status updated successfully',
            booking: formatBookingRow(updatedRows[0])
        });
    } catch (error) {
        console.error('Error updating booking status:', error.message);
        return res.status(500).json({
            message: 'Failed to update booking status'
        });
    }
};

module.exports = {
    getAllBookings,
    getBookingById,
    updateBookingStatus
};
