const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const {
    calculateDocumentStatus,
    getDocumentAlertMilestone
} = require('../utils/documentStatusHelper');
const { notifyAdminsOfDocumentAlert } = require('../utils/notificationHelper');

const VALID_DOC_TYPES = ['rc', 'insurance', 'puc', 'fitness', 'permit', 'road_tax'];

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
                    file_path, verification_status, admin_remarks, uploaded_at, updated_at
             FROM vehicle_documents
             WHERE vehicle_id = ?
             ORDER BY id DESC`,
            [vehicleId]
        );

        const documents = rows.map((doc) => {
            const { status, daysRemaining } = calculateDocumentStatus(doc.expiry_date, doc.verification_status);
            return {
                ...doc,
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
 */
const uploadDocument = async (req, res) => {
    try {
        const vehicleId = Number(req.params.vehicleId);
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

        const [result] = await db.query(
            `INSERT INTO vehicle_documents
             (vehicle_id, document_type, document_number, issue_date, expiry_date, file_path, verification_status, admin_remarks)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                vehicleId,
                document_type.toLowerCase(),
                document_number.trim(),
                issue_date || null,
                expiry_date,
                filename,
                status,
                admin_remarks ? admin_remarks.trim() : null
            ]
        );

        const newDocId = result.insertId;

        // Check if expiry notification needed
        const alertMilestone = getDocumentAlertMilestone(daysRemaining);
        if (alertMilestone) {
            await notifyAdminsOfDocumentAlert({
                vehicle,
                document: {
                    id: newDocId,
                    document_type: document_type.toLowerCase(),
                    expiry_date
                },
                alertType: alertMilestone === 'expired' ? 'expired' : 'expiring_soon',
                daysRemaining
            });
        }

        return res.status(201).json({
            message: 'Vehicle document uploaded successfully',
            document: {
                id: newDocId,
                vehicle_id: vehicleId,
                document_type: document_type.toLowerCase(),
                document_number: document_number.trim(),
                issue_date,
                expiry_date,
                file_path: filename,
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
 * PUT /api/admin/documents/:id
 */
const updateDocument = async (req, res) => {
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

        const filePath = path.resolve(__dirname, '..', 'uploads', 'vehicle_documents', path.basename(docs[0].file_path));
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
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
        const safeBase = path.basename(doc.file_path);
        const resolvedPath = path.resolve(__dirname, '..', 'uploads', 'vehicle_documents', safeBase);

        if (!fs.existsSync(resolvedPath)) {
            // Check if mock / sample file name was seeded
            return res.status(404).json({
                message: 'Physical document file not found on server storage.'
            });
        }

        const ext = path.extname(safeBase).toLowerCase();
        const mimeTypes = {
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png'
        };

        const contentType = mimeTypes[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="${safeBase}"`);
        fs.createReadStream(resolvedPath).pipe(res);
    } catch (error) {
        console.error('Error downloading document:', error);
        return res.status(500).json({ message: 'Failed to retrieve document' });
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
    updateDocument,
    deleteDocument,
    downloadDocument,
    getDocumentAlerts
};

