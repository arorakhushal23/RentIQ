const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/db');
const { sendPasswordResetEmail, getDevLatestResetLink } = require('../utils/emailService');

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

        const { currentPassword, newPassword, confirmPassword } = req.body;

        if (!currentPassword || typeof currentPassword !== 'string' || !currentPassword.trim()) {
            return res.status(400).json({ message: 'Current password is required' });
        }

        if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
            return res.status(400).json({ message: 'New password must be at least 8 characters long' });
        }

        if (confirmPassword !== undefined && newPassword !== confirmPassword) {
            return res.status(400).json({ message: 'New password and confirmation do not match' });
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

        // Invalidate outstanding password reset tokens for this user
        await db.query(
            'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL',
            [userId]
        );

        return res.status(200).json({
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('changePassword error:', error);
        return res.status(500).json({ message: 'Internal server error while changing password' });
    }
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email || typeof email !== 'string' || !email.trim()) {
            return res.status(400).json({ message: 'Email address is required' });
        }

        const normalizedEmail = email.trim().toLowerCase();

        if (!EMAIL_REGEX.test(normalizedEmail)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        const GENERIC_RESPONSE = {
            message: 'If an account exists with that email address, a password reset link has been sent.'
        };

        const [users] = await db.query(
            'SELECT user_id, name, email FROM users WHERE email = ?',
            [normalizedEmail]
        );

        if (users.length === 0) {
            return res.status(200).json(GENERIC_RESPONSE);
        }

        const user = users[0];

        // Invalidate any previously active unused tokens for this user
        await db.query(
            'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL',
            [user.user_id]
        );

        // Generate 32 bytes (64 hex characters) cryptographically secure random token
        const rawToken = crypto.randomBytes(32).toString('hex');

        // Store SHA-256 hash in database
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

        // Token expiry: 15 minutes from now
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        await db.query(
            'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
            [user.user_id, tokenHash, expiresAt]
        );

        // Construct reset link
        const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';
        const resetUrl = `${frontendBase}/reset-password?token=${rawToken}`;

        // Send email (never exposes tokens in production logs)
        await sendPasswordResetEmail({
            toEmail: user.email,
            userName: user.name,
            resetUrl,
            rawToken
        });

        // Always return generic response
        return res.status(200).json(GENERIC_RESPONSE);
    } catch (error) {
        console.error('forgotPassword error:', error);
        return res.status(500).json({ message: 'Internal server error while processing password reset request' });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { token, newPassword, confirmPassword } = req.body;

        if (!token || typeof token !== 'string' || !token.trim()) {
            return res.status(400).json({ message: 'Password reset token is required' });
        }

        if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
            return res.status(400).json({ message: 'New password must be at least 8 characters long' });
        }

        if (confirmPassword !== undefined && newPassword !== confirmPassword) {
            return res.status(400).json({ message: 'Password confirmation does not match' });
        }

        const cleanToken = token.trim();
        const tokenHash = crypto.createHash('sha256').update(cleanToken).digest('hex');

        const [tokenRecords] = await db.query(
            'SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = ?',
            [tokenHash]
        );

        if (tokenRecords.length === 0) {
            return res.status(400).json({ message: 'Invalid or expired password reset link' });
        }

        const tokenRecord = tokenRecords[0];

        if (tokenRecord.used_at !== null) {
            return res.status(400).json({ message: 'This password reset link has already been used' });
        }

        const now = new Date();
        const expiresAt = new Date(tokenRecord.expires_at);
        if (now > expiresAt) {
            return res.status(400).json({ message: 'Password reset link has expired. Please request a new one.' });
        }

        const [users] = await db.query(
            'SELECT user_id, password_hash FROM users WHERE user_id = ?',
            [tokenRecord.user_id]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: 'Associated user account not found' });
        }

        const user = users[0];

        const isCurrentMatch = await bcrypt.compare(newPassword, user.password_hash);
        if (isCurrentMatch) {
            return res.status(400).json({ message: 'New password must be different from current password' });
        }

        const saltRounds = 10;
        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

        await db.query(
            'UPDATE users SET password_hash = ? WHERE user_id = ?',
            [newPasswordHash, user.user_id]
        );

        // Invalidate current and all other outstanding reset tokens for this user
        await db.query(
            'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL',
            [user.user_id]
        );

        return res.status(200).json({
            message: 'Password has been reset successfully. You may now log in.'
        });
    } catch (error) {
        console.error('resetPassword error:', error);
        return res.status(500).json({ message: 'Internal server error while resetting password' });
    }
};

exports.devGetLastResetToken = (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ message: 'Not found' });
    }

    const { email } = req.query;
    if (!email) {
        return res.status(400).json({ message: 'Email query parameter required' });
    }

    const record = getDevLatestResetLink(email);
    if (!record) {
        return res.status(404).json({ message: 'No reset token recorded in dev mailbox for this email' });
    }

    return res.status(200).json({
        email: record.toEmail,
        rawToken: record.rawToken,
        resetUrl: record.resetUrl,
        sentAt: record.sentAt
    });
};

