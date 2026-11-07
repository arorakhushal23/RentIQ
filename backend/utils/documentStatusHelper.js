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
function checkVehicleDocumentEligibility(documents, vehicleCategory = '') {
    const isTwoWheeler = ['bike', 'scooter'].includes((vehicleCategory || '').toLowerCase());
    
    // Mandatory document types for standard rental fleet
    const mandatoryTypes = ['rc', 'insurance', 'puc'];

    const presentDocs = {};
    for (const doc of documents) {
        presentDocs[doc.document_type] = doc;
    }

    const missingDocs = [];
    const expiredDocs = [];

    for (const type of mandatoryTypes) {
        const doc = presentDocs[type];
        if (!doc) {
            missingDocs.push(type.toUpperCase());
        } else {
            const { status } = calculateDocumentStatus(doc.expiry_date, doc.verification_status);
            if (status === 'expired' || status === 'rejected') {
                expiredDocs.push(`${type.toUpperCase()} (${status})`);
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

