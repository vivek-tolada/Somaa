'use strict';

const router = require('express').Router();
const { body, query } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { handleValidation } = require('../middleware/validate');
const { publicFormLimiter, adminLimiter } = require('../middleware/rateLimiter');
const { authenticate } = require('../middleware/auth');
const { notifyPartyBookingCreated, notifyPartyBookingStatusUpdate } = require('../services/notificationService');
const logger = require('../config/logger');

// ─── POST /api/party-bookings (public) ───────────────────────────────────────
router.post(
    '/',
    publicFormLimiter,
    [
        body('name').trim().notEmpty().isLength({ max: 100 }).withMessage('Name is required.'),
        body('phone').trim().matches(/^[6-9]\d{9}$/).withMessage('Valid 10-digit Indian mobile number required.'),
        body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
        body('event_type').isIn(['birthday', 'corporate', 'social', 'other']).withMessage('Invalid event type.'),
        body('preferred_date').isDate({ format: 'YYYY-MM-DD' }).withMessage('Date must be YYYY-MM-DD.')
            .custom(val => {
                if (new Date(val) < new Date(new Date().toDateString()))
                    throw new Error('Preferred date cannot be in the past.');
                return true;
            }),
        body('guest_count').isInt({ min: 1, max: 500 }).withMessage('Guest count must be between 1 and 500.'),
        body('notes').optional().trim().isLength({ max: 1000 }),
    ],
    handleValidation,
    async (req, res, next) => {
        try {
            const { name, phone, email, event_type, preferred_date, guest_count, notes } = req.body;
            const id = uuidv4();
            const now = new Date().toISOString();

            db.prepare(`
        INSERT INTO party_bookings (id, name, phone, email, event_type, preferred_date, guest_count, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, name, phone, email || null, event_type, preferred_date, guest_count, notes || null, now, now);

            const booking = db.prepare('SELECT * FROM party_bookings WHERE id = ?').get(id);

            setImmediate(() => notifyPartyBookingCreated(booking));

            logger.info('Party booking created', { id, event_type, preferred_date, guest_count });

            return res.status(201).json({
                success: true,
                message: 'Your party inquiry has been received! Our events team will contact you within 24 hours.',
                booking: {
                    id: booking.id,
                    name: booking.name,
                    event_type: booking.event_type,
                    preferred_date: booking.preferred_date,
                    status: booking.status,
                },
            });
        } catch (err) {
            next(err);
        }
    }
);

// ─── GET /api/party-bookings (admin) ─────────────────────────────────────────
router.get(
    '/',
    authenticate,
    adminLimiter,
    [
        query('status').optional().isIn(['new', 'contacted', 'quoted', 'confirmed', 'closed']),
        query('event_type').optional().isIn(['birthday', 'corporate', 'social', 'other']),
        query('phone').optional().trim(),
        query('date_from').optional().isDate({ format: 'YYYY-MM-DD' }),
        query('date_to').optional().isDate({ format: 'YYYY-MM-DD' }),
        query('page').optional().isInt({ min: 1 }).toInt().default(1),
        query('limit').optional().isInt({ min: 1, max: 100 }).toInt().default(20),
    ],
    handleValidation,
    (req, res, next) => {
        try {
            const { status, event_type, phone, date_from, date_to, page = 1, limit = 20 } = req.query;
            const offset = (page - 1) * limit;

            const conditions = ['deleted_at IS NULL'];
            const params = [];

            if (status) { conditions.push('status = ?'); params.push(status); }
            if (event_type) { conditions.push('event_type = ?'); params.push(event_type); }
            if (phone) { conditions.push('phone LIKE ?'); params.push(`%${phone}%`); }
            if (date_from) { conditions.push('preferred_date >= ?'); params.push(date_from); }
            if (date_to) { conditions.push('preferred_date <= ?'); params.push(date_to); }

            const where = conditions.join(' AND ');

            const total = db.prepare(`SELECT COUNT(*) as count FROM party_bookings WHERE ${where}`).get(...params).count;
            const rows = db.prepare(
                `SELECT * FROM party_bookings WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
            ).all(...params, limit, offset);

            return res.json({
                success: true,
                pagination: { total, page, limit, pages: Math.ceil(total / limit) },
                bookings: rows,
            });
        } catch (err) {
            next(err);
        }
    }
);

// ─── PATCH /api/party-bookings/:id (admin) ───────────────────────────────────
router.patch(
    '/:id',
    authenticate,
    adminLimiter,
    [
        body('status').optional().isIn(['new', 'contacted', 'quoted', 'confirmed', 'closed']),
        body('notes').optional().trim().isLength({ max: 1000 }),
        body('priority').optional().isIn(['high', 'medium', 'low']),
    ],
    handleValidation,
    (req, res, next) => {
        try {
            const existing = db.prepare('SELECT * FROM party_bookings WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
            if (!existing) return res.status(404).json({ success: false, message: 'Party booking not found.' });

            const updates = {};
            if (req.body.status !== undefined) updates.status = req.body.status;
            if (req.body.notes !== undefined) updates.notes = req.body.notes;
            if (req.body.priority !== undefined) updates.priority = req.body.priority;

            if (Object.keys(updates).length === 0)
                return res.status(400).json({ success: false, message: 'No valid fields to update.' });

            updates.updated_at = new Date().toISOString();
            const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');

            db.prepare(`UPDATE party_bookings SET ${setClauses} WHERE id = ?`)
                .run(...Object.values(updates), req.params.id);

            db.prepare(`INSERT INTO system_logs (id, admin_id, action, entity_type, entity_id, details, ip_address) VALUES (?,?,?,?,?,?,?)`)
                .run(uuidv4(), req.user.id, 'UPDATE_PARTY_BOOKING', 'party_booking', req.params.id, JSON.stringify(updates), req.ip);

            const updated = db.prepare('SELECT * FROM party_bookings WHERE id = ?').get(req.params.id);

            // Notify user if status changed
            if (updates.status && updates.status !== existing.status) {
                setImmediate(() => notifyPartyBookingStatusUpdate(updated));
            }

            return res.json({ success: true, booking: updated });
        } catch (err) {
            next(err);
        }
    }
);

module.exports = router;
