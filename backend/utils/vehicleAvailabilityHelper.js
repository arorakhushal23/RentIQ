/**
 * Central Vehicle Availability & Booking Eligibility Helper
 *
 * File: backend/utils/vehicleAvailabilityHelper.js
 *
 * SINGLE SOURCE OF TRUTH for vehicle availability and booking eligibility
 * across the entire RentIQ application (Admin Vehicle List, Customer Vehicle
 * Catalog, Vehicle Details Page, Booking Availability Checks, and Booking Creation).
 *
 * Availability States:
 * 1. 'available' (Available - Green badge)
 *    - Vehicle is operational (is_available = 1).
 *    - RC, Insurance, and PUC documents are valid.
 *    - No active ongoing maintenance.
 *    - No conflicting scheduled maintenance (if rental dates provided).
 *    - No overlapping active/confirmed booking (if rental dates provided).
 *
 * 2. 'compliance_required' (Compliance Required - Orange badge)
 *    - Mandatory documents (RC, Insurance, PUC) are missing, expired, or rejected.
 *    - Displays exact missing/invalid documents.
 *
 * 3. 'under_maintenance' (Under Maintenance - Warning badge)
 *    - Vehicle is currently in workshop or has active maintenance today.
 *    - Or has scheduled maintenance overlapping requested rental dates.
 *
 * 4. 'unavailable' (Unavailable - Red badge)
 *    - Vehicle manually deactivated by administrator (is_available = 0).
 *    - Or vehicle has an overlapping confirmed booking for requested dates.
 */

const db = require('../config/db');
const { calculateDocumentStatus } = require('./documentStatusHelper');
const { checkVehicleMaintenanceConflict } = require('./maintenanceHelper');

const MANDATORY_DOC_TYPES = ['rc', 'insurance', 'puc'];

const DOC_DISPLAY_NAMES = {
    rc: 'RC',
    insurance: 'Insurance',
    puc: 'PUC',
    fitness: 'Fitness Certificate',
    permit: 'Commercial Permit'
};

/**
 * Formats a clean, readable summary of document compliance issues.
 * Examples:
 * - "Missing RC, Insurance and PUC"
 * - "Missing RC"
 * - "Insurance expired"
 * - "Missing RC; Insurance expired"
 */
function formatDocumentIssues(missing = [], expired = [], rejected = [], pending = []) {
    const parts = [];

    if (missing.length === 3) {
        parts.push('Missing RC, Insurance and PUC');
    } else if (missing.length === 2) {
        parts.push(`Missing ${missing[0]} and ${missing[1]}`);
    } else if (missing.length === 1) {
        parts.push(`Missing ${missing[0]}`);
    }

    if (expired.length > 0) {
        parts.push(`${expired.join(' and ')} expired`);
    }

    if (rejected.length > 0) {
        parts.push(`${rejected.join(' and ')} rejected`);
    }

    if (pending.length > 0) {
        parts.push(`${pending.join(' and ')} pending verification`);
    }

    return parts.join('; ') || 'Mandatory compliance documents require attention';
}

/**
 * Evaluates the full availability and booking eligibility of a single vehicle.
 *
 * @param {Object} vehicle - Vehicle record containing at least vehicle_id and is_available
 * @param {Object} [options={}] - Evaluation options
 * @param {Array} [options.documents] - Pre-fetched document records for this vehicle
 * @param {Array} [options.maintenanceRecords] - Pre-fetched active maintenance records
 * @param {string} [options.rentalStartDate] - Proposed rental pickup datetime
 * @param {string} [options.rentalEndDate] - Proposed rental return datetime
 * @param {Object} [options.conn] - Dedicated database connection (e.g. inside transaction)
 * @returns {Promise<Object>} Unified availability assessment
 */
async function evaluateVehicleAvailability(vehicle, options = {}) {
    if (!vehicle || !vehicle.vehicle_id) {
        throw new Error('Vehicle record with vehicle_id is required');
    }

    const runner = options.conn || db;
    const vehicleId = Number(vehicle.vehicle_id);

    // 1. Operational status
    const isOperational = vehicle.is_available === true || vehicle.is_available === 1 || vehicle.is_available === '1';
    const operationalStatus = isOperational ? 'active' : 'inactive';

    // 2. Fetch documents if not provided
    let docs = options.documents;
    if (!docs) {
        const [rows] = await runner.query(
            `SELECT document_type, expiry_date, verification_status
             FROM vehicle_documents
             WHERE vehicle_id = ?`,
            [vehicleId]
        );
        docs = rows;
    }

    // 3. Document compliance evaluation
    const presentDocs = {};
    for (const d of docs) {
        presentDocs[d.document_type] = d;
    }

    const missingTypes = [];
    const expiredTypes = [];
    const rejectedTypes = [];
    const pendingTypes = [];
    const reasons = [];

    let isRcValid = false;
    let isInsuranceValid = false;
    let isPucValid = false;

    // Optional rental end date for checking expiry during rental window
    let parsedRentalEnd = null;
    if (options.rentalEndDate) {
        parsedRentalEnd = new Date(options.rentalEndDate);
        if (!isNaN(parsedRentalEnd.getTime())) {
            parsedRentalEnd.setHours(0, 0, 0, 0);
        } else {
            parsedRentalEnd = null;
        }
    }

    for (const type of MANDATORY_DOC_TYPES) {
        const displayName = DOC_DISPLAY_NAMES[type] || type.toUpperCase();
        const doc = presentDocs[type];

        if (!doc) {
            missingTypes.push(displayName);
            reasons.push(`${displayName} document missing`);
        } else {
            const { status } = calculateDocumentStatus(doc.expiry_date, doc.verification_status);
            const isValidToday = status === 'valid' || status === 'expiring_soon';

            if (status === 'rejected') {
                rejectedTypes.push(displayName);
                reasons.push(`${displayName} document rejected`);
            } else if (status === 'pending') {
                pendingTypes.push(displayName);
                reasons.push(`${displayName} document pending verification`);
            } else if (status === 'expired') {
                expiredTypes.push(displayName);
                reasons.push(`${displayName} document expired`);
            } else if (parsedRentalEnd && doc.expiry_date) {
                // If rental window is specified, check if document expires during the rental
                const expDate = new Date(doc.expiry_date);
                expDate.setHours(0, 0, 0, 0);
                if (expDate.getTime() < parsedRentalEnd.getTime()) {
                    const expFormatted = String(doc.expiry_date).split('T')[0].split(' ')[0];
                    expiredTypes.push(`${displayName} (expires on ${expFormatted} before rental completion)`);
                    reasons.push(`${displayName} document expires during rental period (${expFormatted})`);
                } else if (isValidToday) {
                    if (type === 'rc') isRcValid = true;
                    if (type === 'insurance') isInsuranceValid = true;
                    if (type === 'puc') isPucValid = true;
                }
            } else if (isValidToday) {
                if (type === 'rc') isRcValid = true;
                if (type === 'insurance') isInsuranceValid = true;
                if (type === 'puc') isPucValid = true;
            }
        }
    }

    const allMandatoryCompliant = isRcValid && isInsuranceValid && isPucValid;

    // 4. Maintenance evaluation
    let activeMaintRecords = options.maintenanceRecords;
    if (!activeMaintRecords) {
        const [mRows] = await runner.query(
            `SELECT id, maintenance_category, start_date, end_date, status, description
             FROM vehicle_maintenance
             WHERE vehicle_id = ?
               AND (status = 'in_progress' OR (status = 'scheduled' AND start_date <= CURDATE() AND (end_date IS NULL OR end_date >= CURDATE())))`,
            [vehicleId]
        );
        activeMaintRecords = mRows;
    }

    const isUnderActiveMaintenance = activeMaintRecords.length > 0;
    const currentMaint = isUnderActiveMaintenance ? activeMaintRecords[0] : null;

    // 5. Date-specific schedule checks (Maintenance & Bookings)
    let maintenanceConflict = { hasConflict: false };
    let hasOverlappingBooking = false;

    if (options.rentalStartDate && options.rentalEndDate) {
        maintenanceConflict = await checkVehicleMaintenanceConflict(
            vehicleId,
            options.rentalStartDate,
            options.rentalEndDate,
            null,
            runner
        );

        const [overlaps] = await runner.query(
            `SELECT booking_id
             FROM bookings
             WHERE vehicle_id = ?
               AND status IN ('pending', 'confirmed', 'active')
               AND pickup_datetime < ?
               AND return_datetime > ?
             LIMIT 1`,
            [vehicleId, options.rentalEndDate, options.rentalStartDate]
        );
        hasOverlappingBooking = overlaps.length > 0;
    }

    // 6. Determine Unified Availability State & Display Reasons
    let availabilityStatus = 'available';
    let statusCode = 'AVAILABLE';
    let displayReason = 'Vehicle is operational and fully compliant';
    let customerMessage = 'Available for rental';
    let badgeText = 'Available';
    let badgeVariant = 'success';
    let badgeClass = 'is-available';

    if (!isOperational) {
        availabilityStatus = 'unavailable';
        statusCode = 'VEHICLE_UNAVAILABLE';
        displayReason = 'Vehicle is manually deactivated';
        customerMessage = 'This vehicle is currently unavailable for rental. Please choose another vehicle.';
        badgeText = 'Unavailable';
        badgeVariant = 'danger';
        badgeClass = 'is-unavailable';
        if (!reasons.includes('Vehicle is manually deactivated')) {
            reasons.unshift('Vehicle is manually deactivated by administrator');
        }
    } else if (isUnderActiveMaintenance || maintenanceConflict.hasConflict) {
        availabilityStatus = 'under_maintenance';
        statusCode = 'VEHICLE_UNDER_MAINTENANCE';
        const cat = currentMaint?.maintenance_category || maintenanceConflict.conflict?.maintenance_category || 'Routine Maintenance';
        const formattedCat = cat.replace(/_/g, ' ');
        displayReason = `Vehicle under maintenance (${formattedCat})`;
        customerMessage = options.rentalStartDate
            ? 'This vehicle is under maintenance during your selected rental dates. Please choose different dates or another vehicle.'
            : `This vehicle is temporarily unavailable due to ongoing ${formattedCat}. Please choose another vehicle.`;
        badgeText = 'Under Maintenance';
        badgeVariant = 'maintenance';
        badgeClass = 'is-maintenance';
        reasons.unshift(displayReason);
    } else if (!allMandatoryCompliant) {
        availabilityStatus = 'compliance_required';
        statusCode = 'VEHICLE_COMPLIANCE_HOLD';
        displayReason = formatDocumentIssues(missingTypes, expiredTypes, rejectedTypes, pendingTypes);
        customerMessage = 'This vehicle is temporarily unavailable because mandatory compliance documents require attention.';
        badgeText = 'Compliance Required';
        badgeVariant = 'warning';
        badgeClass = 'is-compliance';
    } else if (hasOverlappingBooking) {
        availabilityStatus = 'unavailable';
        statusCode = 'BOOKING_CONFLICT';
        displayReason = 'Vehicle has an overlapping booking';
        customerMessage = 'Vehicle is already booked for the selected dates/times. Please choose different times or another vehicle.';
        badgeText = 'Unavailable';
        badgeVariant = 'danger';
        badgeClass = 'is-unavailable';
        reasons.unshift('Vehicle is already booked for the selected dates/times');
    }

    const bookingEligible = isOperational &&
        allMandatoryCompliant &&
        !isUnderActiveMaintenance &&
        !maintenanceConflict.hasConflict &&
        !hasOverlappingBooking;

    return {
        vehicleId,
        operationalStatus,
        bookingEligible,
        availabilityStatus,
        statusCode,
        badge: {
            text: badgeText,
            variant: badgeVariant,
            className: badgeClass
        },
        reasons,
        displayReason,
        customerMessage,
        compliance: {
            rc_verified: isRcValid,
            insurance_active: isInsuranceValid,
            puc_certified: isPucValid,
            all_mandatory_compliant: allMandatoryCompliant,
            missing: missingTypes,
            expired: expiredTypes,
            rejected: rejectedTypes,
            pending: pendingTypes
        },
        maintenance: {
            underMaintenance: isUnderActiveMaintenance || maintenanceConflict.hasConflict,
            details: currentMaint || maintenanceConflict.conflict || null
        }
    };
}

/**
 * Batch evaluates availability for multiple vehicles in an efficient, low-overhead manner.
 * Ideal for Admin Vehicle List and Customer Catalog endpoints.
 *
 * @param {Array<Object>} vehicles - Array of vehicle records
 * @param {Object} [options={}] - Options (conn, rentalStartDate, rentalEndDate)
 * @returns {Promise<Array<Object>>} Vehicles enriched with consistent availability fields
 */
async function batchEvaluateVehicleAvailability(vehicles, options = {}) {
    if (!Array.isArray(vehicles) || vehicles.length === 0) {
        return [];
    }

    const runner = options.conn || db;
    const vehicleIds = vehicles.map(v => Number(v.vehicle_id)).filter(id => Number.isInteger(id) && id > 0);

    if (vehicleIds.length === 0) {
        return vehicles;
    }

    // Batch query 1: Fetch documents for all vehicles in list
    const [allDocs] = await runner.query(
        `SELECT vehicle_id, document_type, expiry_date, verification_status
         FROM vehicle_documents
         WHERE vehicle_id IN (?)`,
        [vehicleIds]
    );

    // Group docs by vehicle_id
    const docsByVehicle = {};
    for (const id of vehicleIds) {
        docsByVehicle[id] = [];
    }
    for (const doc of allDocs) {
        if (!docsByVehicle[doc.vehicle_id]) docsByVehicle[doc.vehicle_id] = [];
        docsByVehicle[doc.vehicle_id].push(doc);
    }

    // Batch query 2: Fetch active ongoing maintenance for all vehicles in list
    const [allMaint] = await runner.query(
        `SELECT id, vehicle_id, maintenance_category, start_date, end_date, status, description
         FROM vehicle_maintenance
         WHERE vehicle_id IN (?)
           AND (status = 'in_progress' OR (status = 'scheduled' AND start_date <= CURDATE() AND (end_date IS NULL OR end_date >= CURDATE())))`,
        [vehicleIds]
    );

    // Group active maintenance by vehicle_id
    const maintByVehicle = {};
    for (const id of vehicleIds) {
        maintByVehicle[id] = [];
    }
    for (const m of allMaint) {
        if (!maintByVehicle[m.vehicle_id]) maintByVehicle[m.vehicle_id] = [];
        maintByVehicle[m.vehicle_id].push(m);
    }

    // Evaluate each vehicle in memory
    const enriched = [];
    for (const vehicle of vehicles) {
        const id = Number(vehicle.vehicle_id);
        const evalResult = await evaluateVehicleAvailability(vehicle, {
            ...options,
            documents: docsByVehicle[id] || [],
            maintenanceRecords: maintByVehicle[id] || []
        });

        enriched.push({
            ...vehicle,
            operational_status: evalResult.operationalStatus,
            booking_eligible: evalResult.bookingEligible,
            availability_status: evalResult.availabilityStatus,
            availability_code: evalResult.statusCode,
            availability_reason: evalResult.displayReason,
            customer_message: evalResult.customerMessage,
            availability_badge: evalResult.badge,
            compliance: evalResult.compliance,
            // Keep existing boolean is_available synced to booking_eligible for backwards compatibility
            // but provide clear operational_is_available flag
            operational_is_available: evalResult.operationalStatus === 'active',
            is_available: evalResult.bookingEligible,
            unavailability_reason: !evalResult.bookingEligible ? evalResult.displayReason : null,
            unavailability_code: !evalResult.bookingEligible ? evalResult.statusCode : null
        });
    }

    return enriched;
}

module.exports = {
    MANDATORY_DOC_TYPES,
    DOC_DISPLAY_NAMES,
    formatDocumentIssues,
    evaluateVehicleAvailability,
    batchEvaluateVehicleAvailability
};
