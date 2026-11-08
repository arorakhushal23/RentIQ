/**
 * Document Status & Expiry Helper
 *
 * File: backend/utils/documentStatusHelper.js
 * Automatically determines document status and alert tiers based on expiry dates.
 */

/**
 * Calculates current document status based on expiry date and stored status
 * Returns: { status: 'valid' | 'expiring_soon' | 'expired' | 'pending' | 'rejected', daysRemaining: number }
 */
function calculateDocumentStatus(expiryDateStr, verificationStatus = 'valid') {
    if (verificationStatus === 'rejected') {
        return { status: 'rejected', daysRemaining: null };
    }
    if (verificationStatus === 'pending') {
        return { status: 'pending', daysRemaining: null };
    }

    if (!expiryDateStr) {
        return { status: 'pending', daysRemaining: null };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiry = new Date(expiryDateStr);
    expiry.setHours(0, 0, 0, 0);

    const diffMs = expiry.getTime() - today.getTime();
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) {
        return { status: 'expired', daysRemaining };
    } else if (daysRemaining <= 30) {
        return { status: 'expiring_soon', daysRemaining };
    } else {
        return { status: 'valid', daysRemaining };
    }
}

/**
 * Returns alert category for a document:
 * - 'expired': daysRemaining < 0
 * - 'expiring_7': daysRemaining <= 7
 * - 'expiring_15': daysRemaining <= 15
 * - 'expiring_30': daysRemaining <= 30
 * - null: not near expiry
 */
function getDocumentAlertMilestone(daysRemaining) {
    if (daysRemaining < 0) return 'expired';
    if (daysRemaining <= 7) return 'expiring_7';
    if (daysRemaining <= 15) return 'expiring_15';
    if (daysRemaining <= 30) return 'expiring_30';
    return null;
}

/**
 * Checks vehicle document booking eligibility.
 * Mandatory documents for all rental vehicles:
 * - RC Certificate ('rc')
 * - Insurance Certificate ('insurance')
 * - Pollution Under Control ('puc')
 *
 * For commercial/heavy vehicles (if applicable):
 * - Fitness Certificate ('fitness')
 * - Commercial Permit ('permit')
 *
 * Returns: { eligible: boolean, reason?: string, missingDocs?: string[], expiredDocs?: string[] }
 */
/**
 * Checks vehicle document booking eligibility.
 * Mandatory documents for all rental vehicles:
 * - RC Certificate ('rc')
 * - Insurance Certificate ('insurance')
 * - Pollution Under Control ('puc')
 *
 * For commercial/heavy vehicles (if applicable):
 * - Fitness Certificate ('fitness')
 * - Commercial Permit ('permit')
 *
 * @param {Array} documents - List of vehicle document records
 * @param {string} vehicleCategory - Category name of vehicle
 * @param {string|Date} [rentalEndDate=null] - Requested rental end date to verify documents stay valid through entire rental
 * Returns: { eligible: boolean, reason?: string, missingDocs?: string[], expiredDocs?: string[], adminReason?: string }
 */
function checkVehicleDocumentEligibility(documents, vehicleCategory = '', rentalEndDate = null) {
    const isTwoWheeler = ['bike', 'scooter'].includes((vehicleCategory || '').toLowerCase());
    
    // Mandatory document types for standard rental fleet
    const mandatoryTypes = ['rc', 'insurance', 'puc'];

    const presentDocs = {};
    for (const doc of documents) {
        presentDocs[doc.document_type] = doc;
    }

    const missingDocs = [];
    const expiredDocs = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let parsedRentalEnd = null;
    if (rentalEndDate) {
        parsedRentalEnd = new Date(rentalEndDate);
        if (!isNaN(parsedRentalEnd.getTime())) {
            parsedRentalEnd.setHours(0, 0, 0, 0);
        } else {
            parsedRentalEnd = null;
        }
    }

    for (const type of mandatoryTypes) {
        const doc = presentDocs[type];
        if (!doc) {
            missingDocs.push(type.toUpperCase());
        } else {
            const { status } = calculateDocumentStatus(doc.expiry_date, doc.verification_status);
            if (status === 'expired' || status === 'rejected') {
                expiredDocs.push(`${type.toUpperCase()} (${status})`);
            } else if (doc.expiry_date) {
                // If a rental period end date is provided, verify document does not expire during rental
                if (parsedRentalEnd) {
                    const exp = new Date(doc.expiry_date);
                    exp.setHours(0, 0, 0, 0);
                    if (exp.getTime() < parsedRentalEnd.getTime()) {
                        const expFormatted = doc.expiry_date.includes('T') ? doc.expiry_date.split('T')[0] : doc.expiry_date;
                        expiredDocs.push(`${type.toUpperCase()} (expires on ${expFormatted} before rental completion)`);
                    }
                }
            }
        }
    }

    if (missingDocs.length > 0 || expiredDocs.length > 0) {
        return {
            eligible: false,
            missingDocs,
            expiredDocs,
            adminReason: `Vehicle compliance issue: ${[
                missingDocs.length ? `Missing: ${missingDocs.join(', ')}` : '',
                expiredDocs.length ? `Expired/Invalid: ${expiredDocs.join(', ')}` : ''
            ].filter(Boolean).join('; ')}`
        };
    }

    return {
        eligible: true
    };
}

module.exports = {
    calculateDocumentStatus,
    getDocumentAlertMilestone,
    checkVehicleDocumentEligibility
};

