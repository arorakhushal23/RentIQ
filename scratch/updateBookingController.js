const fs = require('fs');
const path = require('path');

const targetPath = path.resolve('backend/controllers/bookingController.js');
let content = fs.readFileSync(targetPath, 'utf8');

const normalize = s => s.replace(/\r\n/g, '\n');
const toCRLF = s => s.replace(/\r?\n/g, '\r\n');

content = normalize(content);

// 1. Locate the vehicle check section
const oldVehicleCheck = `        const vehicle = vehicles[0]

        if (!vehicle.is_available) {
            await connection.rollback()
            return res.status(400).json({
                message: 'Vehicle is currently unavailable'
            })
        }`;

const newVehicleCheck = `        const vehicle = vehicles[0]

        // 1a. Vehicle availability flag check
        if (!vehicle.is_available) {
            await connection.rollback()
            return res.status(400).json({
                eligible: false,
                code: 'VEHICLE_UNAVAILABLE',
                message: 'This vehicle is currently unavailable for rental. Please choose another vehicle.'
            })
        }

        // 1b. Vehicle Document Compliance Check (RC, Insurance, PUC validity for the rental period)
        const [vehDocs] = await connection.query(
            \`SELECT document_type, expiry_date, verification_status
             FROM vehicle_documents
             WHERE vehicle_id = ?\`,
            [vehicleId]
        )

        const docEligibility = checkVehicleDocumentEligibility(vehDocs, vehicle.category_name, returnParsed.formatted)
        if (!docEligibility.eligible) {
            await connection.rollback()
            return res.status(400).json({
                eligible: false,
                code: 'VEHICLE_COMPLIANCE_HOLD',
                message: 'This vehicle is temporarily unavailable due to routine compliance maintenance. Please choose another vehicle.',
                adminReason: docEligibility.adminReason
            })
        }

        // 1c. Vehicle Maintenance Conflict Check overlapping requested rental dates
        const maintenanceConflict = await checkVehicleMaintenanceConflict(
            vehicleId,
            pickupParsed.formatted,
            returnParsed.formatted,
            null,
            connection
        )

        if (maintenanceConflict.hasConflict) {
            await connection.rollback()
            return res.status(400).json({
                eligible: false,
                code: 'VEHICLE_UNDER_MAINTENANCE',
                message: maintenanceConflict.message || 'This vehicle is temporarily unavailable due to scheduled maintenance. Please choose another vehicle or different dates.'
            })
        }

        // 1d. Prevent overlapping active bookings for the same vehicle
        const [overlaps] = await connection.query(
            \`
            SELECT booking_id
            FROM bookings
            WHERE vehicle_id = ?
              AND status IN ('pending', 'confirmed', 'active')
              AND pickup_datetime < ?
              AND return_datetime > ?
            LIMIT 1
            \`,
            [vehicleId, returnParsed.formatted, pickupParsed.formatted]
        )

        if (overlaps.length > 0) {
            await connection.rollback()
            return res.status(409).json({
                eligible: false,
                code: 'BOOKING_CONFLICT',
                message: 'Vehicle is already booked for the selected dates/times. Please choose different times or another vehicle.'
            })
        }`;

if (!content.includes(normalize(oldVehicleCheck))) {
    console.error('Could not find oldVehicleCheck!');
    process.exit(1);
}

content = content.replace(normalize(oldVehicleCheck), normalize(newVehicleCheck));

// 2. Remove the duplicate checks below customer licence check
const oldLaterChecks = `        // 1c. Vehicle Document Compliance Check
        const [vehDocs] = await connection.query(
            \`SELECT document_type, expiry_date, verification_status
             FROM vehicle_documents
             WHERE vehicle_id = ?\`,
            [vehicleId]
        )

        const docEligibility = checkVehicleDocumentEligibility(vehDocs, vehicle.category_name)
        if (!docEligibility.eligible) {
            await connection.rollback()
            return res.status(400).json({
                eligible: false,
                code: 'VEHICLE_COMPLIANCE_HOLD',
                message: 'This vehicle is temporarily unavailable due to routine compliance maintenance. Please choose another vehicle.'
            })
        }

        // 2. Prevent the same user from creating a duplicate active booking for the exact same vehicle and interval
        const [userDuplicates] = await connection.query(
            \`
            SELECT booking_id
            FROM bookings
            WHERE user_id = ?
              AND vehicle_id = ?
              AND pickup_datetime = ?
              AND return_datetime = ?
              AND status IN ('pending', 'confirmed', 'active')
            LIMIT 1
            \`,
            [userId, vehicleId, pickupParsed.formatted, returnParsed.formatted]
        )

        if (userDuplicates.length > 0) {
            await connection.rollback()
            return res.status(409).json({
                message: 'You already have an active booking for this vehicle and selected dates/times'
            })
        }

        // 3. Prevent overlapping active bookings for the same vehicle
        const [overlaps] = await connection.query(
            \`
            SELECT booking_id
            FROM bookings
            WHERE vehicle_id = ?
              AND status IN ('pending', 'confirmed', 'active')
              AND pickup_datetime < ?
              AND return_datetime > ?
            LIMIT 1
            \`,
            [vehicleId, returnParsed.formatted, pickupParsed.formatted]
        )

        if (overlaps.length > 0) {
            await connection.rollback()
            return res.status(409).json({
                message: 'Vehicle is already booked for the selected dates/times. Please choose different times or another vehicle.'
            })
        }

        // 3b. Vehicle Maintenance Conflict Check
        const maintenanceConflict = await checkVehicleMaintenanceConflict(
            vehicleId,
            pickupParsed.formatted,
            returnParsed.formatted,
            null,
            connection
        )

        if (maintenanceConflict.hasConflict) {
            await connection.rollback()
            return res.status(400).json({
                eligible: false,
                code: 'VEHICLE_UNDER_MAINTENANCE',
                message: maintenanceConflict.message
            })
        }`;

const newLaterChecks = `        // 2. Prevent the same user from creating a duplicate active booking for the exact same vehicle and interval
        const [userDuplicates] = await connection.query(
            \`
            SELECT booking_id
            FROM bookings
            WHERE user_id = ?
              AND vehicle_id = ?
              AND pickup_datetime = ?
              AND return_datetime = ?
              AND status IN ('pending', 'confirmed', 'active')
            LIMIT 1
            \`,
            [userId, vehicleId, pickupParsed.formatted, returnParsed.formatted]
        )

        if (userDuplicates.length > 0) {
            await connection.rollback()
            return res.status(409).json({
                message: 'You already have an active booking for this vehicle and selected dates/times'
            })
        }`;

if (!content.includes(normalize(oldLaterChecks))) {
    console.error('Could not find oldLaterChecks!');
    process.exit(1);
}

content = content.replace(normalize(oldLaterChecks), normalize(newLaterChecks));

// 3. Add checkVehicleAvailabilityEndpoint before module.exports
const availabilityEndpointCode = `
/**
 * Public/Customer: Check vehicle availability for a specific rental window
 * Validates:
 * 1. Vehicle existence and is_available flag
 * 2. Ongoing active maintenance records
 * 3. Mandatory document compliance through requested rental end date (RC, Insurance, PUC)
 * 4. Scheduled maintenance overlapping [pickupDatetime, returnDatetime]
 * 5. Existing active/confirmed/pending bookings overlapping [pickupDatetime, returnDatetime]
 */
const checkVehicleAvailabilityEndpoint = async (req, res) => {
    try {
        const rawVehicleId = req.body?.vehicleId || req.body?.vehicle_id || req.query?.vehicleId || req.params?.id;
        const vehicleId = Number(rawVehicleId);

        const rawPickup = req.body?.pickupDatetime || req.body?.pickup_datetime || req.query?.pickupDatetime;
        const rawReturn = req.body?.returnDatetime || req.body?.return_datetime || req.query?.returnDatetime;

        if (!vehicleId || isNaN(vehicleId) || vehicleId <= 0) {
            return res.status(400).json({ available: false, message: 'Valid vehicleId is required' });
        }

        const [vehicles] = await db.query(
            \`SELECT v.vehicle_id, v.name, v.brand, v.is_available, c.name AS category_name
             FROM vehicles v
             LEFT JOIN categories c ON v.category_id = c.category_id
             WHERE v.vehicle_id = ?\`,
            [vehicleId]
        );

        if (vehicles.length === 0) {
            return res.status(404).json({ available: false, message: 'Vehicle not found' });
        }

        const vehicle = vehicles[0];

        // 1. Static is_available flag
        if (!vehicle.is_available) {
            return res.status(200).json({
                available: false,
                code: 'VEHICLE_UNAVAILABLE',
                message: 'This vehicle is currently unavailable for rental. Please choose another vehicle.'
            });
        }

        // 2. Active ongoing maintenance check
        const [activeMaint] = await db.query(
            \`SELECT id, maintenance_category, start_date, end_date
             FROM vehicle_maintenance
             WHERE vehicle_id = ?
               AND (status = 'in_progress' OR (status = 'scheduled' AND start_date <= CURDATE() AND (end_date IS NULL OR end_date >= CURDATE())))
             LIMIT 1\`,
            [vehicleId]
        );

        if (activeMaint.length > 0) {
            return res.status(200).json({
                available: false,
                code: 'VEHICLE_UNDER_MAINTENANCE',
                message: \`This vehicle is temporarily unavailable due to ongoing \${activeMaint[0].maintenance_category}. Please choose another vehicle.\`
            });
        }

        // 3. Document compliance check
        const [vehDocs] = await db.query(
            \`SELECT document_type, expiry_date, verification_status
             FROM vehicle_documents
             WHERE vehicle_id = ?\`,
            [vehicleId]
        );

        const rEndDate = rawReturn ? (rawReturn.includes('T') ? rawReturn.split('T')[0] : rawReturn.split(' ')[0]) : null;
        const docEligibility = checkVehicleDocumentEligibility(vehDocs, vehicle.category_name, rEndDate);
        if (!docEligibility.eligible) {
            return res.status(200).json({
                available: false,
                code: 'VEHICLE_COMPLIANCE_HOLD',
                message: 'This vehicle is temporarily unavailable due to routine compliance maintenance. Please choose another vehicle.',
                adminReason: docEligibility.adminReason
            });
        }

        // 4. If rental dates provided, check maintenance schedule overlap and overlapping bookings
        if (rawPickup && rawReturn) {
            const pParsed = parseDateTime(rawPickup);
            const rParsed = parseDateTime(rawReturn);

            if (pParsed.valid && rParsed.valid && rParsed.date > pParsed.date) {
                // Check maintenance conflict
                const maintenanceConflict = await checkVehicleMaintenanceConflict(
                    vehicleId,
                    pParsed.formatted,
                    rParsed.formatted,
                    null,
                    db
                );

                if (maintenanceConflict.hasConflict) {
                    return res.status(200).json({
                        available: false,
                        code: 'VEHICLE_UNDER_MAINTENANCE',
                        message: maintenanceConflict.message || 'This vehicle is scheduled for maintenance during the selected dates. Please choose different dates or another vehicle.'
                    });
                }

                // Check overlapping bookings
                const [overlaps] = await db.query(
                    \`SELECT booking_id
                     FROM bookings
                     WHERE vehicle_id = ?
                       AND status IN ('pending', 'confirmed', 'active')
                       AND pickup_datetime < ?
                       AND return_datetime > ?
                     LIMIT 1\`,
                    [vehicleId, rParsed.formatted, pParsed.formatted]
                );

                if (overlaps.length > 0) {
                    return res.status(200).json({
                        available: false,
                        code: 'BOOKING_CONFLICT',
                        message: 'Vehicle is already booked for the selected dates/times. Please choose different times or another vehicle.'
                    });
                }
            }
        }

        return res.status(200).json({
            available: true,
            message: 'Vehicle is available for rental'
        });
    } catch (err) {
        console.error('Error checking vehicle availability:', err.message);
        return res.status(500).json({ available: false, message: 'Failed to verify vehicle availability' });
    }
};
`;

const oldExports = `module.exports = {
    createBooking,
    getMyBookings,
    getBookingByIdCustomer,
    cancelBooking
}`;

const newExports = `module.exports = {
    createBooking,
    getMyBookings,
    getBookingByIdCustomer,
    cancelBooking,
    checkVehicleAvailabilityEndpoint
}`;

content = content.replace(normalize(oldExports), availabilityEndpointCode + '\n' + normalize(newExports));

fs.writeFileSync(targetPath, toCRLF(content), 'utf8');
console.log('Successfully updated bookingController.js');

