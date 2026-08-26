const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization || req.header('Authorization');

        if (!authHeader || typeof authHeader !== 'string') {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const parts = authHeader.trim().split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1].trim()) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const token = parts[1].trim();

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        // Return generic 401 response to avoid leaking internal error details
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};

module.exports = authMiddleware;
