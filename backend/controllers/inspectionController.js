/**
 * Vehicle Inspection Controller (Pickup & Return Stages)
 *
 * File: backend/controllers/inspectionController.js
 */

const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { createNotification } = require('../utils/notificationHelper');
const { calculatePostRentalCharges, saveBookingAdditionalCharges } = require('../utils/pricingEngine');

/**
 * Admin: Create a vehicle inspection (pickup or return)
 */
const createInspection = async (req, res) => {
    let connection;
    try {
        const adminId = req.user.user_id;
        const {
            booking_id,
            inspection_type,
            odometer_reading,
            fuel_level,
            battery_percentage,
            exterior_condition,
            interior_condition,
            tyre_condition,
            headlights_condition,
            taillights_condition,
            mirrors_condition,
            windows_condition,
            brakes_condition,
            existing_scratches,
            existing_dents,
            damage_description,
            inspection_notes,
            photo_categories
        } = req.body;

        const bookingId = Number(booking_id);
        const odo = Number(odometer_reading);
        const fuel = Number(fuel_level);

        if (!Number.isInteger(bookingId) || bookingId <= 0) {
            return res.status(400).json({ message: 'Valid booking ID is required' });
        }

        if (!['pickup', 'return'].includes(inspection_type)) {
            return res.status(400).json({ message: 'Inspection type must be "pickup" or "return"' });
        }

        if (isNaN(odo) || odo < 0) {
            return res.status(400).json({ message: 'Valid odometer reading (km) is required' });
        }

        if (isNaN(fuel) || fuel < 0 || fuel > 100) {
            return res.status(400).json({ message: 'Fuel level must be a percentage between 0 and 100' });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Fetch booking details
        const [bookings] = await connection.query(
            `SELECT b.booking_id, b.user_id, b.vehicle_id, b.status, v.name AS vehicle_name, v.registration_number
             FROM bookings b
             JOIN vehicles v ON b.vehicle_id = v.vehicle_id
             WHERE b.booking_id = ?
             FOR UPDATE`,
            [bookingId]
        );

        if (bookings.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Booking not found' });
        }

        const booking = bookings[0];

        // 2. Prevent duplicate inspections for the same stage
        const [existing] = await connection.query(
            'SELECT id FROM vehicle_inspections WHERE booking_id = ? AND inspection_type = ?',
            [bookingId, inspection_type]
        );

        if (existing.length > 0) {
            await connection.rollback();
            return res.status(409).json({
                message: `A ${inspection_type} inspection already exists for Booking #${bookingId}.`
            });
        }

        // If return inspection, verify pickup inspection exists and final odo >= starting odo
        if (inspection_type === 'return') {
            const [pickupInsp] = await connection.query(
                'SELECT odometer_reading FROM vehicle_inspections WHERE booking_id = ? AND inspection_type = "pickup"',
                [bookingId]
            );

            if (pickupInsp.length > 0 && odo < pickupInsp[0].odometer_reading) {
                await connection.rollback();
                return res.status(400).json({
                    message: `Final odometer (${odo} km) cannot be less than starting odometer (${pickupInsp[0].odometer_reading} km).`
                });
            }
        }

        // 3. Insert vehicle_inspections row
        const [result] = await connection.query(
            `INSERT INTO vehicle_inspections
                (booking_id, vehicle_id, inspection_type, odometer_reading, fuel_level, battery_percentage,
                 exterior_condition, interior_condition, tyre_condition, headlights_condition, taillights_condition,
                 mirrors_condition, windows_condition, brakes_condition, existing_scratches, existing_dents,
                 damage_description, inspection_notes, inspected_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                bookingId,
                booking.vehicle_id,
                inspection_type,
                odo,
                fuel,
                battery_percentage !== undefined && battery_percentage !== '' ? Number(battery_percentage) : null,
                exterior_condition || 'good',
                interior_condition || 'good',
                tyre_condition || 'good',
                headlights_condition || 'working',
                taillights_condition || 'working',
                mirrors_condition || 'intact',
                windows_condition || 'intact',
                brakes_condition || 'optimal',
                existing_scratches || null,
                existing_dents || null,
                damage_description || null,
                inspection_notes || null,
                adminId
            ]
        );

        const inspectionId = result.insertId;

        // 4. Handle uploaded photos if present
        if (req.files && req.files.length > 0) {
            let catList = [];
            if (photo_categories) {
                catList = Array.isArray(photo_categories) ? photo_categories : [photo_categories];
            }

            for (let i = 0; i < req.files.length; i++) {
                const file = req.files[i];
                const cat = catList[i] || 'other';
                await connection.query(
                    `INSERT INTO inspection_photos (inspection_id, photo_category, file_path, description)
                     VALUES (?, ?, ?, ?)`,
                    [inspectionId, cat, file.path, `${inspection_type} inspection - ${cat}`]
                );
            }
        }

        await connection.commit();

        // 5. Customer Notification
        if (inspection_type === 'pickup') {
            await createNotification(
                booking.user_id,
                'inspection_ready',
                `Pre-rental vehicle inspection for Booking #${bookingId} (${booking.vehicle_name}) is ready. Please review and confirm the vehicle condition.`,
                bookingId
            );
        } else {
            await createNotification(
                booking.user_id,
                'return_inspection_completed',
                `Return vehicle inspection for Booking #${bookingId} has been completed by the administrator.`,
                bookingId
            );
        }

        return res.status(201).json({
            message: `${inspection_type === 'pickup' ? 'Pickup' : 'Return'} inspection recorded successfully`,
            inspection_id: inspectionId,
            booking_id: bookingId
        });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error('Error creating inspection:', err.message);
        return res.status(500).json({ message: 'Failed to record vehicle inspection' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * Admin: Upload additional photos to an existing inspection
 */
const uploadPhotos = async (req, res) => {
    try {
        const inspectionId = Number(req.params.id);
        const { photo_category, description } = req.body;

        if (!Number.isInteger(inspectionId) || inspectionId <= 0) {
            return res.status(400).json({ message: 'Invalid inspection ID' });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No image files uploaded' });
        }

        for (const file of req.files) {
            await db.query(
                `INSERT INTO inspection_photos (inspection_id, photo_category, file_path, description)
                 VALUES (?, ?, ?, ?)`,
                [inspectionId, photo_category || 'other', file.path, description || 'Inspection photo']
            );
        }

        return res.status(200).json({
            message: `${req.files.length} photograph(s) uploaded successfully`
        });
    } catch (err) {
        console.error('Error uploading inspection photos:', err.message);
        return res.status(500).json({ message: 'Failed to upload inspection photographs' });
    }
};

/**
 * Get inspections and difference analysis for a booking
 */
const getInspectionsByBooking = async (req, res) => {
    try {
        const bookingId = Number(req.params.bookingId);
        const userId = req.user.user_id;
        const isAdmin = req.user.role === 'admin';

        if (!Number.isInteger(bookingId) || bookingId <= 0) {
            return res.status(400).json({ message: 'Invalid booking ID' });
        }

        // Ownership check
        const [bookings] = await db.query(
            `SELECT b.booking_id, b.user_id, b.vehicle_id, b.status, b.pickup_datetime, b.return_datetime,
                    v.name AS vehicle_name, v.brand AS vehicle_brand, v.registration_number, v.fuel_type
             FROM bookings b
             JOIN vehicles v ON b.vehicle_id = v.vehicle_id
             WHERE b.booking_id = ?`,
            [bookingId]
        );

        if (bookings.length === 0) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        const booking = bookings[0];
        if (!isAdmin && booking.user_id !== userId) {
            return res.status(403).json({ message: 'Unauthorized to view inspections for this booking' });
        }

        // Fetch all inspections for this booking
        const [inspections] = await db.query(
            `SELECT vi.*, u.name AS inspector_name
             FROM vehicle_inspections vi
             JOIN users u ON vi.inspected_by = u.user_id
             WHERE vi.booking_id = ?
             ORDER BY vi.created_at ASC`,
            [bookingId]
        );

        // Fetch photos for each inspection
        for (const insp of inspections) {
            const [photos] = await db.query(
                `SELECT id, photo_category, description, uploaded_at
                 FROM inspection_photos
                 WHERE inspection_id = ?`,
                [insp.id]
            );
            insp.photos = photos;
        }

        const pickupInsp = inspections.find(i => i.inspection_type === 'pickup') || null;
        const returnInsp = inspections.find(i => i.inspection_type === 'return') || null;

        // Compute difference analysis if both inspections are available
        let differenceReport = null;
        if (pickupInsp && returnInsp) {
            const distanceTravelled = returnInsp.odometer_reading - pickupInsp.odometer_reading;
            const fuelDifference = returnInsp.fuel_level - pickupInsp.fuel_level;
            const isFuelDeficit = fuelDifference < 0;

            const newDamageReported = Boolean(
                (returnInsp.damage_description && returnInsp.damage_description !== pickupInsp.damage_description) ||
                (returnInsp.existing_scratches && returnInsp.existing_scratches !== pickupInsp.existing_scratches) ||
                (returnInsp.existing_dents && returnInsp.existing_dents !== pickupInsp.existing_dents) ||
                ['poor', 'damaged'].includes(returnInsp.exterior_condition)
            );

            differenceReport = {
                startingOdometer: pickupInsp.odometer_reading,
                finalOdometer: returnInsp.odometer_reading,
                distanceTravelledKm: Math.max(0, distanceTravelled),
                startingFuelLevel: pickupInsp.fuel_level,
                finalFuelLevel: returnInsp.fuel_level,
                fuelDifferencePercentage: fuelDifference,
                isFuelDeficit,
                startingCondition: {
                    exterior: pickupInsp.exterior_condition,
                    interior: pickupInsp.interior_condition,
                    tyres: pickupInsp.tyre_condition,
                    scratches: pickupInsp.existing_scratches,
                    dents: pickupInsp.existing_dents
                },
                returnCondition: {
                    exterior: returnInsp.exterior_condition,
                    interior: returnInsp.interior_condition,
                    tyres: returnInsp.tyre_condition,
                    scratches: returnInsp.existing_scratches,
                    dents: returnInsp.existing_dents
                },
                newDamageReported,
                damageRemarks: returnInsp.damage_description || 'No additional damage reported.'
            };
        }

        return res.status(200).json({
            booking,
            pickupInspection: pickupInsp,
            returnInspection: returnInsp,
            differenceReport
        });
    } catch (err) {
        console.error('Error fetching inspections:', err.message);
        return res.status(500).json({ message: 'Failed to retrieve vehicle inspections' });
    }
};

/**
 * Customer: Confirm and accept vehicle condition
 */
const customerAcceptInspection = async (req, res) => {
    try {
        const inspectionId = Number(req.params.id);
        const userId = req.user.user_id;

        if (!Number.isInteger(inspectionId) || inspectionId <= 0) {
            return res.status(400).json({ message: 'Invalid inspection ID' });
        }

        const [rows] = await db.query(
            `SELECT vi.id, vi.booking_id, vi.inspection_type, vi.customer_accepted, b.user_id
             FROM vehicle_inspections vi
             JOIN bookings b ON vi.booking_id = b.booking_id
             WHERE vi.id = ?`,
            [inspectionId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Inspection record not found' });
        }

        const insp = rows[0];
        if (insp.user_id !== userId) {
            return res.status(403).json({ message: 'Unauthorized: You can only confirm inspections for your own bookings' });
        }

        if (insp.customer_accepted) {
            return res.status(200).json({ message: 'Vehicle condition is already accepted' });
        }

        const now = new Date();
        await db.query(
            'UPDATE vehicle_inspections SET customer_accepted = TRUE, customer_accepted_at = ? WHERE id = ?',
            [now, inspectionId]
        );

        return res.status(200).json({
            message: 'Vehicle condition accepted successfully. Handover can now be completed.',
            accepted_at: now
        });
    } catch (err) {
        console.error('Error accepting inspection:', err.message);
        return res.status(500).json({ message: 'Failed to confirm vehicle condition' });
    }
};

/**
 * Admin: Complete Handover (transitions booking status to 'active')
 */
const completeHandover = async (req, res) => {
    try {
        const bookingId = Number(req.params.bookingId);
        if (!Number.isInteger(bookingId) || bookingId <= 0) {
            return res.status(400).json({ message: 'Invalid booking ID' });
        }

        // Fetch booking & pickup inspection status
        const [rows] = await db.query(
            `SELECT b.booking_id, b.user_id, b.status, vi.id AS inspection_id, vi.customer_accepted
             FROM bookings b
             LEFT JOIN vehicle_inspections vi ON b.booking_id = vi.booking_id AND vi.inspection_type = 'pickup'
             WHERE b.booking_id = ?`,
            [bookingId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        const row = rows[0];

        if (!row.inspection_id) {
            return res.status(400).json({
                message: 'Cannot complete handover: Before-rental pickup inspection has not been completed.'
            });
        }

        if (!row.customer_accepted) {
            return res.status(400).json({
                message: 'Cannot complete handover: Customer has not reviewed and accepted the vehicle condition yet.'
            });
        }

        // Transition booking status to 'active'
        await db.query('UPDATE bookings SET status = "active" WHERE booking_id = ?', [bookingId]);

        await createNotification(
            row.user_id,
            'booking_active',
            `Vehicle handover for Booking #${bookingId} has been completed! Your rental is now Active. Have a safe journey!`,
            bookingId
        );

        return res.status(200).json({
            message: 'Vehicle handover completed successfully. Booking status updated to Active.',
            booking_id: bookingId,
            status: 'active'
        });
    } catch (err) {
        console.error('Error completing handover:', err.message);
        return res.status(500).json({ message: 'Failed to complete vehicle handover' });
    }
};

/**
 * Admin: Complete Rental (transitions booking status to 'completed')
 */
const completeRental = async (req, res) => {
    try {
        const bookingId = Number(req.params.bookingId);
        if (!Number.isInteger(bookingId) || bookingId <= 0) {
            return res.status(400).json({ message: 'Invalid booking ID' });
        }

        const [rows] = await db.query(
            `SELECT b.booking_id, b.user_id, b.status, vi.id AS inspection_id
             FROM bookings b
             LEFT JOIN vehicle_inspections vi ON b.booking_id = vi.booking_id AND vi.inspection_type = 'return'
             WHERE b.booking_id = ?`,
            [bookingId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        const row = rows[0];

        if (!row.inspection_id) {
            return res.status(400).json({
                message: 'Cannot complete rental: After-rental return inspection has not been recorded yet.'
            });
        }

        // Transition booking status to 'completed'
        await db.query('UPDATE bookings SET status = "completed" WHERE booking_id = ?', [bookingId]);

        // Evaluate and persist post-rental charges (late return, excess km, fuel refill, cleaning)
        let additionalChargesResult = null;
        try {
            additionalChargesResult = await calculatePostRentalCharges(bookingId);
            if (additionalChargesResult.itemizedCharges.length > 0) {
                await saveBookingAdditionalCharges(bookingId, additionalChargesResult.itemizedCharges);
            }
        } catch (postErr) {
            console.warn('Post-rental charges calculation notice:', postErr.message);
        }

        await createNotification(
            row.user_id,
            'booking_completed',
            `Rental for Booking #${bookingId} has been successfully completed and settled. Thank you for choosing RentIQ!`,
            bookingId
        );

        return res.status(200).json({
            message: 'Rental completed successfully. Booking status updated to Completed.',
            booking_id: bookingId,
            status: 'completed',
            additional_charges: additionalChargesResult ? additionalChargesResult.itemizedCharges : []
        });
    } catch (err) {
        console.error('Error completing rental:', err.message);
        return res.status(500).json({ message: 'Failed to complete rental' });
    }
};

/**
 * Admin: List all inspections with stage tabs & damage filter
 */
const getAllInspectionsAdmin = async (req, res) => {
    try {
        const { stage, search } = req.query;
        let whereClauses = [];
        let queryParams = [];

        if (stage === 'pickup') {
            whereClauses.push('vi.inspection_type = "pickup"');
        } else if (stage === 'return') {
            whereClauses.push('vi.inspection_type = "return"');
        } else if (stage === 'damage') {
            whereClauses.push('(vi.exterior_condition IN ("poor", "damaged") OR vi.damage_description IS NOT NULL)');
        }

        if (search) {
            whereClauses.push('(b.booking_id LIKE ? OR v.registration_number LIKE ? OR u.name LIKE ?)');
            const s = `%${search}%`;
            queryParams.push(s, s, s);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const [inspections] = await db.query(
            `SELECT 
                vi.id,
                vi.booking_id,
                vi.vehicle_id,
                vi.inspection_type,
                vi.odometer_reading,
                vi.fuel_level,
                vi.exterior_condition,
                vi.customer_accepted,
                vi.created_at,
                u.name AS customer_name,
                u.email AS customer_email,
                v.name AS vehicle_name,
                v.registration_number,
                b.status AS booking_status,
                (SELECT COUNT(*) FROM inspection_photos ip WHERE ip.inspection_id = vi.id) AS photo_count
             FROM vehicle_inspections vi
             JOIN bookings b ON vi.booking_id = b.booking_id
             JOIN users u ON b.user_id = u.user_id
             JOIN vehicles v ON vi.vehicle_id = v.vehicle_id
             ${whereSql}
             ORDER BY vi.id DESC
             LIMIT 100`,
            queryParams
        );

        return res.status(200).json({ inspections });
    } catch (err) {
        console.error('Error fetching admin inspections:', err.message);
        return res.status(500).json({ message: 'Failed to fetch inspections' });
    }
};

/**
 * Stream/Download an inspection photograph
 */
const downloadInspectionPhoto = async (req, res) => {
    try {
        const photoId = Number(req.params.photoId);
        const userId = req.user.user_id;
        const isAdmin = req.user.role === 'admin';

        if (!Number.isInteger(photoId) || photoId <= 0) {
            return res.status(400).json({ message: 'Invalid photo ID' });
        }

        const [rows] = await db.query(
            `SELECT ip.file_path, ip.photo_category, b.user_id
             FROM inspection_photos ip
             JOIN vehicle_inspections vi ON ip.inspection_id = vi.id
             JOIN bookings b ON vi.booking_id = b.booking_id
             WHERE ip.id = ?`,
            [photoId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Photo not found' });
        }

        const photo = rows[0];
        if (!isAdmin && photo.user_id !== userId) {
            return res.status(403).json({ message: 'Access denied: You cannot view this photograph' });
        }

        if (!fs.existsSync(photo.file_path)) {
            return res.status(404).json({ message: 'Photograph file missing on server' });
        }

        const ext = path.extname(photo.file_path).toLowerCase();
        const contentTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.webp': 'image/webp'
        };

        res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="inspection_${photoId}${ext}"`);

        const fileStream = fs.createReadStream(photo.file_path);
        fileStream.pipe(res);
    } catch (err) {
        console.error('Error streaming photo:', err.message);
        return res.status(500).json({ message: 'Failed to load photograph' });
    }
};

module.exports = {
    createInspection,
    uploadPhotos,
    getInspectionsByBooking,
    customerAcceptInspection,
    completeHandover,
    completeRental,
    getAllInspectionsAdmin,
    downloadInspectionPhoto
};

