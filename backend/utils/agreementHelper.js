/**
 * Digital Rental Agreement Helper & PDF Generator
 *
 * File: backend/utils/agreementHelper.js
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

const COMPANY_INFO = {
    name: 'RentIQ Vehicle Rentals Pvt. Ltd.',
    legalEntity: 'RentIQ Mobility Services',
    registrationNumber: 'CIN: U50100CH2025PTC045892',
    address: 'Sector 17 Plaza, City Centre, Chandigarh, 160017',
    supportEmail: 'support@rentiq.com',
    emergencyHotline: '+91 1800-736-847 (1800-RENT-IQ)',
    website: 'https://rentiq.com'
};

const STANDARD_TERMS = [
    {
        title: '1. Vehicle Operation & Authorized Driver',
        body: 'The vehicle shall be operated strictly by the verified licence holder specified in this agreement. Sub-leasing, driving under the influence, or unauthorized driver handover is strictly prohibited.'
    },
    {
        title: '2. Fuel & Charging Policy',
        body: 'The vehicle is handed over with recorded fuel/battery levels as documented in the Pickup Inspection Report. The renter agrees to return the vehicle with equivalent levels. Fuel deficits will be charged at standard pump rates.'
    },
    {
        title: '3. Speed Limits & Traffic Violations',
        body: 'The renter must adhere to all statutory traffic rules and maximum speed limits (100 km/h on expressways, 80 km/h on national highways). Any e-challans, tolls, or penalties incurred during the rental tenure are the sole liability of the renter.'
    },
    {
        title: '4. Damage Liability & Security Deposit',
        body: 'RentIQ vehicles carry comprehensive commercial insurance. In the event of an accidental collision, the renter liability is capped at the standard insurance deductible. Negligent damage, off-roading, or interior damage will be deducted from the security deposit.'
    },
    {
        title: '5. Return Schedule & Extensions',
        body: 'The vehicle must be returned to the agreed drop location on or before the scheduled return datetime. A 30-minute grace period is provided, beyond which extension rates apply at ₹500/hour subject to availability.'
    },
    {
        title: '6. 24x7 Roadside Assistance',
        body: 'In case of breakdown, tyre puncture, or accident, immediately contact the RentIQ Emergency Helpline at +91 1800-736-847 before attempting local unauthorized repairs.'
    }
];

/**
 * Masks a driving licence number for privacy (shows only first 3 and last 4 characters)
 */
function maskLicenseNumber(lic) {
    if (!lic) return 'NOT_ON_FILE';
    const str = String(lic).trim();
    if (str.length <= 7) return str;
    return `${str.substring(0, 3)}•••••••${str.substring(str.length - 4)}`;
}

/**
 * Builds a complete agreement snapshot from database records
 */
async function buildAgreementData(bookingId) {
    const [rows] = await db.query(
        `SELECT
            b.booking_id,
            b.user_id,
            b.vehicle_id,
            b.pickup_datetime,
            b.return_datetime,
            b.pickup_address,
            b.drop_address,
            b.route_distance_km,
            b.estimated_travel_time,
            b.delivery_charge,
            b.total_price,
            b.status AS booking_status,
            b.created_at AS booking_date,
            u.name AS customer_name,
            u.email AS customer_email,
            v.name AS vehicle_name,
            v.brand AS vehicle_brand,
            v.model AS vehicle_model,
            v.registration_number,
            v.registration_state,
            v.fuel_type,
            v.transmission,
            v.price_per_day,
            c.name AS category_name,
            cl.license_number,
            cl.vehicle_class AS license_class,
            cl.expiry_date AS license_expiry
         FROM bookings b
         JOIN users u ON b.user_id = u.user_id
         JOIN vehicles v ON b.vehicle_id = v.vehicle_id
         LEFT JOIN categories c ON v.category_id = c.category_id
         LEFT JOIN customer_licenses cl ON u.user_id = cl.user_id
         WHERE b.booking_id = ?`,
        [bookingId]
    );

    if (rows.length === 0) {
        throw new Error(`Booking #${bookingId} not found`);
    }

    const row = rows[0];
    const baseRental = Number((Number(row.total_price) - Number(row.delivery_charge || 0)).toFixed(2));
    const securityDeposit = 3000.00; // Standard refundable security deposit

    return {
        company: COMPANY_INFO,
        customer: {
            userId: row.user_id,
            name: row.customer_name,
            email: row.customer_email,
            licenseNumberMasked: maskLicenseNumber(row.license_number),
            licenseClass: row.license_class || 'LMV',
            licenseExpiry: row.license_expiry
        },
        vehicle: {
            vehicleId: row.vehicle_id,
            name: row.vehicle_name,
            brand: row.vehicle_brand,
            model: row.vehicle_model || row.vehicle_name,
            registrationNumber: row.registration_number || 'REG-PENDING',
            registrationState: row.registration_state || 'Chandigarh',
            category: row.category_name || 'Sedan',
            fuelType: row.fuel_type || 'Petrol',
            transmission: row.transmission || 'Automatic',
            pricePerDay: Number(row.price_per_day)
        },
        booking: {
            bookingId: row.booking_id,
            bookingDate: row.booking_date,
            pickupDatetime: row.pickup_datetime,
            returnDatetime: row.return_datetime,
            pickupAddress: row.pickup_address || 'RentIQ Central Hub, Sector 17, Chandigarh',
            dropAddress: row.drop_address || row.pickup_address || 'RentIQ Central Hub, Sector 17, Chandigarh',
            routeDistanceKm: Number(row.route_distance_km) || 0,
            estimatedTravelTime: row.estimated_travel_time || '0 mins'
        },
        financials: {
            baseRentalAmount: baseRental > 0 ? baseRental : Number(row.total_price),
            deliveryCharge: Number(row.delivery_charge) || 0,
            securityDeposit: securityDeposit,
            totalBookingAmount: Number(row.total_price),
            estimatedPayable: Number((Number(row.total_price) + securityDeposit).toFixed(2))
        },
        terms: STANDARD_TERMS
    };
}

/**
 * Generates the PDF document on disk and returns its file path
 */
async function generateAgreementPDF(agreementNumber, agreementData, acceptanceDetails = null) {
    const uploadDir = path.resolve(__dirname, '..', 'uploads', 'agreements');
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, `${agreementNumber}.pdf`);

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'A4',
            margin: 40,
            info: {
                Title: `RentIQ Digital Rental Agreement - ${agreementNumber}`,
                Author: 'RentIQ Vehicle Rentals',
                Subject: `Booking #${agreementData.booking.bookingId} Rental Agreement`,
                Keywords: 'Rental, Agreement, RentIQ, Vehicle, Contract'
            }
        });

        const writeStream = fs.createWriteStream(filePath);
        doc.pipe(writeStream);

        // Header Background
        doc.rect(40, 40, 515, 60).fill('#0f172a');

        // Header Branding
        doc.fillColor('#ffffff')
            .fontSize(22)
            .font('Helvetica-Bold')
            .text('RentIQ', 55, 50, { continued: true });
        
        doc.fontSize(11)
            .font('Helvetica')
            .fillColor('#38bdf8')
            .text('  DIGITAL VEHICLE RENTAL AGREEMENT');

        doc.fillColor('#94a3b8')
            .fontSize(8.5)
            .font('Helvetica')
            .text(`Agreement Ref: ${agreementNumber}  |  Booking #${agreementData.booking.bookingId}`, 55, 78);

        doc.text(`Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 350, 78, { align: 'right' });

        doc.moveDown(3);

        // Section: Contracting Parties
        let yPos = 115;
        doc.rect(40, yPos, 515, 20).fill('#f1f5f9');
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(10).text('1. CONTRACTING PARTIES', 48, yPos + 5);

        yPos += 26;
        // Two columns: Lessor (RentIQ) & Lessee (Customer)
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#1e293b').text('LESSOR (Rental Provider):', 48, yPos);
        doc.font('Helvetica').fontSize(8.5).fillColor('#334155')
            .text(agreementData.company.name, 48, yPos + 12)
            .text(agreementData.company.legalEntity, 48, yPos + 22)
            .text(agreementData.company.address, 48, yPos + 32, { width: 230 })
            .text(`Support: ${agreementData.company.supportEmail} | ${agreementData.company.emergencyHotline}`, 48, yPos + 52);

        doc.font('Helvetica-Bold').fontSize(9).fillColor('#1e293b').text('LESSEE (Customer & Verified Driver):', 300, yPos);
        doc.font('Helvetica').fontSize(8.5).fillColor('#334155')
            .text(`Name: ${agreementData.customer.name}`, 300, yPos + 12)
            .text(`Email: ${agreementData.customer.email}`, 300, yPos + 22)
            .text(`Driving Licence: ${agreementData.customer.licenseNumberMasked}`, 300, yPos + 32)
            .text(`Endorsement Class: ${agreementData.customer.licenseClass}`, 300, yPos + 42);

        // Section: Vehicle Specifications
        yPos += 72;
        doc.rect(40, yPos, 515, 20).fill('#f1f5f9');
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(10).text('2. VEHICLE SPECIFICATIONS', 48, yPos + 5);

        yPos += 26;
        const v = agreementData.vehicle;
        doc.font('Helvetica').fontSize(8.5).fillColor('#334155')
            .text(`Vehicle Name: ${v.brand} ${v.name}`, 48, yPos)
            .text(`Registration No: ${v.registrationNumber}`, 48, yPos + 12)
            .text(`Category: ${v.category}`, 48, yPos + 22)
            .text(`Fuel Type: ${v.fuelType}`, 300, yPos)
            .text(`Transmission: ${v.transmission}`, 300, yPos + 12)
            .text(`Registered State: ${v.registrationState}`, 300, yPos + 22);

        // Section: Rental Schedule & Locations
        yPos += 42;
        doc.rect(40, yPos, 515, 20).fill('#f1f5f9');
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(10).text('3. RENTAL SCHEDULE & LOCATIONS', 48, yPos + 5);

        yPos += 26;
        const b = agreementData.booking;
        const formatDt = (dt) => new Date(dt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

        doc.font('Helvetica').fontSize(8.5).fillColor('#334155')
            .text(`Scheduled Pickup: ${formatDt(b.pickupDatetime)}`, 48, yPos)
            .text(`Pickup Address: ${b.pickupAddress}`, 48, yPos + 12, { width: 230 })
            .text(`Scheduled Return: ${formatDt(b.returnDatetime)}`, 300, yPos)
            .text(`Drop Address: ${b.dropAddress}`, 300, yPos + 12, { width: 230 })
            .text(`Transit Route Distance: ${b.routeDistanceKm} km (${b.estimatedTravelTime})`, 48, yPos + 38);

        // Section: Financial Breakdown
        yPos += 58;
        doc.rect(40, yPos, 515, 20).fill('#f1f5f9');
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(10).text('4. FINANCIAL BREAKDOWN & CHARGES (INR)', 48, yPos + 5);

        yPos += 26;
        const f = agreementData.financials;
        doc.font('Helvetica').fontSize(8.5).fillColor('#334155')
            .text(`Base Vehicle Rental:`, 48, yPos)
            .text(`₹${Number(f.baseRentalAmount).toLocaleString('en-IN')}`, 200, yPos, { align: 'right' })
            .text(`Delivery / Transit Charges:`, 48, yPos + 12)
            .text(`₹${Number(f.deliveryCharge).toLocaleString('en-IN')}`, 200, yPos + 12, { align: 'right' })
            .text(`Refundable Security Deposit:`, 300, yPos)
            .text(`₹${Number(f.securityDeposit).toLocaleString('en-IN')}`, 450, yPos, { align: 'right' })
            .font('Helvetica-Bold').fillColor('#0f172a')
            .text(`Total Rental Amount:`, 48, yPos + 26)
            .text(`₹${Number(f.totalBookingAmount).toLocaleString('en-IN')}`, 200, yPos + 26, { align: 'right' });

        // Section: Terms & Conditions
        yPos += 48;
        doc.rect(40, yPos, 515, 20).fill('#f1f5f9');
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(10).text('5. CORE TERMS & RESPONSIBILITIES', 48, yPos + 5);

        yPos += 24;
        doc.font('Helvetica').fontSize(7.5).fillColor('#475569');
        for (const term of agreementData.terms) {
            doc.font('Helvetica-Bold').text(term.title, 48, yPos);
            yPos += 9;
            doc.font('Helvetica').text(term.body, 48, yPos, { width: 500 });
            yPos += 18;
        }

        // Section: Digital Acceptance & Signatures
        yPos += 5;
        const isAccepted = Boolean(acceptanceDetails && acceptanceDetails.accepted);

        if (isAccepted) {
            doc.rect(40, yPos, 515, 52).fill('#ecfdf5').stroke('#10b981');
            doc.fillColor('#065f46').font('Helvetica-Bold').fontSize(10)
                .text('✓ DIGITAL AGREEMENT CONFIRMED & ACCEPTED ELECTRONICALLY', 52, yPos + 8);
            doc.font('Helvetica').fontSize(8.5).fillColor('#047857')
                .text(`Accepted by Lessee: ${agreementData.customer.name} (${agreementData.customer.email})`, 52, yPos + 22)
                .text(`Timestamp: ${new Date(acceptanceDetails.acceptedAt || Date.now()).toLocaleString('en-IN')}`, 52, yPos + 34)
                .text(`Digital Verification Hash: ${Buffer.from(`${agreementNumber}-${agreementData.booking.bookingId}`).toString('base64').substring(0, 24)}`, 320, yPos + 34);
        } else {
            doc.rect(40, yPos, 515, 46).fill('#fffbeb').stroke('#f59e0b');
            doc.fillColor('#92400e').font('Helvetica-Bold').fontSize(10)
                .text('⚠ PENDING DIGITAL ACCEPTANCE BY LESSEE', 52, yPos + 8);
            doc.font('Helvetica').fontSize(8.5).fillColor('#b45309')
                .text('This agreement is generated automatically upon booking confirmation. The customer must review and accept the agreement terms prior to vehicle handover.', 52, yPos + 22, { width: 490 });
        }

        // Footer
        doc.fontSize(7.5).fillColor('#94a3b8').text(
            `RentIQ Mobility Solutions • CIN: U50100CH2025PTC045892 • Page 1 of 1 • System-Generated Legal Document`,
            40,
            795,
            { align: 'center', width: 515 }
        );

        doc.end();

        writeStream.on('finish', () => resolve(filePath));
        writeStream.on('error', (err) => reject(err));
    });
}

module.exports = {
    COMPANY_INFO,
    STANDARD_TERMS,
    buildAgreementData,
    generateAgreementPDF,
    maskLicenseNumber
};

