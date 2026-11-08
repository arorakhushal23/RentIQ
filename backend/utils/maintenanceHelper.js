/**
 * Vehicle Maintenance Helper & Business Rules
 *
 * File: backend/utils/maintenanceHelper.js
 */

const db = require('../config/db');
const { checkVehicleDocumentEligibility } = require('./documentStatusHelper');

function formatDateStr(d) {
    if (!d) return '';
    if (typeof d === 'string') return d.split('T')[0].split(' ')[0];
    if (d.toISOString) return d.toISOString().split('T')[0];
    return String(d);
}

/**
 * Checks if a vehicle has an active maintenance schedule overlapping with [pickupDate, returnDate]
 * Used during booking creation to enforce maintenance blocks.
 */
async function checkVehicleMaintenanceConflict(vehicleId, pickupDateStr, returnDateStr, excludeMaintenanceId = null, conn = null) {
    const runner = conn || db;
    const vId = Number(vehicleId);

    const pDate = pickupDateStr.includes('T') ? pickupDateStr.split('T')[0] : pickupDateStr.split(' ')[0];
    const rDate = returnDateStr.includes('T') ? returnDateStr.split('T')[0] : returnDateStr.split(' ')[0];

    let query = `
        SELECT
            m.id,
            m.vehicle_id,
            m.maintenance_category,
            m.service_date,
            m.start_date,
            m.end_date,
            m.status,
            m.description,
            m.service_center,
            v.name AS vehicle_name,
            v.registration_number
        FROM vehicle_maintenance m
        JOIN vehicles v ON m.vehicle_id = v.vehicle_id
        WHERE m.vehicle_id = ?
          AND m.status IN ('scheduled', 'in_progress')
          AND (m.start_date IS NULL OR m.start_date <= ?)
          AND (m.end_date IS NULL OR m.end_date >= ?)
    `;
    const params = [vId, rDate, pDate];

    if (excludeMaintenanceId) {
        query += ` AND m.id != ?`;
        params.push(excludeMaintenanceId);
    }

    query += ` LIMIT 1`;

    const [rows] = await runner.query(query, params);

    if (rows.length > 0) {
        const conf = rows[0];
        const endDisplay = conf.end_date ? formatDateStr(conf.end_date) : 'ongoing';
        const startDisplay = conf.start_date ? formatDateStr(conf.start_date) : 'today';
        return {
            hasConflict: true,
            conflict: conf,
            message: `Vehicle ${conf.vehicle_name} (${conf.registration_number}) is under maintenance (${conf.maintenance_category}) from ${startDisplay} to ${endDisplay}.`
        };
    }

    return { hasConflict: false };
}

/**
 * Checks if there are active customer bookings overlapping with a proposed maintenance window.
 * Ensures existing confirmed/active bookings are not silently broken.
 */
async function checkMaintenanceBookingConflict(vehicleId, startDateStr, endDateStr = null, conn = null) {
    const runner = conn || db;
    const vId = Number(vehicleId);

    const sDate = startDateStr.includes('T') ? startDateStr.split('T')[0] : startDateStr.split(' ')[0];
    const eDate = endDateStr
        ? (endDateStr.includes('T') ? endDateStr.split('T')[0] : endDateStr.split(' ')[0])
        : '2099-12-31';

    const [bookings] = await runner.query(
        `
        SELECT
            b.booking_id,
            b.user_id,
            b.pickup_datetime,
            b.return_datetime,
            b.status,
            u.name AS customer_name,
            u.email AS customer_email
        FROM bookings b
        JOIN users u ON b.user_id = u.user_id
        WHERE b.vehicle_id = ?
          AND b.status IN ('pending', 'confirmed', 'active')
          AND b.pickup_datetime <= ?
          AND b.return_datetime >= ?
        ORDER BY b.pickup_datetime ASC
        `,
        [vId, `${eDate} 23:59:59`, `${sDate} 00:00:00`]
    );

    if (bookings.length > 0) {
        return {
            hasConflict: true,
            count: bookings.length,
            bookings,
            message: `Vehicle has ${bookings.length} active booking(s) scheduled during this maintenance window.`
        };
    }

    return { hasConflict: false, count: 0, bookings: [] };
}

/**
 * Prevents overlapping maintenance periods for the same vehicle
 */
async function checkMaintenanceOverlap(vehicleId, startDateStr, endDateStr = null, excludeMaintenanceId = null, conn = null) {
    const runner = conn || db;
    const vId = Number(vehicleId);

    const sDate = startDateStr.includes('T') ? startDateStr.split('T')[0] : startDateStr.split(' ')[0];
    const eDate = endDateStr
        ? (endDateStr.includes('T') ? endDateStr.split('T')[0] : endDateStr.split(' ')[0])
        : '2099-12-31';

    let query = `
        SELECT id, maintenance_category, start_date, end_date, status
        FROM vehicle_maintenance
        WHERE vehicle_id = ?
          AND status IN ('scheduled', 'in_progress')
          AND start_date <= ?
          AND (end_date IS NULL OR end_date >= ?)
    `;
    const params = [vId, eDate, sDate];

    if (excludeMaintenanceId) {
        query += ` AND id != ?`;
        params.push(excludeMaintenanceId);
    }

    query += ` LIMIT 1`;

    const [rows] = await runner.query(query, params);

    if (rows.length > 0) {
        return {
            hasConflict: true,
            maintenance: rows[0],
            message: `Vehicle already has an overlapping active maintenance record (#${rows[0].id} - ${rows[0].maintenance_category}).`
        };
    }

    return { hasConflict: false };
}

/**
 * Synchronizes vehicle availability based on:
 * 1. Current active or ongoing maintenance records
 * 2. Mandatory vehicle document compliance (RC, Insurance, PUC)
 */
async function syncVehicleAvailability(vehicleId, conn = null) {
    const runner = conn || db;
    const vId = Number(vehicleId);

    // 1. Check for any in_progress maintenance or scheduled starting today or earlier
    const [activeMaintenance] = await runner.query(
        `
        SELECT id, status, maintenance_category, start_date, end_date
        FROM vehicle_maintenance
        WHERE vehicle_id = ?
          AND (
            status = 'in_progress'
            OR (status = 'scheduled' AND start_date <= CURDATE() AND (end_date IS NULL OR end_date >= CURDATE()))
          )
        LIMIT 1
        `,
        [vId]
    );

    if (activeMaintenance.length > 0) {
        await runner.query(
            `UPDATE vehicles SET is_available = FALSE WHERE vehicle_id = ?`,
            [vId]
        );
        return {
            available: false,
            reason: `Under maintenance (${activeMaintenance[0].maintenance_category})`,
            maintenanceId: activeMaintenance[0].id
        };
    }

    // 2. No ongoing maintenance - verify vehicle document compliance
    const [vehicles] = await runner.query(
        `
        SELECT v.vehicle_id, c.name AS category_name
        FROM vehicles v
        LEFT JOIN categories c ON v.category_id = c.category_id
        WHERE v.vehicle_id = ?
        `,
        [vId]
    );

    if (vehicles.length === 0) {
        return { available: false, reason: 'Vehicle not found' };
    }

    const [docs] = await runner.query(
        `
        SELECT document_type, expiry_date, verification_status
        FROM vehicle_documents
        WHERE vehicle_id = ?
        `,
        [vId]
    );

    const docStatus = checkVehicleDocumentEligibility(docs, vehicles[0].category_name);

    if (!docStatus.eligible) {
        await runner.query(
            `UPDATE vehicles SET is_available = FALSE WHERE vehicle_id = ?`,
            [vId]
        );
        return {
            available: false,
            reason: `Document compliance hold: ${docStatus.reason || 'Missing or expired documents'}`
        };
    }

    // Both maintenance and documents are clear: mark vehicle as available
    await runner.query(
        `UPDATE vehicles SET is_available = TRUE WHERE vehicle_id = ?`,
        [vId]
    );

    return {
        available: true,
        reason: 'Maintenance clear and all mandatory documents valid'
    };
}

/**
 * Automatically evaluates maintenance reminders (Date Due, Odometer Due, Overdue)
 */
async function evaluateMaintenanceReminders(conn = null) {
    const runner = conn || db;

    // 1. Fetch latest maintenance record per vehicle that defines next_service_date or next_service_odometer
    const [maintenanceSchedules] = await runner.query(
        `
        SELECT
            m.id AS maintenance_id,
            m.vehicle_id,
            m.maintenance_category,
            m.next_service_date,
            m.next_service_odometer,
            v.name AS vehicle_name,
            v.registration_number
        FROM vehicle_maintenance m
        JOIN vehicles v ON m.vehicle_id = v.vehicle_id
        WHERE (m.next_service_date IS NOT NULL OR m.next_service_odometer IS NOT NULL)
          AND m.status = 'completed'
        ORDER BY m.service_date DESC
        `
    );

    // 2. Fetch latest known odometer reading per vehicle
    const [odoReadings] = await runner.query(
        `
        SELECT vehicle_id, MAX(odometer_reading) AS current_odometer
        FROM (
            SELECT vehicle_id, odometer_reading FROM vehicle_inspections
            UNION ALL
            SELECT vehicle_id, odometer_reading FROM vehicle_maintenance
        ) combined
        GROUP BY vehicle_id
        `
    );

    const odoMap = {};
    for (const r of odoReadings) {
        odoMap[r.vehicle_id] = Number(r.current_odometer) || 0;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let createdCount = 0;
    let updatedCount = 0;

    for (const sched of maintenanceSchedules) {
        const vId = sched.vehicle_id;
        const currentOdo = odoMap[vId] || 0;

        // A. Date-based Reminder evaluation
        if (sched.next_service_date) {
            const dueDate = new Date(sched.next_service_date);
            dueDate.setHours(0, 0, 0, 0);
            const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            let reminderType = null;
            let title = '';
            let description = '';

            if (diffDays < 0) {
                reminderType = 'overdue';
                title = `OVERDUE: Service for ${sched.vehicle_name} (${sched.registration_number})`;
                description = `Scheduled service was due on ${formatDateStr(sched.next_service_date)} (${Math.abs(diffDays)} days overdue). Immediate attention required.`;
            } else if (diffDays <= 14) {
                reminderType = 'date_due';
                title = `Upcoming Service: ${sched.vehicle_name} (${sched.registration_number})`;
                description = `Scheduled service due in ${diffDays} day(s) on ${formatDateStr(sched.next_service_date)}.`;
            }

            if (reminderType) {
                // Check if an active reminder already exists for this vehicle & type
                const [existing] = await runner.query(
                    `SELECT id, status FROM maintenance_reminders
                     WHERE vehicle_id = ? AND reminder_type = ? AND due_date = ? AND status IN ('pending', 'rescheduled')`,
                    [vId, reminderType, sched.next_service_date]
                );

                if (existing.length === 0) {
                    await runner.query(
                        `INSERT INTO maintenance_reminders (vehicle_id, reminder_type, title, description, due_date, status)
                         VALUES (?, ?, ?, ?, ?, 'pending')`,
                        [vId, reminderType, title, description, sched.next_service_date]
                    );
                    createdCount++;
                }
            }
        }

        // B. Odometer-based Reminder evaluation
        if (sched.next_service_odometer && sched.next_service_odometer > 0) {
            const kmRemaining = sched.next_service_odometer - currentOdo;
            if (kmRemaining <= 500) {
                const title = `Odometer Service Due: ${sched.vehicle_name} (${sched.registration_number})`;
                const desc = kmRemaining <= 0
                    ? `Vehicle odometer (${currentOdo} km) has exceeded service target of ${sched.next_service_odometer} km by ${Math.abs(kmRemaining)} km.`
                    : `Vehicle odometer (${currentOdo} km) is within ${kmRemaining} km of service target (${sched.next_service_odometer} km).`;

                const [existingOdo] = await runner.query(
                    `SELECT id FROM maintenance_reminders
                     WHERE vehicle_id = ? AND reminder_type = 'odometer_due' AND due_odometer = ? AND status IN ('pending', 'rescheduled')`,
                    [vId, sched.next_service_odometer]
                );

                if (existingOdo.length === 0) {
                    await runner.query(
                        `INSERT INTO maintenance_reminders (vehicle_id, reminder_type, title, description, due_odometer, status)
                         VALUES (?, 'odometer_due', ?, ?, ?, 'pending')`,
                        [vId, title, desc, sched.next_service_odometer]
                    );
                    createdCount++;
                }
            }
        }
    }

    return { created: createdCount, updated: updatedCount };
}

/**
 * Aggregates high-level KPIs for the Vehicle Maintenance Dashboard
 */
async function getMaintenanceDashboardStats(conn = null) {
    const runner = conn || db;

    // Run reminder evaluation so stats are fresh
    try {
        await evaluateMaintenanceReminders(runner);
    } catch (evalErr) {
        console.warn('Reminder evaluation warning:', evalErr.message);
    }

    // 1. Total registered vehicles
    const [totalVehRows] = await runner.query('SELECT COUNT(*) AS total FROM vehicles');
    const totalVehicles = totalVehRows[0].total;

    // 2. Vehicles currently under maintenance
    const [underMaintRows] = await runner.query(
        "SELECT COUNT(DISTINCT vehicle_id) AS total FROM vehicle_maintenance WHERE status = 'in_progress'"
    );
    const vehiclesUnderMaintenance = underMaintRows[0].total;

    // 3. Upcoming maintenance
    const [upcomingMaintRows] = await runner.query(
        "SELECT COUNT(*) AS total FROM vehicle_maintenance WHERE status = 'scheduled' AND start_date >= CURDATE()"
    );
    const upcomingMaintenance = upcomingMaintRows[0].total;

    // 4. Overdue reminders
    const [overdueRows] = await runner.query(
        "SELECT COUNT(*) AS total FROM maintenance_reminders WHERE status = 'pending' AND reminder_type = 'overdue'"
    );
    const overdueMaintenance = overdueRows[0].total;

    // 5. Total maintenance expenses
    const [expenseRows] = await runner.query(
        "SELECT COALESCE(SUM(cost), 0) AS total_expense FROM vehicle_maintenance WHERE status IN ('completed', 'in_progress')"
    );
    const totalMaintenanceExpenses = Number(expenseRows[0].total_expense || 0);

    // 6. Recent maintenance activities (latest 8)
    const [recentActivities] = await runner.query(
        `
        SELECT
            m.id,
            m.vehicle_id,
            m.maintenance_category,
            m.service_date,
            m.start_date,
            m.end_date,
            m.odometer_reading,
            m.service_center,
            m.description,
            m.cost,
            m.status,
            m.created_at,
            v.name AS vehicle_name,
            v.brand AS vehicle_brand,
            v.registration_number
        FROM vehicle_maintenance m
        JOIN vehicles v ON m.vehicle_id = v.vehicle_id
        ORDER BY m.created_at DESC
        LIMIT 8
        `
    );

    // 7. Active reminders
    const [activeReminders] = await runner.query(
        `
        SELECT
            r.id,
            r.vehicle_id,
            r.reminder_type,
            r.title,
            r.description,
            r.due_date,
            r.due_odometer,
            r.status,
            r.created_at,
            v.name AS vehicle_name,
            v.registration_number
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
        LIMIT 10
        `
    );

    return {
        totalVehicles,
        vehiclesUnderMaintenance,
        upcomingMaintenance,
        overdueMaintenance,
        totalMaintenanceExpenses,
        recentActivities,
        activeReminders
    };
}

module.exports = {
    checkVehicleMaintenanceConflict,
    checkMaintenanceBookingConflict,
    checkMaintenanceOverlap,
    syncVehicleAvailability,
    evaluateMaintenanceReminders,
    getMaintenanceDashboardStats
};
