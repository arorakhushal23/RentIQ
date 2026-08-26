const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

// Standard email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Validate presence and types
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ message: 'Name is required' });
        }

        if (!email || typeof email !== 'string' || !email.trim()) {
            return res.status(400).json({ message: 'Email is required' });
        }

        const normalizedEmail = email.trim().toLowerCase();

        if (!EMAIL_REGEX.test(normalizedEmail)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        if (!password || typeof password !== 'string' || password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters long' });
        }

        const trimmedName = name.trim();

        // Check if email already exists using parameterized query
        const [existingUsers] = await db.query(
            'SELECT user_id FROM users WHERE email = ?',
            [normalizedEmail]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({ message: 'Email is already registered' });
        }

        // Hash password with 10 salt rounds
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Insert new user - explicitly enforce role as 'customer' to prevent client tampering
        const [result] = await db.query(
            'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
            [trimmedName, normalizedEmail, passwordHash, 'customer']
        );

        const userId = result.insertId;

        // Generate JWT token valid for 7 days
        const token = jwt.sign(
            {
                user_id: userId,
                email: normalizedEmail,
                role: 'customer'
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        return res.status(201).json({
            message: 'Registration successful',
            token,
            user: {
                user_id: userId,
                name: trimmedName,
                email: normalizedEmail,
                role: 'customer'
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ message: 'Internal server error during registration' });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate presence and types
        if (!email || typeof email !== 'string' || !email.trim()) {
            return res.status(400).json({ message: 'Email is required' });
        }

        if (!password || typeof password !== 'string' || !password.trim()) {
            return res.status(400).json({ message: 'Password is required' });
        }

        const normalizedEmail = email.trim().toLowerCase();

        if (!EMAIL_REGEX.test(normalizedEmail)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        // Find user by normalized email using parameterized query
        const [users] = await db.query(
            'SELECT user_id, name, email, password_hash, role FROM users WHERE email = ?',
            [normalizedEmail]
        );

        // Generic error response to prevent user enumeration
        const genericAuthError = { message: 'Invalid email or password' };

        if (users.length === 0) {
            return res.status(401).json(genericAuthError);
        }

        const user = users[0];

        // Verify password with bcrypt
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json(genericAuthError);
        }

        // Generate JWT token valid for 7 days
        const token = jwt.sign(
            {
                user_id: user.user_id,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        return res.status(200).json({
            message: 'Login successful',
            token,
            user: {
                user_id: user.user_id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ message: 'Internal server error during login' });
    }
};

exports.getMe = async (req, res) => {
    try {
        return res.status(200).json({
            message: 'Authenticated',
            user: {
                user_id: req.user.user_id,
                email: req.user.email,
                role: req.user.role
            }
        });
    } catch (error) {
        console.error('getMe error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};
