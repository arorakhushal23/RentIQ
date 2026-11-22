const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const {
    calculateDocumentStatus,
    getDocumentAlertMilestone
} = require('../utils/documentStatusHelper');
const { notifyAdminsOfDocumentAlert } = require('../utils/notificationHelper');
const { runFullFleetExpiryScan } = require('../services/documentExpiryService');

const VALID_DOC_TYPES = ['rc', 'insurance', 'puc', 'fitness', 'permit', 'road_tax'];

/**
 * Resolves physical file path on server for vehicle documents
 */
function resolveVehicleDocPath(storedPath) {
    if (!storedPath || typeof storedPath !== 'string') return null;

    const baseDir = path.resolve(__dirname, '..');
    const uploadDir = path.resolve(baseDir, 'uploads', 'vehicle_documents');
    const safeBase = path.basename(storedPath);
    const candidate = path.resolve(uploadDir, safeBase);

    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
    }

    // Relative to backend
    const candidateRel = path.resolve(baseDir, storedPath.replace(/^[/\\]+/, ''));
    if (candidateRel.startsWith(baseDir) && fs.existsSync(candidateRel) && fs.statSync(candidateRel).isFile()) {
        return candidateRel;
    }

    return null;
}

/**
 * GET /api/admin/vehicles/:vehicleId/documents
 */
const getVehicleDocuments = async (req, res) => {
    try {
        const vehicleId = Number(req.params.vehicleId);
        if (!Number.isInteger(vehicleId) || vehicleId <= 0) {
            return res.status(400).json({ message: 'Invalid vehicle ID' });
        }

        const [vehicles] = await db.query(
            'SELECT vehicle_id, name, brand, registration_number FROM vehicles WHERE vehicle_id = ?',
            [vehicleId]
        );
        if (vehicles.length === 0) {
            return res.status(404).json({ message: 'Vehicle not found' });
        }

        const [rows] = await db.query(
            `SELECT id, vehicle_id, document_type, document_number, issue_date, expiry_date,
                    file_path, verification_status, version, admin_remarks, uploaded_at, updated_at
             FROM vehicle_documents
             WHERE vehicle_id = ?
             ORDER BY id DESC`,
            [vehicleId]
        );

        const documents = rows.map((doc) => {
            const { status, daysRemaining } = calculateDocumentStatus(doc.expiry_date, doc.verification_status);
            return {
                ...doc,
                version: doc.version || 1,
                calculated_status: status,
                days_remaining: daysRemaining,
                file_name: path.basename(doc.file_path)
            };
        });

        return res.status(200).json({
            vehicle: vehicles[0],
            documents
        });
    } catch (error) {
        console.error('Error fetching vehicle documents:', error);
        return res.status(500).json({ message: 'Failed to fetch vehicle documents' });
    }
};

/**
 * POST /api/admin/vehicles/:vehicleId/documents
 * Uploads a document; if document of same type exists, archives the previous one to version history.
 */
const uploadDocument = async (req, res) => {
    try {
        const vehicleId = Number(req.params.vehicleId);
        const adminId = req.user.user_id;

        if (!Number.isInteger(vehicleId) || vehicleId <= 0) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'Invalid vehicle ID' });
        }

        const [vehicles] = await db.query(
            'SELECT vehicle_id, name, brand, registration_number FROM vehicles WHERE vehicle_id = ?',
            [vehicleId]
        );
        if (vehicles.length === 0) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(404).json({ message: 'Vehicle not found' });
        }
        const vehicle = vehicles[0];

        const { document_type, document_number, issue_date, expiry_date, admin_remarks } = req.body;

        if (!req.file) {
            return res.status(400).json({ message: 'Document file is required (PDF, JPG, PNG)' });
        }

        if (!document_type || !VALID_DOC_TYPES.includes(document_type.toLowerCase())) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({
                message: `Invalid document type. Allowed types: ${VALID_DOC_TYPES.join(', ')}`
            });
        }

        if (!document_number || !document_number.trim()) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'Document number is required' });
        }

        if (!expiry_date) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'Document expiry date is required' });
        }

        const filename = path.basename(req.file.path);
        const { status, daysRemaining } = calculateDocumentStatus(expiry_date, 'valid');

        // Check if an existing document of this type exists for this vehicle
        const [existingDocs] = await db.query(
            'SELECT * FROM vehicle_documents WHERE vehicle_id = ? AND document_type = ? LIMIT 1',
            [vehicleId, document_type.toLowerCase()]
        );

        let finalDocId;
        let finalVersion = 1;

        if (existingDocs.length > 0) {
            const oldDoc = existingDocs[0];
            const currentVer = oldDoc.version || 1;

            // Archive the old document into vehicle_document_versions
            await db.query(
                `INSERT INTO vehicle_document_versions
                 (document_id, vehicle_id, document_type, version_number, document_number, issue_date, expiry_date, file_path, verification_status, admin_remarks, archived_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    oldDoc.id,
                    oldDoc.vehicle_id,
                    oldDoc.document_type,
                    currentVer,
                    oldDoc.document_number,
                    oldDoc.issue_date,
                    oldDoc.expiry_date,
                    oldDoc.file_path,
                    oldDoc.verification_status,
                    oldDoc.admin_remarks,
                    adminId
                ]
            );

            finalVersion = currentVer + 1;
            finalDocId = oldDoc.id;

            // Update the existing row to new version
            await db.query(
                `UPDATE vehicle_documents
                 SET document_number = ?, issue_date = ?, expiry_date = ?, file_path = ?,
                     verification_status = ?, version = ?, admin_remarks = ?, updated_at = NOW()
                 WHERE id = ?`,
                [
                    document_number.trim(),
                    issue_date || null,
                    expiry_date,
                    filename,
                    status,
                    finalVersion,
                    admin_remarks ? admin_remarks.trim() : null,
                    finalDocId
                ]
            );

            // Log renewal into verification logs
            await db.query(
                `INSERT INTO document_verification_logs
                 (document_type, document_id, reference_id, previous_status, new_status, admin_id, remarks)
                 VALUES ('vehicle_document', ?, ?, ?, ?, ?, ?)`,
                [
                    finalDocId,
                    vehicle.registration_number,
                    oldDoc.verification_status,
                    status,
                    adminId,
                    `Document renewed to version ${finalVersion}. Previous document archived.`
                ]
            );
        } else {
            // First time upload for this document type
            const [result] = await db.query(
                `INSERT INTO vehicle_documents
                 (vehicle_id, document_type, document_number, issue_date, expiry_date, file_path, verification_status, version, admin_remarks)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    vehicleId,
                    document_type.toLowerCase(),
                    document_number.trim(),
                    issue_date || null,
                    expiry_date,
                    filename,
                    status,
                    1,
                    admin_remarks ? admin_remarks.trim() : null
                ]
            );
            finalDocId = result.insertId;

            // Log initial creation
            await db.query(
                `INSERT INTO document_verification_logs
                 (document_type, document_id, reference_id, previous_status, new_status, admin_id, remarks)
                 VALUES ('vehicle_document', ?, ?, 'not_submitted', ?, ?, ?)`,
                [
                    finalDocId,
                    vehicle.registration_number,
                    status,
                    adminId,
                    `Initial certificate upload (v1): ${document_number.trim()}`
                ]
            );
        }

        // Check if expiry notification needed
        const alertMilestone = getDocumentAlertMilestone(daysRemaining);
        if (alertMilestone) {
            await notifyAdminsOfDocumentAlert({
                vehicle,
                document: {
                    id: finalDocId,
                    document_type: document_type.toLowerCase(),
                    expiry_date
                },
                alertType: alertMilestone === 'expired' ? 'expired' : 'expiring_soon',
                daysRemaining
            });
        }

        return res.status(201).json({
            message: existingDocs.length > 0 ? 'Vehicle document renewed successfully' : 'Vehicle document uploaded successfully',
            document: {
                id: finalDocId,
                vehicle_id: vehicleId,
                document_type: document_type.toLowerCase(),
                document_number: document_number.trim(),
                issue_date,
                expiry_date,
                file_path: filename,
                version: finalVersion,
                verification_status: status,
                calculated_status: status,
                days_remaining: daysRemaining,
                admin_remarks: admin_remarks ? admin_remarks.trim() : null
            }
        });
    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        console.error('Error uploading vehicle document:', error);
        return res.status(500).json({ message: 'Failed to upload document' });
    }
};

/**
 * POST /api/admin/documents/:id/renew
 * Explicit renewal endpoint for an existing document ID
 */
const renewDocument = async (req, res) => {
    try {
        const docId = Number(req.params.id);
        const adminId = req.user.user_id;

        if (!Number.isInteger(docId) || docId <= 0) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'Invalid document ID' });
        }

        const [docs] = await db.query(
            `SELECT d.*, v.registration_number, v.brand, v.name AS vehicle_name
             FROM vehicle_documents d
             JOIN vehicles v ON d.vehicle_id = v.vehicle_id
             WHERE d.id = ?`,
            [docId]
        );
        if (docs.length === 0) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(404).json({ message: 'Document not found' });
        }

        const oldDoc = docs[0];
        const { document_number, issue_date, expiry_date, admin_remarks } = req.body;

        if (!req.file) {
            return res.status(400).json({ message: 'New renewal document file is required' });
        }
        if (!document_number || !document_number.trim()) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'Document number is required' });
        }
        if (!expiry_date) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'Renewal expiry date is required' });
        }

        const filename = path.basename(req.file.path);
        const currentVer = oldDoc.version || 1;
        const newVer = currentVer + 1;
        const { status, daysRemaining } = calculateDocumentStatus(expiry_date, 'valid');

        // 1. Archive old document
        await db.query(
            `INSERT INTO vehicle_document_versions
             (document_id, vehicle_id, document_type, version_number, document_number, issue_date, expiry_date, file_path, verification_status, admin_remarks, archived_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                oldDoc.id,
                oldDoc.vehicle_id,
                oldDoc.document_type,
                currentVer,
                oldDoc.document_number,
                oldDoc.issue_date,
                oldDoc.expiry_date,
                oldDoc.file_path,
                oldDoc.verification_status,
                oldDoc.admin_remarks,
                adminId
            ]
        );

        // 2. Update active document
        await db.query(
            `UPDATE vehicle_documents
             SET document_number = ?, issue_date = ?, expiry_date = ?, file_path = ?,
                 verification_status = ?, version = ?, admin_remarks = ?, updated_at = NOW()
             WHERE id = ?`,
            [
                document_number.trim(),
                issue_date || null,
                expiry_date,
                filename,
                status,
                newVer,
                admin_remarks ? admin_remarks.trim() : null,
                docId
            ]
        );

        // 3. Log verification audit record
        await db.query(
            `INSERT INTO document_verification_logs
             (document_type, document_id, reference_id, previous_status, new_status, admin_id, remarks)
             VALUES ('vehicle_document', ?, ?, ?, ?, ?, ?)`,
            [
                docId,
                oldDoc.registration_number,
                oldDoc.verification_status,
                status,
                adminId,
                `Document renewed from v${currentVer} to v${newVer}. New expiry: ${expiry_date}`
            ]
        );

        return res.status(200).json({
            message: `Document renewed successfully (version ${newVer})`,
            document: {
                id: docId,
                vehicle_id: oldDoc.vehicle_id,
                document_type: oldDoc.document_type,
                document_number: document_number.trim(),
                issue_date,
                expiry_date,
                file_path: filename,
                version: newVer,
                verification_status: status,
                calculated_status: status,
                days_remaining: daysRemaining,
                admin_remarks: admin_remarks ? admin_remarks.trim() : null
            }
        });
    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        console.error('Error renewing vehicle document:', error);
        return res.status(500).json({ message: 'Failed to renew document' });
    }
};

/**
 * PATCH /api/admin/documents/:id/verify
 * Administrator verifies and approves a vehicle document
 */
const verifyDocument = async (req, res) => {
    try {
        const docId = Number(req.params.id);
        const adminId = req.user.user_id;
        const { admin_remarks } = req.body || {};

        if (!Number.isInteger(docId) || docId <= 0) {
            return res.status(400).json({ message: 'Invalid document ID' });
        }

        const [docs] = await db.query(
            `SELECT d.*, v.registration_number
             FROM vehicle_documents d
             JOIN vehicles v ON d.vehicle_id = v.vehicle_id
             WHERE d.id = ?`,
            [docId]
        );
        if (docs.length === 0) {
            return res.status(404).json({ message: 'Document not found' });
        }

        const doc = docs[0];
        const { status, daysRemaining } = calculateDocumentStatus(doc.expiry_date, 'valid');

        if (status === 'expired') {
            return res.status(400).json({
                message: 'Cannot verify an expired document. Please renew the document with a valid future expiry date.'
            });
        }

        const updatedRemarks = admin_remarks ? admin_remarks.trim() : (doc.admin_remarks || 'Verified and approved by administrator');

        await db.query(
            `UPDATE vehicle_documents
             SET verification_status = 'valid', admin_remarks = ?, updated_at = NOW()
             WHERE id = ?`,
            [updatedRemarks, docId]
        );

        // Record verification audit log
        await db.query(
            `INSERT INTO document_verification_logs
             (document_type, document_id, reference_id, previous_status, new_status, admin_id, remarks)
             VALUES ('vehicle_document', ?, ?, ?, 'valid', ?, ?)`,
            [
                docId,
                doc.registration_number,
                doc.verification_status,
                adminId,
                updatedRemarks
            ]
        );

        return res.status(200).json({
            message: 'Vehicle document verified and approved successfully',
            status: 'valid',
            calculated_status: status,
            days_remaining: daysRemaining
        });
    } catch (error) {
        console.error('Error verifying vehicle document:', error);
        return res.status(500).json({ message: 'Failed to verify document' });
    }
};

/**
 * PATCH /api/admin/documents/:id/reject
 * Administrator rejects a vehicle document with mandatory remarks
 */
const rejectDocument = async (req, res) => {
    try {
        const docId = Number(req.params.id);
        const adminId = req.user.user_id;
        const { admin_remarks } = req.body || {};

        if (!Number.isInteger(docId) || docId <= 0) {
            return res.status(400).json({ message: 'Invalid document ID' });
        }

        if (!admin_remarks || !admin_remarks.trim()) {
            return res.status(400).json({ message: 'Rejection reason / admin remarks are required.' });
        }

        const [docs] = await db.query(
            `SELECT d.*, v.registration_number
             FROM vehicle_documents d
             JOIN vehicles v ON d.vehicle_id = v.vehicle_id
             WHERE d.id = ?`,
            [docId]
        );
        if (docs.length === 0) {
            return res.status(404).json({ message: 'Document not found' });
        }

        const doc = docs[0];
        const reason = admin_remarks.trim();

        await db.query(
            `UPDATE vehicle_documents
             SET verification_status = 'rejected', admin_remarks = ?, updated_at = NOW()
             WHERE id = ?`,
            [reason, docId]
        );

        // Record verification audit log
        await db.query(
            `INSERT INTO document_verification_logs
             (document_type, document_id, reference_id, previous_status, new_status, admin_id, remarks)
             VALUES ('vehicle_document', ?, ?, ?, 'rejected', ?, ?)`,
            [
                docId,
                doc.registration_number,
                doc.verification_status,
                adminId,
                reason
            ]
        );

        return res.status(200).json({
            message: 'Vehicle document has been marked as rejected',
            status: 'rejected',
            admin_remarks: reason
        });
    } catch (error) {
        console.error('Error rejecting vehicle document:', error);
        return res.status(500).json({ message: 'Failed to reject document' });
    }
};

/**
 * PUT /api/admin/documents/:id
 */
const updateDocument = async (req, res) => {
    try {
        const docId = Number(req.params.id);
        const adminId = req.user.user_id;

        if (!Number.isInteger(docId) || docId <= 0) {
            return res.status(400).json({ message: 'Invalid document ID' });
        }

        const [docs] = await db.query(
            `SELECT d.*, v.registration_number
             FROM vehicle_documents d
             JOIN vehicles v ON d.vehicle_id = v.vehicle_id
             WHERE d.id = ?`,
            [docId]
        );
        if (docs.length === 0) {
            return res.status(404).json({ message: 'Document not found' });
        }

        const currentDoc = docs[0];
        const {
            document_number,
            issue_date,
            expiry_date,
            verification_status,
            admin_remarks
        } = req.body;

        const updatedDocNum = document_number ? document_number.trim() : currentDoc.document_number;
        const updatedIssueDate = issue_date !== undefined ? (issue_date || null) : currentDoc.issue_date;
        const updatedExpiryDate = expiry_date || currentDoc.expiry_date;
        const updatedRemarks = admin_remarks !== undefined ? (admin_remarks ? admin_remarks.trim() : null) : currentDoc.admin_remarks;

        let statusToStore = verification_status || currentDoc.verification_status;
        const { status: calculated } = calculateDocumentStatus(updatedExpiryDate, statusToStore);
        if (!verification_status || verification_status === 'valid') {
            statusToStore = calculated;
        }

        await db.query(
            `UPDATE vehicle_documents
             SET document_number = ?, issue_date = ?, expiry_date = ?, verification_status = ?, admin_remarks = ?
             WHERE id = ?`,
            [updatedDocNum, updatedIssueDate, updatedExpiryDate, statusToStore, updatedRemarks, docId]
        );

        if (statusToStore !== currentDoc.verification_status) {
            await db.query(
                `INSERT INTO document_verification_logs
                 (document_type, document_id, reference_id, previous_status, new_status, admin_id, remarks)
                 VALUES ('vehicle_document', ?, ?, ?, ?, ?, ?)`,
                [
                    docId,
                    currentDoc.registration_number,
                    currentDoc.verification_status,
                    statusToStore,
                    adminId,
                    updatedRemarks || 'Status updated via document edit'
                ]
            );
        }

        return res.status(200).json({
            message: 'Document updated successfully',
            document: {
                ...currentDoc,
                document_number: updatedDocNum,
                issue_date: updatedIssueDate,
                expiry_date: updatedExpiryDate,
                verification_status: statusToStore,
                calculated_status: calculated,
                admin_remarks: updatedRemarks
            }
        });
    } catch (error) {
        console.error('Error updating document:', error);
        return res.status(500).json({ message: 'Failed to update document' });
    }
};

/**
 * DELETE /api/admin/documents/:id
 */
const deleteDocument = async (req, res) => {
    try {
        const docId = Number(req.params.id);
        if (!Number.isInteger(docId) || docId <= 0) {
            return res.status(400).json({ message: 'Invalid document ID' });
        }

        const [docs] = await db.query(
            'SELECT id, file_path FROM vehicle_documents WHERE id = ?',
            [docId]
        );
        if (docs.length === 0) {
            return res.status(404).json({ message: 'Document not found' });
        }

        const resolved = resolveVehicleDocPath(docs[0].file_path);
        if (resolved && fs.existsSync(resolved)) {
            try {
                fs.unlinkSync(resolved);
            } catch (err) {
                console.warn('Could not remove physical file:', err.message);
            }
        }

        await db.query('DELETE FROM vehicle_documents WHERE id = ?', [docId]);

        return res.status(200).json({ message: 'Document deleted successfully' });
    } catch (error) {
        console.error('Error deleting document:', error);
        return res.status(500).json({ message: 'Failed to delete document' });
    }
};

/**
 * GET /api/admin/documents/:id/download
 */
const downloadDocument = async (req, res) => {
    try {
        const docId = Number(req.params.id);
        if (!Number.isInteger(docId) || docId <= 0) {
            return res.status(400).json({ message: 'Invalid document ID' });
        }

        const [docs] = await db.query(
            'SELECT * FROM vehicle_documents WHERE id = ?',
            [docId]
        );
        if (docs.length === 0) {
            return res.status(404).json({ message: 'Document not found' });
        }

        const doc = docs[0];
        const resolvedPath = resolveVehicleDocPath(doc.file_path);

        if (!resolvedPath || !fs.existsSync(resolvedPath)) {
            return res.status(404).json({
                message: 'Physical document file not found on server storage.'
            });
        }

        const safeBase = path.basename(resolvedPath);
        const ext = path.extname(safeBase).toLowerCase();
        const mimeTypes = {
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.webp': 'image/webp'
        };

        const contentType = mimeTypes[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type');
        res.setHeader('Content-Disposition', `inline; filename="${safeBase}"`);
        fs.createReadStream(resolvedPath).pipe(res);
    } catch (error) {
        console.error('Error downloading document:', error);
        return res.status(500).json({ message: 'Failed to retrieve document' });
    }
};

/**
 * GET /api/admin/documents/:id/versions
 * Retrieves previous historical versions of a document
 */
const getDocumentVersions = async (req, res) => {
    try {
        const docId = Number(req.params.id);
        if (!Number.isInteger(docId) || docId <= 0) {
            return res.status(400).json({ message: 'Invalid document ID' });
        }

        const [versions] = await db.query(
            `SELECT v.*, u.name AS archived_by_name
             FROM vehicle_document_versions v
             LEFT JOIN users u ON v.archived_by = u.user_id
             WHERE v.document_id = ?
             ORDER BY v.version_number DESC`,
            [docId]
        );

        return res.status(200).json(versions);
    } catch (error) {
        console.error('Error fetching document versions:', error);
        return res.status(500).json({ message: 'Failed to fetch document versions' });
    }
};

/**
 * GET /api/admin/documents/versions/:versionId/download
 * Streams an archived historical document file
 */
const downloadDocumentVersion = async (req, res) => {
    try {
        const versionId = Number(req.params.versionId);
        if (!Number.isInteger(versionId) || versionId <= 0) {
            return res.status(400).json({ message: 'Invalid version ID' });
        }

        const [rows] = await db.query(
            'SELECT * FROM vehicle_document_versions WHERE id = ?',
            [versionId]
        );
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Historical document version record not found' });
        }

        const ver = rows[0];
        const resolvedPath = resolveVehicleDocPath(ver.file_path);

        if (!resolvedPath || !fs.existsSync(resolvedPath)) {
            return res.status(404).json({ message: 'Historical document file not found on storage' });
        }

        const safeBase = path.basename(resolvedPath);
        const ext = path.extname(safeBase).toLowerCase();
        const mimeTypes = {
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.webp': 'image/webp'
        };

        const contentType = mimeTypes[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type');
        res.setHeader('Content-Disposition', `inline; filename="archived_v${ver.version_number}_${safeBase}"`);
        fs.createReadStream(resolvedPath).pipe(res);
    } catch (error) {
        console.error('Error downloading document version:', error);
        return res.status(500).json({ message: 'Failed to retrieve document version' });
    }
};

/**
 * GET /api/admin/documents/:id/verification-logs
 * Retrieves verification audit trail for a vehicle document
 */
const getDocumentVerificationLogs = async (req, res) => {
    try {
        const docId = Number(req.params.id);
        if (!Number.isInteger(docId) || docId <= 0) {
            return res.status(400).json({ message: 'Invalid document ID' });
        }

        const [logs] = await db.query(
            `SELECT l.*, u.name AS admin_name, u.email AS admin_email
             FROM document_verification_logs l
             JOIN users u ON l.admin_id = u.user_id
             WHERE l.document_type = 'vehicle_document' AND l.document_id = ?
             ORDER BY l.created_at DESC`,
            [docId]
        );

        return res.status(200).json(logs);
    } catch (error) {
        console.error('Error fetching verification logs:', error);
        return res.status(500).json({ message: 'Failed to fetch verification audit trail' });
    }
};

/**
 * POST /api/admin/documents/scan-expiry
 * Triggers an immediate fleet-wide document and licence expiry scan
 */
const triggerFleetExpiryScan = async (req, res) => {
    try {
        const result = await runFullFleetExpiryScan();
        return res.status(200).json({
            message: 'Fleet document and driving licence expiry scan executed successfully.',
            scanResults: result
        });
    } catch (error) {
        console.error('Error running manual expiry scan:', error);
        return res.status(500).json({ message: 'Failed to execute fleet expiry scan' });
    }
};

/**
 * GET /api/admin/documents/alerts
 * Returns fleet-wide document alert counts and detailed alerts list
 */
const getDocumentAlerts = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                d.id,
                d.vehicle_id,
                d.document_type,
                d.document_number,
                d.issue_date,
                d.expiry_date,
                d.verification_status,
                d.version,
                v.name AS vehicle_name,
                v.brand AS vehicle_brand,
                v.registration_number
            FROM vehicle_documents d
            JOIN vehicles v ON d.vehicle_id = v.vehicle_id
            ORDER BY d.expiry_date ASC
        `);

        const alerts = [];
        let expiredCount = 0;
        let expiring30Count = 0;
        let expiring15Count = 0;
        let expiring7Count = 0;

        for (const doc of rows) {
            const { status, daysRemaining } = calculateDocumentStatus(doc.expiry_date, doc.verification_status);
            const milestone = getDocumentAlertMilestone(daysRemaining);

            if (milestone) {
                if (milestone === 'expired') expiredCount++;
                else if (milestone === 'expiring_7') expiring7Count++;
                else if (milestone === 'expiring_15') expiring15Count++;
                else if (milestone === 'expiring_30') expiring30Count++;

                alerts.push({
                    id: doc.id,
                    vehicle_id: doc.vehicle_id,
                    vehicle_name: doc.vehicle_name,
                    vehicle_brand: doc.vehicle_brand,
                    registration_number: doc.registration_number,
                    document_type: doc.document_type,
                    document_number: doc.document_number,
                    expiry_date: doc.expiry_date,
                    version: doc.version || 1,
                    status,
                    days_remaining: daysRemaining,
                    milestone
                });
            }
        }

        return res.status(200).json({
            summary: {
                total_alerts: alerts.length,
                expired: expiredCount,
                expiring_7_days: expiring7Count,
                expiring_15_days: expiring15Count,
                expiring_30_days: expiring30Count
            },
            alerts
        });
    } catch (error) {
        console.error('Error fetching document alerts:', error);
        return res.status(500).json({ message: 'Failed to fetch document alerts' });
    }
};

module.exports = {
    getVehicleDocuments,
    uploadDocument,
    renewDocument,
    verifyDocument,
    rejectDocument,
    updateDocument,
    deleteDocument,
    downloadDocument,
    getDocumentVersions,
    downloadDocumentVersion,
    getDocumentVerificationLogs,
    triggerFleetExpiryScan,
    getDocumentAlerts
};
