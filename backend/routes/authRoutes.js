const express = require('express');
const router = express.Router();
const {
    register,
    login,
    getMe,
    updateMe,
    changePassword,
    forgotPassword,
    resetPassword,
    devGetLastResetToken
} = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const { forgotPasswordRateLimiter } = require('../middleware/rateLimiter');

router.post('/register', register);
router.post('/login', login);
router.get('/me', authMiddleware, getMe);
router.put('/me', authMiddleware, updateMe);
router.put('/change-password', authMiddleware, changePassword);
router.post('/forgot-password', forgotPasswordRateLimiter(), forgotPassword);
router.post('/reset-password', resetPassword);

// Local development-only test endpoint (strictly returns 404 in production)
if (process.env.NODE_ENV !== 'production') {
    router.get('/dev-last-reset-token', devGetLastResetToken);
}

module.exports = router;
