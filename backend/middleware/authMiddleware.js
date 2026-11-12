const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    try {
        let token = null;
        const authHeader = req.headers.authorization || req.header('Authorization');

        if (authHeader && typeof authHeader === 'string') {
            const parts = authHeader.trim().split(' ');
            if (parts.length === 2 && parts[0] === 'Bearer' && parts[1].trim()) {
                token = parts[1].trim();
            }
        }

        // Support token in query string (e.g. for photo streaming, PDF viewing)
        if (!token && req.query && req.query.token && typeof req.query.token === 'string') {
            token = req.query.token.trim();
        }

        if (!token) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};

module.exports = authMiddleware;
