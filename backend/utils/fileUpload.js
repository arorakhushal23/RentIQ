const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Supported mime types and extensions
const ALLOWED_MIME_TYPES = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png'
};

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png']);

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Configure disk storage for a specific subdirectory
 */
function createDiskStorage(subDirectory) {
    const uploadPath = path.resolve(__dirname, '..', 'uploads', subDirectory);

    if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
    }

    return multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
            const rawExt = path.extname(file.originalname).toLowerCase();
            const safeExt = ALLOWED_EXTENSIONS.has(rawExt) ? rawExt : '.bin';
            const uniqueId = crypto.randomUUID();
            cb(null, `${uniqueId}${safeExt}`);
        }
    });
}

/**
 * File filter to reject unsupported types
 */
function fileFilter(req, file, cb) {
    const mimeAllowed = Boolean(ALLOWED_MIME_TYPES[file.mimetype]);
    const ext = path.extname(file.originalname).toLowerCase();
    const extAllowed = ALLOWED_EXTENSIONS.has(ext);

    if (mimeAllowed && extAllowed) {
        cb(null, true);
    } else {
        cb(
            new Error(
                'Invalid file format. Only PDF, JPG, JPEG, and PNG files are accepted.'
            ),
            false
        );
    }
}

// Multer upload instances
const uploadVehicleDocument = multer({
    storage: createDiskStorage('vehicle_documents'),
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter
});

const uploadCustomerLicense = multer({
    storage: createDiskStorage('customer_licenses'),
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter
});

module.exports = {
    uploadVehicleDocument,
    uploadCustomerLicense,
    ALLOWED_EXTENSIONS,
    ALLOWED_MIME_TYPES,
    MAX_FILE_SIZE
};

