/**
 * RentIQ AI Assistant & Recommendation Controller
 *
 * File: backend/controllers/aiController.js
 *
 * Implements secure endpoints for AI Chat Assistant, Smart Vehicle Recommendations,
 * and Rate Limiting.
 */

const aiService = require('../services/aiService');
const vehicleRecommendationService = require('../services/vehicleRecommendationService');

// In-memory sliding window rate limiter (30 requests per minute per IP)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 30;

function checkRateLimit(clientIp) {
    const now = Date.now();
    const timestamps = rateLimitMap.get(clientIp) || [];

    // Filter timestamps within current window
    const validTimestamps = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);

    if (validTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
        return false;
    }

    validTimestamps.push(now);
    rateLimitMap.set(clientIp, validTimestamps);
    return true;
}

// Cleanup stale rate limit entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of rateLimitMap.entries()) {
        const recent = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
        if (recent.length === 0) {
            rateLimitMap.delete(ip);
        } else {
            rateLimitMap.set(ip, recent);
        }
    }
}, 5 * 60 * 1000);

/**
 * POST /api/ai/chat
 * Main conversational endpoint
 */
const handleChat = async (req, res) => {
    try {
        const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';

        // 1. Rate Limiting Check
        if (!checkRateLimit(clientIp)) {
            return res.status(429).json({
                message: 'You have sent too many messages in a short time. Please wait a minute before asking another question.',
                recommendations: [],
                pricingEstimate: null
            });
        }

        const { message, history } = req.body;

        // 2. Input Validation
        if (!message || typeof message !== 'string' || !message.trim()) {
            return res.status(400).json({
                message: 'A non-empty message string is required.'
            });
        }

        const trimmed = message.trim();
        if (trimmed.length > 1000) {
            return res.status(400).json({
                message: 'Message exceeds the maximum limit of 1,000 characters.'
            });
        }

        // Validate conversation history format
        const cleanHistory = [];
        if (Array.isArray(history)) {
            for (const item of history.slice(-10)) {
                if (item && typeof item === 'object' && item.role && item.content) {
                    cleanHistory.push({
                        role: item.role === 'assistant' ? 'assistant' : 'user',
                        content: String(item.content).slice(0, 1000)
                    });
                }
            }
        }

        // 3. Process conversation with user context if present
        const currentUser = req.user || null;
        const result = await aiService.processChatMessage(trimmed, cleanHistory, currentUser);

        return res.status(200).json({
            message: result.message,
            recommendations: result.recommendations || [],
            pricingEstimate: result.pricingEstimate || null,
            source: result.source || 'ai',
            suggestedQuestions: result.suggestedQuestions || []
        });

    } catch (err) {
        console.error('Error in /api/ai/chat:', err);
        return res.status(500).json({
            message: 'I encountered an unexpected issue while processing your request. Please try asking again in a moment.',
            recommendations: [],
            pricingEstimate: null
        });
    }
};

/**
 * POST /api/ai/recommend
 * Direct structured recommendation endpoint
 */
const handleRecommend = async (req, res) => {
    try {
        const result = await vehicleRecommendationService.searchAndRankVehicles(req.body || {});
        return res.status(200).json(result);
    } catch (err) {
        console.error('Error in /api/ai/recommend:', err);
        return res.status(500).json({
            message: 'Failed to retrieve vehicle recommendations.',
            recommendations: [],
            alternatives: []
        });
    }
};

/**
 * GET /api/ai/suggestions
 * Returns suggested prompt questions for customer convenience
 */
const getSuggestions = async (req, res) => {
    return res.status(200).json({
        suggestions: [
            'Recommend a vehicle for me',
            'Find an SUV under ₹4,000/day',
            'Which vehicle is best for a family trip?',
            'Show me automatic vehicles',
            'Explain rental pricing',
            'How do I book a vehicle?'
        ]
    });
};

module.exports = {
    handleChat,
    handleRecommend,
    getSuggestions
};
