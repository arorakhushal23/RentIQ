/**
 * Vehicle Maintenance Controller
 *
 * File: backend/controllers/maintenanceController.js
 */

const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const {
    checkMaintenanceBookingConflict,
    checkMaintenanceOverlap,
    syncVehicleAvailability,
    evaluateMaintenanceReminders,
    getMaintenanceDashboardStats
} = require('../utils/maintenanceHelper');

const VALID_CATEGORIES = [
    'regular_service',
    'engine_repair',
    'oil_change',
    'tyre_replacement',
    'brake_servicing',
    'battery_replacement',
    'electrical_repairs',
    'accident_repairs',
    'other'
];

const VALID_STATUSES = ['scheduled', 'in_progress', 'completed', 'cancelled'];

/**
 * Admin: Get high-level maintenance dashboard stats and reminders
 */
const getStats = async (req, res) => {
    try {
        const stats = await getMaintenanceDashboardStats();
        return res.status(200).json(stats);
    } catch (err) {
        console.error('Error fetching maintenance stats:', err);
        return res.status(500).json({ message: 'Failed to fetch maintenance dashboard statistics' });
    }
};

/**
 * Admin: List maintenance records with flexible filtering
 */
const getRecords = async (req, res) => {
    try {
        const {
            vehicle_id,
            category,
            status,
            search,
            start_date,
            end_date,
            page = 1,
            limit = 20
        } = req.query;

        let query = `
            SELECT
                m.*,
                v.name AS vehicle_name,
                v.brand AS vehicle_brand,
                v.registration_number,
                v.image_url,
                u.name AS created_by_name
            FROM vehicle_maintenance m
            JOIN vehicles v ON m.vehicle_id = v.vehicle_id
            LEFT JOIN users u ON m.created_by = u.user_id
            WHERE 1=1
        `;
        const params = [];

        if (vehicle_id) {
            query += ' AND m.vehicle_id = ?';
            params.push(Number(vehicle_id));
        }

        if (category && VALID_CATEGORIES.includes(category)) {
            query += ' AND m.maintenance_category = ?';
            params.push(category);
        }

        if (status && VALID_STATUSES.includes(status)) {
            query += ' AND m.status = ?';
            params.push(status);
        }

        if (start_date) {
            query += ' AND m.service_date >= ?';
            params.push(start_date);
        }

        if (end_date) {
            query += ' AND m.service_date <= ?';
            params.push(end_date);
        }

        if (search) {
            query += ' AND (v.name LIKE ? OR v.registration_number LIKE ? OR m.service_center LIKE ? OR m.description LIKE ?)';
            const term = `%${search}%`;
            params.push(term, term, term, term);
        }

        query += ' ORDER BY m.service_date DESC, m.created_at DESC';

        const offset = (Number(page) - 1) * Number(limit);
        query += ` LIMIT ? OFFSET ?`;
        params.push(Number(limit), Number(offset));

        const [records] = await db.query(query, params);

        // Lifetime cost calculation for the current filter
        const [totalCostRow] = await db.query(
            `SELECT COALESCE(SUM(cost), 0) AS total_expense FROM vehicle_maintenance WHERE status IN ('completed', 'in_progress')`
        );

        return res.status(200).json({
            records,
            totalExpense: Number(totalCostRow[0].total_expense || 0),
            page: Number(page),
            limit: Number(limit)
        });
    } catch (err) {
        console.error('Error fetching maintenance records:', err);
        return res.status(500).json({ message: 'Failed to fetch maintenance records' });
    }
};

/**
 * Admin: Get single maintenance record details
 */
const getRecordById = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const [records] = await db.query(
            `SELECT
                m.*,
                v.name AS vehicle_name,
                v.brand AS vehicle_brand,
                v.registration_number,
                v.image_url,
                u.name AS created_by_name
             FROM vehicle_maintenance m
             JOIN vehicles v ON m.vehicle_id = v.vehicle_id
             LEFT JOIN users u ON m.created_by = u.user_id
             WHERE m.id = ?`,
            [id]
        );

        if (records.length === 0) {
            return res.status(404).json({ message: 'Maintenance record not found' });
        }

        return res.status(200).json(records[0]);
    } catch (err) {
        console.error('Error fetching maintenance record by id:', err);
        return res.status(500).json({ message: 'Failed to fetch maintenance record' });
    }
};

/**
 * Admin: Create a new maintenance record with invoice upload & conflict enforcement
 */
const createRecord = async (req, res) => {
    let connection;
    try {
        const adminId = req.user.user_id;
        const {
            vehicle_id,
            maintenance_category = 'regular_service',
            service_date,
            start_date,
            end_date,
            odometer_reading,
            service_center,
            description,
            parts_replaced,
            cost = 0,
            next_service_date,
            next_service_odometer,
            notes,
            status = 'in_progress'
        } = req.body;

        const vId = Number(vehicle_id);
        const odo = Number(odometer_reading);
        const totalCost = Number(cost) || 0;

        if (!vId || isNaN(vId)) {
            return res.status(400).json({ message: 'Valid vehicle_id is required' });
        }

        if (!VALID_CATEGORIES.includes(maintenance_category)) {
            return res.status(400).json({ message: `Invalid maintenance category. Allowed: ${VALID_CATEGORIES.join(', ')}` });
        }

        if (!service_date) {
            return res.status(400).json({ message: 'service_date is required' });
        }

        const effectiveStart = start_date || service_date;
        const effectiveEnd = end_date || null;

        if (effectiveEnd && new Date(effectiveEnd) < new Date(effectiveStart)) {
            return res.status(400).json({ message: 'end_date cannot be earlier than start_date' });
        }

        if (isNaN(odo) || odo < 0) {
            return res.status(400).json({ message: 'Valid non-negative odometer_reading is required' });
        }

        if (!service_center || !service_center.trim()) {
            return res.status(400).json({ message: 'service_center/workshop name is required' });
        }

        if (!description || !description.trim()) {
            return res.status(400).json({ message: 'Description of work performed is required' });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Verify vehicle exists
        const [vehs] = await connection.query(
            `SELECT vehicle_id, name, registration_number FROM vehicles WHERE vehicle_id = ? FOR UPDATE`,
            [vId]
        );

        if (vehs.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Vehicle not found' });
        }

        // 2. Prevent overlapping maintenance schedules
        if (['scheduled', 'in_progress'].includes(status)) {
            const overlapRes = await checkMaintenanceOverlap(vId, effectiveStart, effectiveEnd, null, connection);
            if (overlapRes.hasConflict) {
                await connection.rollback();
                return res.status(409).json({ message: overlapRes.message });
            }

            // 3. Ensure no existing confirmed customer bookings are silently cancelled or conflicted
            const bookingConflict = await checkMaintenanceBookingConflict(vId, effectiveStart, effectiveEnd, connection);
            if (bookingConflict.hasConflict) {
                await connection.rollback();
                return res.status(409).json({
                    message: `Cannot schedule maintenance: ${bookingConflict.message}`,
                    conflictingBookings: bookingConflict.bookings
                });
            }
        }

        const invoiceFilePath = req.file ? req.file.path : null;

        // 4. Insert record
        const [result] = await connection.query(
            `
            INSERT INTO vehicle_maintenance
                (vehicle_id, maintenance_category, service_date, start_date, end_date,
                 odometer_reading, service_center, description, parts_replaced, cost,
                 next_service_date, next_service_odometer, invoice_file_path, notes,
                 status, created_by)
            VALUES
                (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                vId,
                maintenance_category,
                service_date,
                effectiveStart,
                effectiveEnd,
                odo,
                service_center.trim(),
                description.trim(),
                parts_replaced || null,
                totalCost,
                next_service_date || null,
                next_service_odometer ? Number(next_service_odometer) : null,
                invoiceFilePath,
                notes || null,
                status,
                adminId
            ]
        );

        const newId = result.insertId;

        // 5. Sync vehicle availability state
        const syncResult = await syncVehicleAvailability(vId, connection);

        await connection.commit();

        // 6. Trigger maintenance reminders evaluation
        try {
            await evaluateMaintenanceReminders();
        } catch (rErr) {
            console.warn('Reminder evaluation background error:', rErr.message);
        }

        return res.status(201).json({
            message: 'Maintenance record created successfully',
            recordId: newId,
            vehicleAvailability: syncResult
        });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error('Error creating maintenance record:', err);
        return res.status(500).json({ message: 'Failed to create maintenance record: ' + err.message });
    }
};

/**
 * Admin: Update an existing maintenance record
 */
const updateRecord = async (req, res) => {
    let connection;
    try {
        const id = Number(req.params.id);
        const {
            maintenance_category,
            service_date,
            start_date,
            end_date,
            odometer_reading,
            service_center,
            description,
            parts_replaced,
            cost,
            next_service_date,
            next_service_odometer,
            notes,
            status
        } = req.body;

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [existingRows] = await connection.query(
            `SELECT * FROM vehicle_maintenance WHERE id = ? FOR UPDATE`,
            [id]
        );

        if (existingRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Maintenance record not found' });
        }

        const existing = existingRows[0];
        const vId = existing.vehicle_id;

        const effectiveStatus = status || existing.status;
        const effectiveStart = start_date || existing.start_date;
        const effectiveEnd = end_date !== undefined ? end_date : existing.end_date;

        if (['scheduled', 'in_progress'].includes(effectiveStatus)) {
            const overlapRes = await checkMaintenanceOverlap(vId, effectiveStart, effectiveEnd, id, connection);
            if (overlapRes.hasConflict) {
                await connection.rollback();
                return res.status(409).json({ message: overlapRes.message });
            }

            const bookingConflict = await checkMaintenanceBookingConflict(vId, effectiveStart, effectiveEnd, connection);
            if (bookingConflict.hasConflict) {
                await connection.rollback();
                return res.status(409).json({
                    message: `Cannot update maintenance window: ${bookingConflict.message}`,
                    conflictingBookings: bookingConflict.bookings
                });
            }
        }

        const invoiceFilePath = req.file ? req.file.path : existing.invoice_file_path;

        await connection.query(
            `
            UPDATE vehicle_maintenance
            SET maintenance_category = COALESCE(?, maintenance_category),
                service_date = COALESCE(?, service_date),
                start_date = COALESCE(?, start_date),
                end_date = ?,
                odometer_reading = COALESCE(?, odometer_reading),
                service_center = COALESCE(?, service_center),
                description = COALESCE(?, description),
                parts_replaced = ?,
                cost = COALESCE(?, cost),
                next_service_date = ?,
                next_service_odometer = ?,
                invoice_file_path = ?,
                notes = ?,
                status = COALESCE(?, status)
            WHERE id = ?
            `,
            [
                maintenance_category,
                service_date,
                effectiveStart,
                effectiveEnd,
                odometer_reading !== undefined ? Number(odometer_reading) : null,
                service_center,
                description,
                parts_replaced !== undefined ? parts_replaced : existing.parts_replaced,
                cost !== undefined ? Number(cost) : null,
                next_service_date !== undefined ? next_service_date : existing.next_service_date,
                next_service_odometer !== undefined ? Number(next_service_odometer) : existing.next_service_odometer,
                invoiceFilePath,
                notes !== undefined ? notes : existing.notes,
                effectiveStatus,
                id
            ]
        );

        // Restore or update vehicle availability based on new maintenance status
        const syncResult = await syncVehicleAvailability(vId, connection);

        await connection.commit();

        try {
            await evaluateMaintenanceReminders();
        } catch (rErr) {
            console.warn('Reminder evaluation warning:', rErr.message);
        }

        return res.status(200).json({
            message: 'Maintenance record updated successfully',
            vehicleAvailability: syncResult
        });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error('Error updating maintenance record:', err);
        return res.status(500).json({ message: 'Failed to update maintenance record: ' + err.message });
    }
};

/**
 * Admin: Delete a maintenance record
 */
const deleteRecord = async (req, res) => {
    let connection;
    try {
        const id = Number(req.params.id);

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [records] = await connection.query(
            `SELECT vehicle_id, invoice_file_path FROM vehicle_maintenance WHERE id = ? FOR UPDATE`,
            [id]
        );

        if (records.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Maintenance record not found' });
        }

        const vId = records[0].vehicle_id;
        const filePath = records[0].invoice_file_path;

        await connection.query('DELETE FROM vehicle_maintenance WHERE id = ?', [id]);

        // Remove local invoice file if present
        if (filePath && fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            } catch (_) {}
        }

        const syncResult = await syncVehicleAvailability(vId, connection);

        await connection.commit();

        return res.status(200).json({
            message: 'Maintenance record deleted successfully',
            vehicleAvailability: syncResult
        });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error('Error deleting maintenance record:', err);
        return res.status(500).json({ message: 'Failed to delete maintenance record' });
    }
};

/**
 * Admin: Dedicated vehicle maintenance history with lifetime expenses
 */
const getVehicleHistory = async (req, res) => {
    try {
        const vehicleId = Number(req.params.vehicleId);

        const [vehicles] = await db.query(
            `SELECT vehicle_id, name, brand, registration_number, image_url, is_available
             FROM vehicles WHERE vehicle_id = ?`,
            [vehicleId]
        );

        if (vehicles.length === 0) {
            return res.status(404).json({ message: 'Vehicle not found' });
        }

        const vehicle = vehicles[0];

        const [records] = await db.query(
            `SELECT m.*, u.name AS created_by_name
             FROM vehicle_maintenance m
             LEFT JOIN users u ON m.created_by = u.user_id
             WHERE m.vehicle_id = ?
             ORDER BY m.service_date DESC, m.created_at DESC`,
            [vehicleId]
        );

        const [aggregates] = await db.query(
            `SELECT
                COUNT(*) AS total_services,
                COALESCE(SUM(cost), 0) AS lifetime_cost,
                COALESCE(AVG(cost), 0) AS average_service_cost,
                MAX(odometer_reading) AS latest_service_odometer
             FROM vehicle_maintenance
             WHERE vehicle_id = ? AND status IN ('completed', 'in_progress')`,
            [vehicleId]
        );

        const [upcomingSchedule] = await db.query(
            `SELECT next_service_date, next_service_odometer
             FROM vehicle_maintenance
             WHERE vehicle_id = ? AND (next_service_date >= CURDATE() OR next_service_odometer IS NOT NULL)
             ORDER BY service_date DESC LIMIT 1`,
            [vehicleId]
        );

        return res.status(200).json({
            vehicle,
            records,
            summary: {
                totalServices: Number(aggregates[0].total_services || 0),
                lifetimeCost: Number(aggregates[0].lifetime_cost || 0),
                averageServiceCost: Number(aggregates[0].average_service_cost || 0),
                latestOdometer: Number(aggregates[0].latest_service_odometer || 0),
                nextServiceDate: upcomingSchedule.length > 0 ? upcomingSchedule[0].next_service_date : null,
                nextServiceOdometer: upcomingSchedule.length > 0 ? upcomingSchedule[0].next_service_odometer : null
            }
        });
    } catch (err) {
        console.error('Error fetching vehicle maintenance history:', err);
        return res.status(500).json({ message: 'Failed to fetch vehicle maintenance history' });
    }
};

/**
 * Admin: Get active maintenance reminders
 */
const getReminders = async (req, res) => {
    try {
        await evaluateMaintenanceReminders();

        const [reminders] = await db.query(
            `
            SELECT
                r.*,
                v.name AS vehicle_name,
                v.brand AS vehicle_brand,
                v.registration_number,
                v.image_url
            FROM maintenance_reminders r
            JOIN vehicles v ON r.vehicle_id = v.vehicle_id
            WHERE r.status IN ('pending', 'rescheduled')
            ORDER BY
                CASE r.reminder_type
                    WHEN 'overdue' THEN 1
                    WHEN 'odometer_due' THEN 2
                    WHEN 'date_due' THEN 3
                    ELSE 4
                END,
                r.due_date ASC
            `
        );

        return res.status(200).json(reminders);
    } catch (err) {
        console.error('Error fetching reminders:', err);
        return res.status(500).json({ message: 'Failed to fetch maintenance reminders' });
    }
};

/**
 * Admin: Update reminder status (completed, rescheduled, dismissed)
 */
const updateReminderStatus = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { status, rescheduled_date } = req.body;

        if (!['pending', 'completed', 'rescheduled', 'dismissed'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        await db.query(
            `UPDATE maintenance_reminders
             SET status = ?, due_date = COALESCE(?, due_date)
             WHERE id = ?`,
            [status, rescheduled_date || null, id]
        );

        return res.status(200).json({ message: 'Reminder updated successfully' });
    } catch (err) {
        console.error('Error updating reminder status:', err);
        return res.status(500).json({ message: 'Failed to update reminder' });
    }
};

/**
 * Admin/Authorized: Download maintenance invoice file
 */
const downloadInvoice = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const [rows] = await db.query(
            'SELECT invoice_file_path FROM vehicle_maintenance WHERE id = ?',
            [id]
        );

        if (rows.length === 0 || !rows[0].invoice_file_path) {
            return res.status(404).json({ message: 'Invoice not found for this maintenance record' });
        }

        const filePath = path.resolve(rows[0].invoice_file_path);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: 'Invoice file not found on disk' });
        }

        return res.download(filePath);
    } catch (err) {
        console.error('Error downloading invoice:', err);
        return res.status(500).json({ message: 'Failed to download invoice' });
    }
};

module.exports = {
    getStats,
    getRecords,
    getRecordById,
    createRecord,
    updateRecord,
    deleteRecord,
    getVehicleHistory,
    getReminders,
    updateReminderStatus,
    downloadInvoice
};

