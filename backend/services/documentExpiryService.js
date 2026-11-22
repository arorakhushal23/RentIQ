/**
 * RentIQ Automated Document & Licence Expiry Service
 *
 * File: backend/services/documentExpiryService.js
 *
 * Provides dynamic scanning, status transitions, and deduplicated notification
 * dispatching for vehicle compliance documents and customer driving licences.
 */

const db = require('../config/db');
const { calculateDocumentStatus, getDocumentAlertMilestone } = require('../utils/documentStatusHelper');
const { createNotification, notifyAdminsOfDocumentAlert } = require('../utils/notificationHelper');

/**
 * Scans vehicle compliance documents across the fleet.
 * Automatically marks expired documents as 'expired' and dispatches alerts to admins.
 */
async function scanVehicleDocuments(conn = null) {
    const runner = conn || db;
    let expiredCount = 0;
    let expiringSoonCount = 0;
    let statusUpdatedCount = 0;
    let alertsDispatched = 0;

    const [rows] = await runner.query(`
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
    `);

    for (const doc of rows) {
        const { status: dynamicStatus, daysRemaining } = calculateDocumentStatus(doc.expiry_date, doc.verification_status);

        // If document is expired in real time but still marked valid/pending/expiring_soon in DB, update status
        if (dynamicStatus === 'expired' && doc.verification_status !== 'expired' && doc.verification_status !== 'rejected') {
            await runner.query(
                "UPDATE vehicle_documents SET verification_status = 'expired' WHERE id = ?",
                [doc.id]
            );
            statusUpdatedCount++;
        }

        if (dynamicStatus === 'expired') {
            expiredCount++;
        } else if (dynamicStatus === 'expiring_soon') {
            expiringSoonCount++;
        }

        // Check if an alert milestone is reached
        const milestone = getDocumentAlertMilestone(daysRemaining);
        if (milestone) {
            const vehicle = {
                vehicle_id: doc.vehicle_id,
                name: doc.vehicle_name,
                brand: doc.vehicle_brand,
                registration_number: doc.registration_number
            };

            await notifyAdminsOfDocumentAlert({
                vehicle,
                document: {
                    id: doc.id,
                    document_type: doc.document_type,
                    expiry_date: doc.expiry_date
                },
                alertType: milestone === 'expired' ? 'expired' : 'expiring_soon',
                daysRemaining
            });
            alertsDispatched++;
        }
    }

    return {
        totalScanned: rows.length,
        expired: expiredCount,
        expiringSoon: expiringSoonCount,
        statusUpdated: statusUpdatedCount,
        alertsDispatched
    };
}

/**
 * Scans customer driving licences.
 * If a verified licence has expired, marks it 'expired' and alerts the customer.
 * If approaching expiry (within 30 days), sends a courtesy renewal reminder.
 */
async function scanCustomerLicenses(conn = null) {
    const runner = conn || db;
    let expiredCount = 0;
    let expiringSoonCount = 0;
    let statusUpdatedCount = 0;
    let customerAlertsDispatched = 0;

    const [rows] = await runner.query(`
        SELECT
            l.id,
            l.user_id,
            l.license_number,
            l.holder_name,
            l.expiry_date,
            l.verification_status,
            u.name AS customer_name,
            u.email AS customer_email
        FROM customer_licenses l
        JOIN users u ON l.user_id = u.user_id
        WHERE l.verification_status IN ('verified', 'pending', 'expired')
    `);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const lic of rows) {
        if (!lic.expiry_date) continue;

        const exp = new Date(lic.expiry_date);
        exp.setHours(0, 0, 0, 0);
        const diffMs = exp.getTime() - today.getTime();
        const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        const expDateFormatted = typeof lic.expiry_date === 'string'
            ? lic.expiry_date.split('T')[0]
            : lic.expiry_date.toISOString().split('T')[0];

        if (daysRemaining < 0) {
            expiredCount++;
            if (lic.verification_status === 'verified') {
                await runner.query(
                    "UPDATE customer_licenses SET verification_status = 'expired', updated_at = NOW() WHERE id = ?",
                    [lic.id]
                );
                statusUpdatedCount++;

                // Notify customer of licence expiration
                await createNotification({
                    userId: lic.user_id,
                    type: `license_expired_${lic.id}`,
                    title: 'Driving Licence Expired',
                    message: `Your driving licence on file (${lic.license_number}) expired on ${expDateFormatted}. Please submit an updated renewed licence in your profile to maintain booking eligibility.`,
                    relatedRecordId: lic.id
                });
                customerAlertsDispatched++;
            }
        } else if (daysRemaining <= 30 && lic.verification_status === 'verified') {
            expiringSoonCount++;
            // Send courtesy reminder milestone: 30, 15, or 7 days
            let milestoneType = null;
            if (daysRemaining <= 7) milestoneType = '7';
            else if (daysRemaining <= 15) milestoneType = '15';
            else if (daysRemaining <= 30) milestoneType = '30';

            if (milestoneType) {
                await createNotification({
                    userId: lic.user_id,
                    type: `license_expiring_${milestoneType}_${lic.id}`,
                    title: 'Driving Licence Expiring Soon',
                    message: `Your driving licence on file will expire in ${daysRemaining} day(s) on ${expDateFormatted}. Please initiate renewal to prevent rental booking interruptions.`,
                    relatedRecordId: lic.id
                });
                customerAlertsDispatched++;
            }
        }
    }

    return {
        totalScanned: rows.length,
        expired: expiredCount,
        expiringSoon: expiringSoonCount,
        statusUpdated: statusUpdatedCount,
        customerAlertsDispatched
    };
}

/**
 * Runs full scan across all vehicle documents and customer licences
 */
async function runFullFleetExpiryScan() {
    const vehResult = await scanVehicleDocuments();
    const licResult = await scanCustomerLicenses();
    return {
        timestamp: new Date().toISOString(),
        vehicleDocuments: vehResult,
        customerLicenses: licResult
    };
}

/**
 * Starts the internal in-process scheduler
 * Default interval: 12 hours (43,200,000 ms)
 */
let schedulerIntervalId = null;

function startExpiryScanScheduler(intervalMs = 12 * 60 * 60 * 1000) {
    if (schedulerIntervalId) {
        clearInterval(schedulerIntervalId);
    }

    // Run first scan after a short startup delay (10 seconds)
    setTimeout(() => {
        runFullFleetExpiryScan()
            .then(res => {
                console.log('[DocumentExpiryService] Initial startup scan completed:', res);
            })
            .catch(err => {
                console.warn('[DocumentExpiryService] Startup scan error:', err.message);
            });
    }, 10000);

    schedulerIntervalId = setInterval(() => {
        runFullFleetExpiryScan()
            .then(res => {
                console.log('[DocumentExpiryService] Scheduled scan completed:', res);
            })
            .catch(err => {
                console.warn('[DocumentExpiryService] Scheduled scan error:', err.message);
            });
    }, intervalMs);

    console.log(`[DocumentExpiryService] Expiry scan scheduler started (Interval: ${intervalMs / 3600000} hours)`);
}

function stopExpiryScanScheduler() {
    if (schedulerIntervalId) {
        clearInterval(schedulerIntervalId);
        schedulerIntervalId = null;
    }
}

module.exports = {
    scanVehicleDocuments,
    scanCustomerLicenses,
    runFullFleetExpiryScan,
    startExpiryScanScheduler,
    stopExpiryScanScheduler
};

