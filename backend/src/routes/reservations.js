'use strict';

const router = require('express').Router();
const { body, query } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { handleValidation } = require('../middleware/validate');
const { publicFormLimiter, adminLimiter } = require('../middleware/rateLimiter');
const { authenticate } = require('../middleware/auth');
const { checkCapacity, isValidSlot } = require('../services/reservationService');
const { notifyReservationCreated, notifyReservationStatusUpdate } = require('../services/notificationService');
const logger = require('../config/logger');

// ─── POST /api/reservations  (public) ────────────────────────────────────────
router.post(
    '/',
    publicFormLimiter,
    [
        body('name').trim().notEmpty().isLength({ max: 100 }).withMessage('Name is required (max 100 chars).'),
        body('phone').trim().matches(/^[6-9]\d{9}$/).withMessage('Valid 10-digit Indian mobile number required.'),
        body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
        body('date').isDate({ format: 'YYYY-MM-DD' }).withMessage('Date must be YYYY-MM-DD.')
            .custom(val => {
                if (new Date(val) < new Date(new Date().toDateString()))
                    throw new Error('Reservation date cannot be in the past.');
                return true;
            }),
        body('time_slot').custom(val => {
            if (!isValidSlot(val)) throw new Error('Invalid time slot. Options: 11:30 to 23:00 in 30-min intervals.');
            return true;
        }),
        body('guests').isInt({ min: 1, max: 30 }).withMessage('Guests must be between 1 and 30.'),
        body('special_requests').optional().trim().isLength({ max: 500 }),
    ],
    handleValidation,
    async (req, res, next) => {
        try {
            const { name, phone, email, date, time_slot, guests, special_requests } = req.body;

            // Capacity check
            const capacity = checkCapacity(date, time_slot, guests);
            if (!capacity.available) {
                return res.status(409).json({
                    success: false,
                    message: `Fully booked for ${time_slot} on ${date}. Only ${capacity.remaining} seats remain. Please choose a different time.`,
                    remaining: capacity.remaining,
                });
            }

            const id = uuidv4();
            const now = new Date().toISOString();

            db.prepare(`
        INSERT INTO reservations (id, name, phone, email, date, time_slot, guests, special_requests, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, name, phone, email || null, date, time_slot, guests, special_requests || null, now, now);

            const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id);

            // Fire and forget notifications
            setImmediate(() => notifyReservationCreated(reservation));

            logger.info('Reservation created', { id, date, time_slot, guests });

            return res.status(201).json({
                success: true,
                message: 'Reservation received! We will confirm within 2 hours.',
                reservation: {
                    id: reservation.id,
                    name: reservation.name,
                    date: reservation.date,
                    time_slot: reservation.time_slot,
                    guests: reservation.guests,
                    status: reservation.status,
                },
            });
        } catch (err) {
            next(err);
        }
    }
);

// ─── GET /api/reservations  (admin) ──────────────────────────────────────────
router.get(
    '/',
    authenticate,
    adminLimiter,
    [
        query('date').optional().isDate({ format: 'YYYY-MM-DD' }),
        query('status').optional().isIn(['pending', 'confirmed', 'cancelled', 'completed']),
        query('phone').optional().trim(),
        query('page').optional().isInt({ min: 1 }).toInt().default(1),
        query('limit').optional().isInt({ min: 1, max: 100 }).toInt().default(20),
    ],
    handleValidation,
    (req, res, next) => {
        try {
            const { date, status, phone, page = 1, limit = 20 } = req.query;
            const offset = (page - 1) * limit;

            const conditions = ['deleted_at IS NULL'];
            const params = [];

            if (date) { conditions.push('date = ?'); params.push(date); }
            if (status) { conditions.push('status = ?'); params.push(status); }
            if (phone) { conditions.push('phone LIKE ?'); params.push(`%${phone}%`); }

            const where = conditions.join(' AND ');

            const total = db.prepare(`SELECT COUNT(*) as count FROM reservations WHERE ${where}`).get(...params).count;
            const rows = db.prepare(
                `SELECT * FROM reservations WHERE ${where} ORDER BY date ASC, time_slot ASC LIMIT ? OFFSET ?`
            ).all(...params, limit, offset);

            return res.json({
                success: true,
                pagination: { total, page, limit, pages: Math.ceil(total / limit) },
                reservations: rows,
            });
        } catch (err) {
            next(err);
        }
    }
);

// ─── PATCH /api/reservations/:id  (admin) ────────────────────────────────────
router.patch(
    '/:id',
    authenticate,
    adminLimiter,
    [
        body('status').optional().isIn(['pending', 'confirmed', 'cancelled', 'completed']),
        body('notes').optional().trim().isLength({ max: 1000 }),
    ],
    handleValidation,
    (req, res, next) => {
        try {
            const existing = db.prepare('SELECT * FROM reservations WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
            if (!existing) return res.status(404).json({ success: false, message: 'Reservation not found.' });

            const updates = {};
            if (req.body.status !== undefined) updates.status = req.body.status;
            if (req.body.notes !== undefined) updates.notes = req.body.notes;

            if (Object.keys(updates).length === 0)
                return res.status(400).json({ success: false, message: 'No valid fields to update.' });

            updates.updated_at = new Date().toISOString();
            const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');

            db.prepare(`UPDATE reservations SET ${setClauses} WHERE id = ?`)
                .run(...Object.values(updates), req.params.id);

            // Audit
            db.prepare(`INSERT INTO system_logs (id, admin_id, action, entity_type, entity_id, details, ip_address) VALUES (?,?,?,?,?,?,?)`)
                .run(uuidv4(), req.user.id, 'UPDATE_RESERVATION', 'reservation', req.params.id, JSON.stringify(updates), req.ip);

            const updated = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id);

            // Notify user if status changed
            if (updates.status && updates.status !== existing.status) {
                setImmediate(() => notifyReservationStatusUpdate(updated));
            }

            return res.json({ success: true, reservation: updated });
        } catch (err) {
            next(err);
        }
    }
);

// ─── DELETE /api/reservations/:id (soft delete, admin) ───────────────────────
router.delete('/:id', authenticate, (req, res, next) => {
    try {
        const existing = db.prepare('SELECT id FROM reservations WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
        if (!existing) return res.status(404).json({ success: false, message: 'Reservation not found.' });

        db.prepare('UPDATE reservations SET deleted_at = ?, updated_at = ? WHERE id = ?')
            .run(new Date().toISOString(), new Date().toISOString(), req.params.id);

        db.prepare(`INSERT INTO system_logs (id, admin_id, action, entity_type, entity_id, ip_address) VALUES (?,?,?,?,?,?)`)
            .run(uuidv4(), req.user.id, 'DELETE_RESERVATION', 'reservation', req.params.id, req.ip);

        return res.json({ success: true, message: 'Reservation deleted.' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
