/**
 * Digital Rental Agreement Controller
 *
 * File: backend/controllers/agreementController.js
 */

const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const {
    buildAgreementData,
    generateAgreementPDF
} = require('../utils/agreementHelper');
const { createNotification } = require('../utils/notificationHelper');

/**
 * Ensures an agreement exists for a confirmed booking
 */
async function ensureAgreementExists(bookingId, userId) {
    // Check if an agreement already exists
    const [existing] = await db.query(
        `SELECT id, agreement_number, agreement_version, agreement_data, pdf_file_path, agreement_status, terms_accepted, accepted_at
         FROM rental_agreements
         WHERE booking_id = ?
         ORDER BY agreement_version DESC
         LIMIT 1`,
        [bookingId]
    );

    if (existing.length > 0) {
        return existing[0];
    }

    // Build agreement data snapshot
    const agreementData = await buildAgreementData(bookingId);
    const agreementNumber = `RIQ-AGR-${bookingId}-${Date.now().toString(36).toUpperCase()}`;

    // Generate initial PDF
    const pdfPath = await generateAgreementPDF(agreementNumber, agreementData, null);

    // Save to database
    const [result] = await db.query(
        `INSERT INTO rental_agreements
            (booking_id, user_id, agreement_number, agreement_version, agreement_data, pdf_file_path, agreement_status, terms_accepted)
         VALUES (?, ?, ?, 1, ?, ?, 'awaiting_acceptance', FALSE)`,
        [bookingId, userId || agreementData.customer.userId, agreementNumber, JSON.stringify(agreementData), pdfPath]
    );

    return {
        id: result.insertId,
        agreement_number: agreementNumber,
        agreement_version: 1,
        agreement_data: agreementData,
        pdf_file_path: pdfPath,
        agreement_status: 'awaiting_acceptance',
        terms_accepted: false,
        accepted_at: null
    };
}

/**
 * Get agreement details for a booking
 */
const getAgreementByBooking = async (req, res) => {
    try {
        const bookingId = Number(req.params.bookingId);
        const userId = req.user.user_id;
        const isAdmin = req.user.role === 'admin';

        if (!Number.isInteger(bookingId) || bookingId <= 0) {
            return res.status(400).json({ message: 'Invalid booking ID' });
        }

        // Verify booking access
        const [bookings] = await db.query(
            'SELECT booking_id, user_id, status FROM bookings WHERE booking_id = ?',
            [bookingId]
        );

        if (bookings.length === 0) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        const booking = bookings[0];
        if (!isAdmin && booking.user_id !== userId) {
            return res.status(403).json({ message: 'Unauthorized to view this rental agreement' });
        }

        let agreement = await ensureAgreementExists(bookingId, booking.user_id);
        if (typeof agreement.agreement_data === 'string') {
            try {
                agreement.agreement_data = JSON.parse(agreement.agreement_data);
            } catch (e) {
                // Keep as is
            }
        }

        return res.status(200).json({ agreement });
    } catch (err) {
        console.error('Error fetching rental agreement:', err.message);
        return res.status(500).json({ message: 'Failed to retrieve rental agreement' });
    }
};

/**
 * Customer accepts the digital rental agreement
 */
const acceptAgreement = async (req, res) => {
    try {
        const agreementId = Number(req.params.id);
        const userId = req.user.user_id;

        if (!Number.isInteger(agreementId) || agreementId <= 0) {
            return res.status(400).json({ message: 'Invalid agreement ID' });
        }

        const [rows] = await db.query(
            `SELECT id, booking_id, user_id, agreement_number, agreement_data, terms_accepted
             FROM rental_agreements
             WHERE id = ?`,
            [agreementId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Rental agreement not found' });
        }

        const agr = rows[0];
        if (agr.user_id !== userId) {
            return res.status(403).json({ message: 'Unauthorized: You can only accept your own agreement' });
        }

        if (agr.terms_accepted) {
            return res.status(200).json({
                message: 'Agreement is already accepted',
                alreadyAccepted: true
            });
        }

        const acceptedAt = new Date();
        const agreementData = typeof agr.agreement_data === 'string'
            ? JSON.parse(agr.agreement_data)
            : agr.agreement_data;

        // Re-generate PDF with digital acceptance confirmation
        const newPdfPath = await generateAgreementPDF(agr.agreement_number, agreementData, {
            accepted: true,
            acceptedAt
        });

        // Update agreement status in database
        await db.query(
            `UPDATE rental_agreements
             SET terms_accepted = TRUE,
                 agreement_status = 'accepted',
                 accepted_at = ?,
                 pdf_file_path = ?
             WHERE id = ?`,
            [acceptedAt, newPdfPath, agreementId]
        );

        // Send confirmation in-app notification
        await createNotification(
            userId,
            'agreement_accepted',
            `Your digital rental agreement (#${agr.agreement_number}) for Booking #${agr.booking_id} has been accepted. Vehicle is ready for inspection.`,
            agr.booking_id
        );

        return res.status(200).json({
            message: 'Rental agreement accepted successfully',
            agreement_id: agreementId,
            agreement_number: agr.agreement_number,
            accepted_at: acceptedAt,
            agreement_status: 'accepted'
        });
    } catch (err) {
        console.error('Error accepting agreement:', err.message);
        return res.status(500).json({ message: 'Failed to accept rental agreement' });
    }
};

/**
 * Stream/Download the generated agreement PDF
 */
const downloadAgreementPDF = async (req, res) => {
    try {
        const agreementId = Number(req.params.id);
        const userId = req.user.user_id;
        const isAdmin = req.user.role === 'admin';

        if (!Number.isInteger(agreementId) || agreementId <= 0) {
            return res.status(400).json({ message: 'Invalid agreement ID' });
        }

        const [rows] = await db.query(
            `SELECT id, booking_id, user_id, agreement_number, pdf_file_path
             FROM rental_agreements
             WHERE id = ?`,
            [agreementId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Agreement not found' });
        }

        const agr = rows[0];
        if (!isAdmin && agr.user_id !== userId) {
            return res.status(403).json({ message: 'Access denied: You cannot download this agreement' });
        }

        if (!agr.pdf_file_path || !fs.existsSync(agr.pdf_file_path)) {
            // Regenerate PDF if file missing
            const agreementData = await buildAgreementData(agr.booking_id);
            const generatedPath = await generateAgreementPDF(agr.agreement_number, agreementData, null);
            agr.pdf_file_path = generatedPath;
            await db.query('UPDATE rental_agreements SET pdf_file_path = ? WHERE id = ?', [generatedPath, agreementId]);
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${agr.agreement_number}.pdf"`);

        const fileStream = fs.createReadStream(agr.pdf_file_path);
        fileStream.pipe(res);
    } catch (err) {
        console.error('Error downloading agreement PDF:', err.message);
        return res.status(500).json({ message: 'Failed to download agreement PDF' });
    }
};

/**
 * Admin: List all rental agreements
 */
const getAllAgreementsAdmin = async (req, res) => {
    try {
        const { status, search } = req.query;
        let whereClauses = [];
        let queryParams = [];

        if (status && status !== 'all') {
            whereClauses.push('ra.agreement_status = ?');
            queryParams.push(status);
        }

        if (search) {
            whereClauses.push('(ra.agreement_number LIKE ? OR u.name LIKE ? OR u.email LIKE ? OR v.registration_number LIKE ?)');
            const s = `%${search}%`;
            queryParams.push(s, s, s, s);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const [agreements] = await db.query(
            `SELECT 
                ra.id,
                ra.booking_id,
                ra.user_id,
                ra.agreement_number,
                ra.agreement_version,
                ra.agreement_status,
                ra.terms_accepted,
                ra.accepted_at,
                ra.created_at,
                u.name AS customer_name,
                u.email AS customer_email,
                v.name AS vehicle_name,
                v.brand AS vehicle_brand,
                v.registration_number,
                b.pickup_datetime,
                b.return_datetime,
                b.total_price
             FROM rental_agreements ra
             JOIN users u ON ra.user_id = u.user_id
             JOIN bookings b ON ra.booking_id = b.booking_id
             JOIN vehicles v ON b.vehicle_id = v.vehicle_id
             ${whereSql}
             ORDER BY ra.id DESC
             LIMIT 100`,
            queryParams
        );

        return res.status(200).json({ agreements });
    } catch (err) {
        console.error('Error fetching admin agreements:', err.message);
        return res.status(500).json({ message: 'Failed to fetch rental agreements' });
    }
};

module.exports = {
    ensureAgreementExists,
    getAgreementByBooking,
    acceptAgreement,
    downloadAgreementPDF,
    getAllAgreementsAdmin
};

