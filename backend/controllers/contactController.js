const db = require('../config/db')

const createContactMessage = async (req, res) => {
    try {
        const {
            name,
            email,
            subject,
            message
        } = req.body

        if (!name || !email || !subject || !message) {
            return res.status(400).json({
                message: 'All fields are required.'
            })
        }

        const [result] = await db.execute(
            `INSERT INTO contact_messages
            (name, email, subject, message)
            VALUES (?, ?, ?, ?)`,
            [
                name.trim(),
                email.trim(),
                subject.trim(),
                message.trim()
            ]
        )

        res.status(201).json({
            message: 'Message sent successfully.',
            message_id: result.insertId
        })
    } catch (error) {
        console.error('Contact message error:', error)

        res.status(500).json({
            message: 'Failed to send message.'
        })
    }
}

module.exports = {
    createContactMessage
}