'use strict';

const router = require('express').Router();
const { body } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { handleValidation } = require('../middleware/validate');
const { publicFormLimiter, adminLimiter } = require('../middleware/rateLimiter');
const { authenticate } = require('../middleware/auth');
const logger = require('../config/logger');

// ─── POST /api/inquiries (public) ────────────────────────────────────────────
router.post(
    '/',
    publicFormLimiter,
    [
        body('name').trim().notEmpty().isLength({ max: 100 }).withMessage('Name is required.'),
        body('phone').optional({ checkFalsy: true }).trim().matches(/^[6-9]\d{9}$/).withMessage('Valid 10-digit Indian mobile number.'),
        body('message').trim().notEmpty().isLength({ min: 5, max: 1000 }).withMessage('Message must be 5–1000 characters.'),
    ],
    handleValidation,
    (req, res, next) => {
        try {
            const { name, phone, message } = req.body;
            const id = uuidv4();

            db.prepare(`
        INSERT INTO inquiries (id, name, phone, message, source, ip_address, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, name, phone || null, message, 'website', req.ip, new Date().toISOString());

            logger.info('Inquiry received', { id, name });

            return res.status(201).json({
                success: true,
                message: 'Message received! We will get back to you shortly.',
                id,
            });
        } catch (err) {
            next(err);
        }
    }
);

// ─── GET /api/inquiries (admin) ───────────────────────────────────────────────
router.get(
    '/',
    authenticate,
    adminLimiter,
    (req, res, next) => {
        try {
            const page = Math.max(1, parseInt(req.query.page) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
            const offset = (page - 1) * limit;

            const total = db.prepare('SELECT COUNT(*) as count FROM inquiries').get().count;
            const rows = db.prepare('SELECT * FROM inquiries ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);

            return res.json({
                success: true,
                pagination: { total, page, limit, pages: Math.ceil(total / limit) },
                inquiries: rows,
            });
        } catch (err) {
            next(err);
        }
    }
);

module.exports = router;
