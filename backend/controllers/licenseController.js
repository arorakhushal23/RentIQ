const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const { createNotification } = require('../utils/notificationHelper');

/**
 * Mask a licence number for listing views (e.g. "DL-0420110012345" -> "DL-•••••••2345")
 */
function maskLicenseNumber(licenseNumber) {
    if (!licenseNumber || typeof licenseNumber !== 'string') return '';
    const clean = licenseNumber.trim();
    if (clean.length <= 4) return clean;
    const firstTwo = clean.slice(0, 3);
    const lastFour = clean.slice(-4);
    return `${firstTwo}••••••${lastFour}`;
}

/**
 * Validates licence status based on expiry
 */
function evaluateLicenseStatus(dbStatus, expiryDate) {
    if (dbStatus === 'verified' && expiryDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const exp = new Date(expiryDate);
        exp.setHours(0, 0, 0, 0);
        if (exp.getTime() < today.getTime()) {
            return 'expired';
        }
    }
    return dbStatus;
}

/**
 * GET /api/licenses/my-license
 * Customer retrieves their own licence status and submission
 */
const getMyLicense = async (req, res) => {
    try {
        const userId = req.user.user_id;

        const [rows] = await db.query(
            `SELECT
                id,
                user_id,
                license_number,
                holder_name,
                date_of_birth,
                issue_date,
                expiry_date,
                vehicle_class,
                front_document_path,
                back_document_path,
                verification_status,
                rejection_reason,
                verified_at,
                created_at,
                updated_at
             FROM customer_licenses
             WHERE user_id = ?`,
            [userId]
        );

        if (rows.length === 0) {
            return res.status(200).json({
                hasSubmitted: false,
                status: 'not_submitted',
                license: null
            });
        }

        const raw = rows[0];
        const currentStatus = evaluateLicenseStatus(raw.verification_status, raw.expiry_date);

        return res.status(200).json({
            hasSubmitted: true,
            status: currentStatus,
            license: {
                id: raw.id,
                license_number: raw.license_number,
                holder_name: raw.holder_name,
                date_of_birth: raw.date_of_birth,
                issue_date: raw.issue_date,
                expiry_date: raw.expiry_date,
                vehicle_class: raw.vehicle_class,
                has_front: Boolean(raw.front_document_path),
                has_back: Boolean(raw.back_document_path),
                verification_status: currentStatus,
                rejection_reason: raw.rejection_reason,
                verified_at: raw.verified_at,
                created_at: raw.created_at,
                updated_at: raw.updated_at
            }
        });
    } catch (error) {
        console.error('Error fetching customer license:', error);
        return res.status(500).json({ message: 'Failed to retrieve driving licence details' });
    }
};

/**
 * POST /api/licenses/submit
 * Customer submits or resubmits licence
 */
const submitLicense = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const {
            license_number,
            holder_name,
            date_of_birth,
            issue_date,
            expiry_date,
            vehicle_class
        } = req.body;

        // Validation
        if (!license_number || !license_number.trim()) {
            return res.status(400).json({ message: 'Driving licence number is required' });
        }
        if (!holder_name || !holder_name.trim()) {
            return res.status(400).json({ message: 'Licence holder name is required' });
        }
        if (!issue_date) {
            return res.status(400).json({ message: 'Licence issue date is required' });
        }
        if (!expiry_date) {
            return res.status(400).json({ message: 'Licence expiry date is required' });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const exp = new Date(expiry_date);
        exp.setHours(0, 0, 0, 0);
        if (exp.getTime() <= today.getTime()) {
            return res.status(400).json({ message: 'Licence expiry date must be in the future' });
        }

        const iss = new Date(issue_date);
        iss.setHours(0, 0, 0, 0);
        if (iss.getTime() > today.getTime()) {
            return res.status(400).json({ message: 'Licence issue date cannot be in the future' });
        }

        if (date_of_birth) {
            const dob = new Date(date_of_birth);
            dob.setHours(0, 0, 0, 0);
            const ageDiff = today.getFullYear() - dob.getFullYear();
            if (ageDiff < 18) {
                return res.status(400).json({ message: 'Licence holder must be at least 18 years of age' });
            }
        }

        // Check uploaded files
        const frontFile = req.files && req.files.front ? req.files.front[0] : null;
        const backFile = req.files && req.files.back ? req.files.back[0] : null;

        // Check existing record
        const [existing] = await db.query(
            'SELECT * FROM customer_licenses WHERE user_id = ?',
            [userId]
        );

        let frontPath = existing.length > 0 ? existing[0].front_document_path : null;
        let backPath = existing.length > 0 ? existing[0].back_document_path : null;

        if (frontFile) {
            frontPath = path.basename(frontFile.path);
        }
        if (backFile) {
            backPath = path.basename(backFile.path);
        }

        if (!frontPath) {
            return res.status(400).json({ message: 'Front-side licence document is required' });
        }

        const validVehicleClass = vehicle_class && vehicle_class.trim() ? vehicle_class.trim().toUpperCase() : 'LMV';

        if (existing.length > 0) {
            // Update existing record, reset verification to pending
            await db.query(
                `UPDATE customer_licenses
                 SET license_number = ?,
                     holder_name = ?,
                     date_of_birth = ?,
                     issue_date = ?,
                     expiry_date = ?,
                     vehicle_class = ?,
                     front_document_path = ?,
                     back_document_path = ?,
                     verification_status = 'pending',
                     rejection_reason = NULL,
                     verified_by = NULL,
                     verified_at = NULL,
                     updated_at = NOW()
                 WHERE user_id = ?`,
                [
                    license_number.trim(),
                    holder_name.trim(),
                    date_of_birth || null,
                    issue_date,
                    expiry_date,
                    validVehicleClass,
                    frontPath,
                    backPath,
                    userId
                ]
            );
        } else {
            // Insert new record
            await db.query(
                `INSERT INTO customer_licenses
                 (user_id, license_number, holder_name, date_of_birth, issue_date, expiry_date, vehicle_class, front_document_path, back_document_path, verification_status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
                [
                    userId,
                    license_number.trim(),
                    holder_name.trim(),
                    date_of_birth || null,
                    issue_date,
                    expiry_date,
                    validVehicleClass,
                    frontPath,
                    backPath
                ]
            );
        }

        // Send confirmation notification to customer
        await createNotification({
            userId,
            type: 'license_submitted',
            title: 'Driving Licence Submitted',
            message: 'Your driving licence has been submitted and is currently pending administrator verification.'
        });

        return res.status(200).json({
            message: 'Driving licence submitted successfully. Awaiting administrator review.',
            status: 'pending'
        });
    } catch (error) {
        console.error('Error submitting customer license:', error);
        return res.status(500).json({ message: 'Failed to submit driving licence' });
    }
};

/**
 * Resolves physical file path on server for driving licence documents
 * Safely tests multiple standard storage candidate locations.
 */
function resolveLicenseFilePath(storedPath) {
    if (!storedPath || typeof storedPath !== 'string') return null;

    const baseDir = path.resolve(__dirname, '..');
    const uploadLicensesDir = path.resolve(baseDir, 'uploads', 'customer_licenses');
    const uploadsDir = path.resolve(baseDir, 'uploads');

    // 1. Direct in backend/uploads/customer_licenses/<safeBase>
    const safeBase = path.basename(storedPath);
    const candidate1 = path.resolve(uploadLicensesDir, safeBase);
    if (fs.existsSync(candidate1) && fs.statSync(candidate1).isFile()) {
        return candidate1;
    }

    // 2. Relative to backend root directory (e.g. "uploads/customer_licenses/...")
    const cleanRelative = storedPath.replace(/^[/\\]+/, '').replace(/\//g, path.sep);
    const candidate2 = path.resolve(baseDir, cleanRelative);
    if (candidate2.startsWith(baseDir) && fs.existsSync(candidate2) && fs.statSync(candidate2).isFile()) {
        return candidate2;
    }

    // 3. Direct in backend/uploads/<safeBase>
    const candidate3 = path.resolve(uploadsDir, safeBase);
    if (fs.existsSync(candidate3) && fs.statSync(candidate3).isFile()) {
        return candidate3;
    }

    // 4. Absolute path
    if (path.isAbsolute(storedPath) && fs.existsSync(storedPath) && fs.statSync(storedPath).isFile()) {
        return storedPath;
    }

    return null;
}

/**
 * GET /api/licenses/my-license/document/:side
 * Securely stream customer's own uploaded licence document
 */
const downloadMyLicenseDoc = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const side = req.params.side; // 'front' or 'back'

        if (side !== 'front' && side !== 'back') {
            return res.status(400).json({ message: 'Invalid document side requested. Must be "front" or "back".' });
        }

        const [rows] = await db.query(
            'SELECT front_document_path, back_document_path FROM customer_licenses WHERE user_id = ?',
            [userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'No driving licence record found for your account.' });
        }

        const filename = side === 'front' ? rows[0].front_document_path : rows[0].back_document_path;
        if (!filename) {
            return res.status(404).json({ message: `No ${side}-side document has been uploaded for this licence.` });
        }

        const filePath = resolveLicenseFilePath(filename);
        if (!filePath) {
            return res.status(404).json({
                message: `The ${side}-side driving licence document was not found on server storage.`
            });
        }

        const ext = path.extname(filePath).toLowerCase();
        const mimeMap = {
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.webp': 'image/webp'
        };

        const contentType = mimeMap[ext] || 'application/octet-stream';
        const safeFilename = `${side}_driving_licence_${path.basename(filePath)}`;

        res.setHeader('Content-Type', contentType);
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type');
        res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);
        fs.createReadStream(filePath).pipe(res);
    } catch (error) {
        console.error('Error streaming customer license document:', error);
        return res.status(500).json({ message: 'Failed to access driving licence document' });
    }
};

/**
 * GET /api/admin/licenses
 * Admin lists all customer licence submissions
 */
const getAllLicenses = async (req, res) => {
    try {
        const { status, search } = req.query;
        const conditions = [];
        const params = [];

        if (status && status !== 'all') {
            conditions.push('l.verification_status = ?');
            params.push(status.toLowerCase());
        }

        if (search && search.trim()) {
            const query = `%${search.trim().toLowerCase()}%`;
            conditions.push('(LOWER(u.name) LIKE ? OR LOWER(u.email) LIKE ? OR LOWER(l.license_number) LIKE ?)');
            params.push(query, query, query);
        }

        const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const [rows] = await db.query(
            `SELECT
                l.id,
                l.user_id,
                u.name AS customer_name,
                u.email AS customer_email,
                l.license_number,
                l.holder_name,
                l.date_of_birth,
                l.issue_date,
                l.expiry_date,
                l.vehicle_class,
                l.front_document_path,
                l.back_document_path,
                l.verification_status,
                l.rejection_reason,
                l.verified_by,
                admin_u.name AS verified_by_name,
                l.verified_at,
                l.created_at,
                l.updated_at
             FROM customer_licenses l
             JOIN users u ON l.user_id = u.user_id
             LEFT JOIN users admin_u ON l.verified_by = admin_u.user_id
             ${whereSql}
             ORDER BY l.updated_at DESC`,
            params
        );

        const licenses = rows.map((lic) => {
            const computedStatus = evaluateLicenseStatus(lic.verification_status, lic.expiry_date);
            return {
                id: lic.id,
                user_id: lic.user_id,
                customer_name: lic.customer_name,
                customer_email: lic.customer_email,
                masked_license_number: maskLicenseNumber(lic.license_number),
                full_license_number: lic.license_number,
                holder_name: lic.holder_name,
                date_of_birth: lic.date_of_birth,
                issue_date: lic.issue_date,
                expiry_date: lic.expiry_date,
                vehicle_class: lic.vehicle_class,
                has_front: Boolean(lic.front_document_path),
                has_back: Boolean(lic.back_document_path),
                verification_status: computedStatus,
                raw_status: lic.verification_status,
                rejection_reason: lic.rejection_reason,
                verified_by_name: lic.verified_by_name,
                verified_at: lic.verified_at,
                created_at: lic.created_at,
                updated_at: lic.updated_at
            };
        });

        return res.status(200).json(licenses);
    } catch (error) {
        console.error('Error fetching admin licenses:', error);
        return res.status(500).json({ message: 'Failed to retrieve licences' });
    }
};

/**
 * GET /api/admin/licenses/:id
 * Admin views single customer licence with full unmasked details
 */
const getLicenseById = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ message: 'Invalid licence ID' });
        }

        const [rows] = await db.query(
            `SELECT
                l.id,
                l.user_id,
                u.name AS customer_name,
                u.email AS customer_email,
                l.license_number,
                l.holder_name,
                l.date_of_birth,
                l.issue_date,
                l.expiry_date,
                l.vehicle_class,
                l.front_document_path,
                l.back_document_path,
                l.verification_status,
                l.rejection_reason,
                l.verified_by,
                admin_u.name AS verified_by_name,
                l.verified_at,
                l.created_at,
                l.updated_at
             FROM customer_licenses l
             JOIN users u ON l.user_id = u.user_id
             LEFT JOIN users admin_u ON l.verified_by = admin_u.user_id
             WHERE l.id = ?`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Driving licence not found' });
        }

        const lic = rows[0];
        const computedStatus = evaluateLicenseStatus(lic.verification_status, lic.expiry_date);

        return res.status(200).json({
            ...lic,
            verification_status: computedStatus,
            masked_license_number: maskLicenseNumber(lic.license_number)
        });
    } catch (error) {
        console.error('Error fetching licence by id:', error);
        return res.status(500).json({ message: 'Failed to retrieve licence details' });
    }
};

/**
 * PATCH /api/admin/licenses/:id/verify
 * Admin approves a driving licence
 */
const verifyLicense = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const adminId = req.user.user_id;

        const [rows] = await db.query(
            'SELECT id, user_id, expiry_date FROM customer_licenses WHERE id = ?',
            [id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Driving licence not found' });
        }

        const lic = rows[0];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const exp = new Date(lic.expiry_date);
        exp.setHours(0, 0, 0, 0);

        if (exp.getTime() < today.getTime()) {
            return res.status(400).json({
                message: 'Cannot verify an expired licence. Customer must provide a valid renewed licence.'
            });
        }

        await db.query(
            `UPDATE customer_licenses
             SET verification_status = 'verified',
                 rejection_reason = NULL,
                 verified_by = ?,
                 verified_at = NOW(),
                 updated_at = NOW()
             WHERE id = ?`,
            [adminId, id]
        );

        // Notify customer
        await createNotification({
            userId: lic.user_id,
            type: 'license_verified',
            title: 'Driving Licence Verified',
            message: 'Your driving licence has been successfully verified. You are now authorized to reserve eligible RentIQ vehicles.',
            relatedRecordId: id
        });

        return res.status(200).json({
            message: 'Driving licence successfully verified and approved.',
            status: 'verified'
        });
    } catch (error) {
        console.error('Error verifying licence:', error);
        return res.status(500).json({ message: 'Failed to verify driving licence' });
    }
};

/**
 * PATCH /api/admin/licenses/:id/reject
 * Admin rejects a driving licence with reason
 */
const rejectLicense = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const adminId = req.user.user_id;
        const { rejection_reason } = req.body;

        if (!rejection_reason || !rejection_reason.trim()) {
            return res.status(400).json({ message: 'Rejection reason is required.' });
        }

        const [rows] = await db.query(
            'SELECT id, user_id FROM customer_licenses WHERE id = ?',
            [id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Driving licence not found' });
        }

        const lic = rows[0];
        const reason = rejection_reason.trim();

        await db.query(
            `UPDATE customer_licenses
             SET verification_status = 'rejected',
                 rejection_reason = ?,
                 verified_by = ?,
                 verified_at = NOW(),
                 updated_at = NOW()
             WHERE id = ?`,
            [reason, adminId, id]
        );

        // Notify customer
        await createNotification({
            userId: lic.user_id,
            type: 'license_rejected',
            title: 'Driving Licence Verification Rejected',
            message: `Your driving licence verification was rejected. Reason: ${reason}. Please update and resubmit your documents in your profile.`,
            relatedRecordId: id
        });

        return res.status(200).json({
            message: 'Driving licence has been marked as rejected.',
            status: 'rejected',
            rejection_reason: reason
        });
    } catch (error) {
        console.error('Error rejecting licence:', error);
        return res.status(500).json({ message: 'Failed to reject driving licence' });
    }
};

/**
 * GET /api/admin/licenses/:id/document/:side
 * Admin streams customer licence document
 */
const downloadAdminLicenseDoc = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const side = req.params.side;

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ message: 'Invalid driving licence ID' });
        }

        if (side !== 'front' && side !== 'back') {
            return res.status(400).json({ message: 'Invalid document side. Must be "front" or "back".' });
        }

        const [rows] = await db.query(
            'SELECT front_document_path, back_document_path FROM customer_licenses WHERE id = ?',
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Driving licence record not found.' });
        }

        const filename = side === 'front' ? rows[0].front_document_path : rows[0].back_document_path;
        if (!filename) {
            return res.status(404).json({ message: `No ${side}-side document has been uploaded for this licence.` });
        }

        const filePath = resolveLicenseFilePath(filename);
        if (!filePath) {
            return res.status(404).json({
                message: `The ${side}-side driving licence document was not found on server storage.`
            });
        }

        const ext = path.extname(filePath).toLowerCase();
        const mimeMap = {
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.webp': 'image/webp'
        };

        const contentType = mimeMap[ext] || 'application/octet-stream';
        const safeFilename = `license_${side}_${path.basename(filePath)}`;

        res.setHeader('Content-Type', contentType);
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type');
        res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);
        fs.createReadStream(filePath).pipe(res);
    } catch (error) {
        console.error('Error streaming admin license doc:', error);
        return res.status(500).json({ message: 'Failed to stream document' });
    }
};

module.exports = {
    getMyLicense,
    submitLicense,
    downloadMyLicenseDoc,
    getAllLicenses,
    getLicenseById,
    verifyLicense,
    rejectLicense,
    downloadAdminLicenseDoc,
    maskLicenseNumber,
    evaluateLicenseStatus
};

