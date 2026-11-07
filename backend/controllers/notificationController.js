const db = require('../config/db');

/**
 * GET /api/notifications
 */
const getMyNotifications = async (req, res) => {
    try {
        const userId = req.user.user_id;

        const [notifications] = await db.query(
            `SELECT notification_id, user_id, type, title, message, related_record_id, is_read, created_at
             FROM notifications
             WHERE user_id = ?
             ORDER BY created_at DESC
             LIMIT 50`,
            [userId]
        );

        const unreadCount = notifications.filter(n => !n.is_read).length;

        return res.status(200).json({
            unread_count: unreadCount,
            notifications
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return res.status(500).json({ message: 'Failed to retrieve notifications' });
    }
};

/**
 * PATCH /api/notifications/:id/read
 */
const markAsRead = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const id = Number(req.params.id);

        await db.query(
            'UPDATE notifications SET is_read = TRUE WHERE notification_id = ? AND user_id = ?',
            [id, userId]
        );

        return res.status(200).json({ message: 'Notification marked as read' });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        return res.status(500).json({ message: 'Failed to update notification' });
    }
};

/**
 * PATCH /api/notifications/read-all
 */
const markAllAsRead = async (req, res) => {
    try {
        const userId = req.user.user_id;

        await db.query(
            'UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
            [userId]
        );

        return res.status(200).json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        return res.status(500).json({ message: 'Failed to update notifications' });
    }
};

module.exports = {
    getMyNotifications,
    markAsRead,
    markAllAsRead
};

