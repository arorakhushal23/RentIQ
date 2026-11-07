const db = require('../config/db');

/**
 * Creates a notification for a specific user if a duplicate unread one doesn't exist
 */
async function createNotification({ userId, type, title, message, relatedRecordId = null }) {
    try {
        // Prevent exact duplicate unread notifications
        const [existing] = await db.query(
            `SELECT notification_id FROM notifications
             WHERE user_id = ? AND type = ? AND related_record_id <=> ? AND is_read = FALSE
             LIMIT 1`,
            [userId, type, relatedRecordId]
        );

        if (existing.length > 0) {
            return existing[0].notification_id;
        }

        const [result] = await db.query(
            `INSERT INTO notifications (user_id, type, title, message, related_record_id, is_read)
             VALUES (?, ?, ?, ?, ?, FALSE)`,
            [userId, type, title, message, relatedRecordId]
        );

        return result.insertId;
    } catch (err) {
        console.error('Error creating notification:', err.message);
        return null;
    }
}

/**
 * Notifies all active administrators regarding an expiring or expired vehicle document
 */
async function notifyAdminsOfDocumentAlert({ vehicle, document, alertType, daysRemaining }) {
    try {
        const [admins] = await db.query("SELECT user_id FROM users WHERE role = 'admin'");
        if (admins.length === 0) return;

        let title = '';
        let message = '';

        const docTypeLabel = document.document_type ? document.document_type.toUpperCase() : 'Document';
        const vehLabel = `${vehicle.brand ? vehicle.brand + ' ' : ''}${vehicle.name} (${vehicle.registration_number || '#' + vehicle.vehicle_id})`;

        if (alertType === 'expired') {
            title = `Vehicle Document Expired: ${docTypeLabel}`;
            message = `The ${docTypeLabel} certificate for ${vehLabel} has expired on ${document.expiry_date}. Immediate renewal is required.`;
        } else {
            title = `Vehicle Document Expiring Soon: ${docTypeLabel}`;
            message = `The ${docTypeLabel} certificate for ${vehLabel} is expiring in ${daysRemaining} day(s) on ${document.expiry_date}. Please initiate renewal.`;
        }

        const notifType = `doc_alert_${alertType}_${document.id}`;

        for (const admin of admins) {
            await createNotification({
                userId: admin.user_id,
                type: notifType,
                title,
                message,
                relatedRecordId: vehicle.vehicle_id
            });
        }
    } catch (err) {
        console.error('Error notifying admins of document alert:', err.message);
    }
}

module.exports = {
    createNotification,
    notifyAdminsOfDocumentAlert
};

