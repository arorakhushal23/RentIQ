const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { uploadCustomerLicense } = require('../utils/fileUpload');
const {
    getMyLicense,
    submitLicense,
    downloadMyLicenseDoc
} = require('../controllers/licenseController');

router.use(authMiddleware);

router.get('/my-license', getMyLicense);
router.post(
    '/submit',
    uploadCustomerLicense.fields([
        { name: 'front', maxCount: 1 },
        { name: 'back', maxCount: 1 }
    ]),
    submitLicense
);
router.get('/my-license/document/:side', downloadMyLicenseDoc);

module.exports = router;

