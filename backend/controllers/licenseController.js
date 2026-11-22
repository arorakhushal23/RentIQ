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
                version,
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
                version: raw.version || 1,
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
 * Customer submits or resubmits licence.
 * If previous record exists, archives it into customer_license_history!
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
        let licenseId;
        let newVersion = 1;

        if (existing.length > 0) {
            const prev = existing[0];
            const currentVer = prev.version || 1;
            newVersion = currentVer + 1;
            licenseId = prev.id;

            // 1. Archive the previous record into customer_license_history
            await db.query(
                `INSERT INTO customer_license_history
                 (license_id, user_id, version_number, license_number, holder_name, date_of_birth, issue_date, expiry_date, vehicle_class, front_document_path, back_document_path, verification_status, rejection_reason, verified_by, verified_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    prev.id,
                    userId,
                    currentVer,
                    prev.license_number,
                    prev.holder_name,
                    prev.date_of_birth,
                    prev.issue_date,
                    prev.expiry_date,
                    prev.vehicle_class,
                    prev.front_document_path,
                    prev.back_document_path,
                    prev.verification_status,
                    prev.rejection_reason,
                    prev.verified_by,
                    prev.verified_at
                ]
            );

            // 2. Update existing record, reset verification to pending and increment version
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
                     version = ?,
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
                    newVersion,
                    userId
                ]
            );

            // 3. Log submission audit record
            await db.query(
                `INSERT INTO document_verification_logs
                 (document_type, document_id, reference_id, previous_status, new_status, admin_id, remarks)
                 VALUES ('customer_license', ?, ?, ?, 'pending', ?, ?)`,
                [
                    licenseId,
                    license_number.trim(),
                    prev.verification_status,
                    prev.verified_by || userId,
                    `Customer resubmitted/renewed driving licence (v${newVersion})`
                ]
            );
        } else {
            // First time submission
            const [result] = await db.query(
                `INSERT INTO customer_licenses
                 (user_id, license_number, holder_name, date_of_birth, issue_date, expiry_date, vehicle_class, front_document_path, back_document_path, verification_status, version)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 1)`,
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
            licenseId = result.insertId;

            // Log initial submission
            await db.query(
                `INSERT INTO document_verification_logs
                 (document_type, document_id, reference_id, previous_status, new_status, admin_id, remarks)
                 VALUES ('customer_license', ?, ?, 'not_submitted', 'pending', ?, ?)`,
                [
                    licenseId,
                    license_number.trim(),
                    userId,
                    'Initial customer driving licence submission (v1)'
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
            status: 'pending',
            version: newVersion
        });
    } catch (error) {
        console.error('Error submitting customer license:', error);
        return res.status(500).json({ message: 'Failed to submit driving licence' });
    }
};

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
 * GET /api/licenses/my-license/history
 * Customer retrieves their previous licence version history
 */
const getMyLicenseHistory = async (req, res) => {
    try {
        const userId = req.user.user_id;

        const [rows] = await db.query(
            `SELECT
                id,
                license_id,
                user_id,
                version_number,
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
                archived_at
             FROM customer_license_history
             WHERE user_id = ?
             ORDER BY version_number DESC`,
            [userId]
        );

        const history = rows.map(item => ({
            id: item.id,
            version_number: item.version_number,
            license_number: item.license_number,
            holder_name: item.holder_name,
            issue_date: item.issue_date,
            expiry_date: item.expiry_date,
            vehicle_class: item.vehicle_class,
            has_front: Boolean(item.front_document_path),
            has_back: Boolean(item.back_document_path),
            verification_status: item.verification_status,
            rejection_reason: item.rejection_reason,
            verified_at: item.verified_at,
            archived_at: item.archived_at
        }));

        return res.status(200).json(history);
    } catch (error) {
        console.error('Error fetching customer license history:', error);
        return res.status(500).json({ message: 'Failed to retrieve licence history' });
    }
};

/**
 * GET /api/licenses/my-license/history/:historyId/document/:side
 * Customer streams a document from their own historical licence submission
 */
const downloadMyLicenseHistoryDoc = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const historyId = Number(req.params.historyId);
        const side = req.params.side;

        if (!Number.isInteger(historyId) || historyId <= 0) {
            return res.status(400).json({ message: 'Invalid history ID' });
        }
        if (side !== 'front' && side !== 'back') {
            return res.status(400).json({ message: 'Invalid side requested. Must be "front" or "back".' });
        }

        const [rows] = await db.query(
            'SELECT user_id, front_document_path, back_document_path FROM customer_license_history WHERE id = ?',
            [historyId]
        );

        if (rows.length === 0 || rows[0].user_id !== userId) {
            return res.status(404).json({ message: 'Historical licence document not found' });
        }

        const filename = side === 'front' ? rows[0].front_document_path : rows[0].back_document_path;
        if (!filename) {
            return res.status(404).json({ message: `No ${side} document on record for this version` });
        }

        const filePath = resolveLicenseFilePath(filename);
        if (!filePath) {
            return res.status(404).json({ message: 'Historical document file not found on storage' });
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
        res.setHeader('Content-Type', contentType);
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type');
        res.setHeader('Content-Disposition', `inline; filename="archived_${side}_${path.basename(filePath)}"`);
        fs.createReadStream(filePath).pipe(res);
    } catch (error) {
        console.error('Error downloading customer license history doc:', error);
        return res.status(500).json({ message: 'Failed to retrieve historical licence document' });
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
                l.version,
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
                version: lic.version || 1,
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
                l.version,
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
            version: lic.version || 1,
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
 * Admin approves a driving licence and records in document_verification_logs
 */
const verifyLicense = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const adminId = req.user.user_id;
        const { remarks } = req.body || {};

        const [rows] = await db.query(
            'SELECT id, user_id, license_number, verification_status, expiry_date FROM customer_licenses WHERE id = ?',
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

        const approvalRemarks = remarks ? remarks.trim() : 'Driving licence verified and approved.';

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

        // Record immutable verification log
        await db.query(
            `INSERT INTO document_verification_logs
             (document_type, document_id, reference_id, previous_status, new_status, admin_id, remarks)
             VALUES ('customer_license', ?, ?, ?, 'verified', ?, ?)`,
            [
                id,
                lic.license_number,
                lic.verification_status,
                adminId,
                approvalRemarks
            ]
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
 * Admin rejects a driving licence with mandatory reason and records in document_verification_logs
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
            'SELECT id, user_id, license_number, verification_status FROM customer_licenses WHERE id = ?',
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

        // Record immutable verification log
        await db.query(
            `INSERT INTO document_verification_logs
             (document_type, document_id, reference_id, previous_status, new_status, admin_id, remarks)
             VALUES ('customer_license', ?, ?, ?, 'rejected', ?, ?)`,
            [
                id,
                lic.license_number,
                lic.verification_status,
                adminId,
                reason
            ]
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

/**
 * GET /api/admin/licenses/:id/history
 * Admin views historical versions of customer driving licence
 */
const getAdminLicenseHistory = async (req, res) => {
    try {
        const licenseId = Number(req.params.id);
        if (!Number.isInteger(licenseId) || licenseId <= 0) {
            return res.status(400).json({ message: 'Invalid licence ID' });
        }

        const [rows] = await db.query(
            `SELECT h.*, u.name AS verified_by_name
             FROM customer_license_history h
             LEFT JOIN users u ON h.verified_by = u.user_id
             WHERE h.license_id = ?
             ORDER BY h.version_number DESC`,
            [licenseId]
        );

        return res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching admin license history:', error);
        return res.status(500).json({ message: 'Failed to retrieve licence history' });
    }
};

/**
 * GET /api/admin/licenses/history/:historyId/document/:side
 * Admin streams a historical driving licence document
 */
const downloadAdminLicenseHistoryDoc = async (req, res) => {
    try {
        const historyId = Number(req.params.historyId);
        const side = req.params.side;

        if (!Number.isInteger(historyId) || historyId <= 0) {
            return res.status(400).json({ message: 'Invalid history ID' });
        }
        if (side !== 'front' && side !== 'back') {
            return res.status(400).json({ message: 'Invalid document side. Must be "front" or "back".' });
        }

        const [rows] = await db.query(
            'SELECT front_document_path, back_document_path FROM customer_license_history WHERE id = ?',
            [historyId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Historical licence record not found.' });
        }

        const filename = side === 'front' ? rows[0].front_document_path : rows[0].back_document_path;
        if (!filename) {
            return res.status(404).json({ message: `No ${side} document on record for this version` });
        }

        const filePath = resolveLicenseFilePath(filename);
        if (!filePath) {
            return res.status(404).json({ message: 'Historical document file not found on storage' });
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
        res.setHeader('Content-Type', contentType);
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type');
        res.setHeader('Content-Disposition', `inline; filename="history_${side}_${path.basename(filePath)}"`);
        fs.createReadStream(filePath).pipe(res);
    } catch (error) {
        console.error('Error streaming historical admin license doc:', error);
        return res.status(500).json({ message: 'Failed to stream historical document' });
    }
};

/**
 * GET /api/admin/licenses/:id/verification-logs
 * Admin reviews verification audit trail for a driving licence
 */
const getLicenseVerificationLogs = async (req, res) => {
    try {
        const licenseId = Number(req.params.id);
        if (!Number.isInteger(licenseId) || licenseId <= 0) {
            return res.status(400).json({ message: 'Invalid licence ID' });
        }

        const [logs] = await db.query(
            `SELECT l.*, u.name AS admin_name, u.email AS admin_email
             FROM document_verification_logs l
             JOIN users u ON l.admin_id = u.user_id
             WHERE l.document_type = 'customer_license' AND l.document_id = ?
             ORDER BY l.created_at DESC`,
            [licenseId]
        );

        return res.status(200).json(logs);
    } catch (error) {
        console.error('Error fetching license verification logs:', error);
        return res.status(500).json({ message: 'Failed to retrieve licence verification logs' });
    }
};

module.exports = {
    getMyLicense,
    submitLicense,
    downloadMyLicenseDoc,
    getMyLicenseHistory,
    downloadMyLicenseHistoryDoc,
    getAllLicenses,
    getLicenseById,
    verifyLicense,
    rejectLicense,
    downloadAdminLicenseDoc,
    getAdminLicenseHistory,
    downloadAdminLicenseHistoryDoc,
    getLicenseVerificationLogs,
    maskLicenseNumber,
    evaluateLicenseStatus
};
