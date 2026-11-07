const fs = require('fs');
const path = require('path');

// 1x1 valid transparent PNG binary buffer
const VALID_PNG_BUFFER = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000640000004008060000009c91ea280000001f49444154789c63601805a360148c8251300a4641281805a360148c82510000456108b90000000049454e44ae426082',
    'hex'
);

// Minimal valid PDF binary buffer
const VALID_PDF_BUFFER = Buffer.from(
    `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 85 >> stream
BT
/F1 20 Tf
70 700 Td
(RentIQ Verified Customer Driving Licence Document) Tj
ET
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000069 00000 n 
0000000140 00000 n 
0000000287 00000 n 
0000000424 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
506
%%EOF
`,
    'utf-8'
);

/**
 * Ensures all required upload directories and seeded demo files exist on disk
 */
function ensureUploadFiles() {
    const baseUploadsDir = path.resolve(__dirname, '..', 'uploads');

    const subDirs = [
        'customer_licenses',
        'vehicle_documents',
        'inspection_photos',
        'maintenance_invoices',
        'agreements'
    ];

    for (const dir of subDirs) {
        const fullPath = path.resolve(baseUploadsDir, dir);
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
        }
    }

    // Seeded customer licence files referenced in test database
    const licenseUploadsDir = path.resolve(baseUploadsDir, 'customer_licenses');
    const demoLicenseFiles = [
        'demo_license_front.png',
        'demo_license_back.png',
        'demo_license_front2.png',
        'demo_license_back2.png',
        'demo_license_front8.png',
        'demo_license_back8.png',
        'demo_11.png',
        'dl.png',
        'sample_document.pdf'
    ];

    for (const file of demoLicenseFiles) {
        const filePath = path.resolve(licenseUploadsDir, file);
        if (!fs.existsSync(filePath)) {
            const buffer = file.endsWith('.pdf') ? VALID_PDF_BUFFER : VALID_PNG_BUFFER;
            fs.writeFileSync(filePath, buffer);
        }
    }

    // Seeded vehicle compliance documents referenced in test database
    const vehicleDocsDir = path.resolve(baseUploadsDir, 'vehicle_documents');
    const demoVehicleDocs = [
        'sample_rc_swift.pdf',
        'sample_insurance_swift.pdf',
        'sample_puc_swift.pdf',
        'sample_rc_i20.pdf',
        'sample_insurance_i20.pdf',
        'sample_puc_i20.pdf',
        'sample_rc_verna.pdf',
        'sample_insurance_verna.pdf',
        'sample_puc_verna.pdf'
    ];

    for (const file of demoVehicleDocs) {
        const filePath = path.resolve(vehicleDocsDir, file);
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, VALID_PDF_BUFFER);
        }
    }
}

module.exports = {
    ensureUploadFiles,
    VALID_PNG_BUFFER,
    VALID_PDF_BUFFER
};

