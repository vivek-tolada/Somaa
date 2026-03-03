'use strict';

const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const db = require('../config/database');
const { handleValidation } = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiter');
const { authenticate } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post(
    '/login',
    authLimiter,
    [
        body('email').isEmail().normalizeEmail().withMessage('Valid email required.'),
        body('password').notEmpty().withMessage('Password required.'),
    ],
    handleValidation,
    async (req, res, next) => {
        try {
            const { email, password } = req.body;
            const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email);

            if (!user) {
                logger.warn('Login attempt for unknown email', { email, ip: req.ip });
                return res.status(401).json({ success: false, message: 'Invalid credentials.' });
            }

            const valid = await bcrypt.compare(password, user.password_hash);
            if (!valid) {
                logger.warn('Failed login attempt', { email, ip: req.ip });
                return res.status(401).json({ success: false, message: 'Invalid credentials.' });
            }

            // Update last login
            db.prepare('UPDATE users SET last_login = ? WHERE id = ?')
                .run(new Date().toISOString(), user.id);

            const token = jwt.sign(
                { id: user.id, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRY || '8h' }
            );

            // Audit log
            db.prepare(`INSERT INTO system_logs (id, admin_id, action, ip_address) VALUES (?,?,?,?)`)
                .run(uuidv4(), user.id, 'LOGIN', req.ip);

            logger.info('Admin login successful', { email, id: user.id });
            return res.json({
                success: true,
                token,
                user: { id: user.id, name: user.name, email: user.email, role: user.role },
            });
        } catch (err) {
            next(err);
        }
    }
);

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', authenticate, (req, res) => {
    res.json({ success: true, user: req.user });
});

// ─── POST /api/auth/change-password ──────────────────────────────────────────
router.post(
    '/change-password',
    authenticate,
    [
        body('current_password').notEmpty(),
        body('new_password').isLength({ min: 8 }).withMessage('New password must be at least 8 characters.'),
    ],
    handleValidation,
    async (req, res, next) => {
        try {
            const { current_password, new_password } = req.body;
            const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

            const valid = await bcrypt.compare(current_password, user.password_hash);
            if (!valid) return res.status(400).json({ success: false, message: 'Current password incorrect.' });

            const hash = await bcrypt.hash(new_password, 12);
            db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
                .run(hash, new Date().toISOString(), user.id);

            db.prepare(`INSERT INTO system_logs (id, admin_id, action, ip_address) VALUES (?,?,?,?)`)
                .run(uuidv4(), user.id, 'CHANGE_PASSWORD', req.ip);

            res.json({ success: true, message: 'Password updated.' });
        } catch (err) {
            next(err);
        }
    }
);

module.exports = router;
