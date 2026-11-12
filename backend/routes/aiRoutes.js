/**
 * RentIQ AI Assistant Routes
 *
 * File: backend/routes/aiRoutes.js
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { handleChat, handleRecommend, getSuggestions } = require('../controllers/aiController');

// Optional authentication: Populates req.user if valid token provided, but permits guest access
const optionalAuth = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization || req.header('Authorization');
        if (authHeader && typeof authHeader === 'string') {
            const parts = authHeader.trim().split(' ');
            if (parts.length === 2 && parts[0] === 'Bearer' && parts[1].trim()) {
                const token = parts[1].trim();
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                req.user = decoded;
            }
        }
    } catch (e) {
        // Continue as guest
        req.user = null;
    }
    next();
};

// Conversational AI chat endpoint
router.post('/chat', optionalAuth, handleChat);

// Direct vehicle recommendations
router.post('/recommend', optionalAuth, handleRecommend);

// Quick suggested prompt chips
router.get('/suggestions', getSuggestions);

module.exports = router;
