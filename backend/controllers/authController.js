const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

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

        const [existingUsers] = await db.query(
            'SELECT user_id FROM users WHERE email = ?',
            [normalizedEmail]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({ message: 'Email is already registered' });
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const [result] = await db.query(
            'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
            [trimmedName, normalizedEmail, passwordHash, 'customer']
        );

        const userId = result.insertId;

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

        const [users] = await db.query(
            'SELECT user_id, name, email, password_hash, role FROM users WHERE email = ?',
            [normalizedEmail]
        );

        if (users.length === 0) {
            return res.status(401).json({ message: 'No account found with this email address' });
        }

        const user = users[0];

        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

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

exports.updateMe = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ message: 'Name is required' });
        }

        const trimmedName = name.trim();
        await db.query(
            'UPDATE users SET name = ? WHERE user_id = ?',
            [trimmedName, req.user.user_id]
        );

        return res.status(200).json({
            message: 'Profile updated successfully',
            user: {
                user_id: req.user.user_id,
                name: trimmedName,
                email: req.user.email,
                role: req.user.role
            }
        });
    } catch (error) {
        console.error('updateMe error:', error);
        return res.status(500).json({ message: 'Internal server error during profile update' });
    }
};

exports.changePassword = async (req, res) => {
    try {
        const userId = req.user?.user_id;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || typeof currentPassword !== 'string' || !currentPassword.trim()) {
            return res.status(400).json({ message: 'Current password is required' });
        }

        if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
            return res.status(400).json({ message: 'New password must be at least 6 characters long' });
        }

        const [users] = await db.query(
            'SELECT user_id, email, password_hash, role FROM users WHERE user_id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = users[0];

        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Current password does not match' });
        }

        if (currentPassword === newPassword) {
            return res.status(400).json({ message: 'New password must be different from current password' });
        }

        const saltRounds = 10;
        const newHash = await bcrypt.hash(newPassword, saltRounds);

        await db.query(
            'UPDATE users SET password_hash = ? WHERE user_id = ?',
            [newHash, userId]
        );

        return res.status(200).json({
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('changePassword error:', error);
        return res.status(500).json({ message: 'Internal server error while changing password' });
    }
};

