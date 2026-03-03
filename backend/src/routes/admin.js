'use strict';

const router = require('express').Router();
const { body } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { handleValidation } = require('../middleware/validate');
const { adminLimiter } = require('../middleware/rateLimiter');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');
const { generateReservationsCsv, generatePartyBookingsCsv, generateInquiriesCsv } = require('../services/exportService');
const { getDailyOccupancy, getAvailableSlots } = require('../services/reservationService');

// All admin routes require JWT
router.use(authenticate, adminLimiter);

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────
router.get('/stats', (req, res, next) => {
    try {
        const today = new Date().toISOString().slice(0, 10);

        const stats = {
            reservations: {
                total: db.prepare('SELECT COUNT(*) as n FROM reservations WHERE deleted_at IS NULL').get().n,
                today: db.prepare("SELECT COUNT(*) as n FROM reservations WHERE date = ? AND deleted_at IS NULL").get(today).n,
                pending: db.prepare("SELECT COUNT(*) as n FROM reservations WHERE status = 'pending' AND deleted_at IS NULL").get().n,
                confirmed: db.prepare("SELECT COUNT(*) as n FROM reservations WHERE status = 'confirmed' AND deleted_at IS NULL").get().n,
            },
            partyBookings: {
                total: db.prepare('SELECT COUNT(*) as n FROM party_bookings WHERE deleted_at IS NULL').get().n,
                new: db.prepare("SELECT COUNT(*) as n FROM party_bookings WHERE status = 'new' AND deleted_at IS NULL").get().n,
                confirmed: db.prepare("SELECT COUNT(*) as n FROM party_bookings WHERE status = 'confirmed' AND deleted_at IS NULL").get().n,
            },
            inquiries: {
                total: db.prepare('SELECT COUNT(*) as n FROM inquiries').get().n,
                today: db.prepare("SELECT COUNT(*) as n FROM inquiries WHERE date(created_at) = ?").get(today).n,
            },
            todayOccupancy: getDailyOccupancy(today),
        };

        res.json({ success: true, stats });
    } catch (err) {
        next(err);
    }
});

// ─── GET /api/admin/availability ─────────────────────────────────────────────
router.get('/availability', (req, res, next) => {
    try {
        const date = req.query.date;
        if (!date) return res.status(400).json({ success: false, message: 'date query param required (YYYY-MM-DD).' });
        const guests = parseInt(req.query.guests) || 1;
        const slots = getAvailableSlots(date, guests);
        res.json({ success: true, date, guests, slots });
    } catch (err) {
        next(err);
    }
});

// ─── GET /api/admin/logs ────────────────────────────────────────────────────
router.get('/logs', requireSuperAdmin, (req, res, next) => {
    try {
        const limit = Math.min(100, parseInt(req.query.limit) || 50);
        const offset = Math.max(0, parseInt(req.query.page || 1) - 1) * limit;
        const logs = db.prepare(`
      SELECT l.*, u.name as admin_name, u.email as admin_email
      FROM system_logs l
      LEFT JOIN users u ON l.admin_id = u.id
      ORDER BY l.created_at DESC LIMIT ? OFFSET ?
    `).all(limit, offset);
        const total = db.prepare('SELECT COUNT(*) as n FROM system_logs').get().n;
        res.json({ success: true, total, logs });
    } catch (err) {
        next(err);
    }
});

// ─── GET /api/admin/users ─────────────────────────────────────────────────────
router.get('/users', requireSuperAdmin, (req, res, next) => {
    try {
        const users = db.prepare('SELECT id, name, email, role, is_active, last_login, created_at FROM users').all();
        res.json({ success: true, users });
    } catch (err) { next(err); }
});

// ─── POST /api/admin/users (superadmin only) ──────────────────────────────────
router.post(
    '/users',
    requireSuperAdmin,
    [
        body('name').trim().notEmpty().isLength({ max: 100 }),
        body('email').isEmail().normalizeEmail(),
        body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
        body('role').isIn(['superadmin', 'manager']),
    ],
    handleValidation,
    async (req, res, next) => {
        try {
            const { name, email, password, role } = req.body;
            const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
            if (existing) return res.status(409).json({ success: false, message: 'Email already in use.' });

            const id = uuidv4();
            const hash = await bcrypt.hash(password, 12);
            const now = new Date().toISOString();

            db.prepare('INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at) VALUES (?,?,?,?,?,?,?)')
                .run(id, name, email, hash, role, now, now);

            db.prepare(`INSERT INTO system_logs (id, admin_id, action, entity_type, entity_id, ip_address) VALUES (?,?,?,?,?,?)`)
                .run(uuidv4(), req.user.id, 'CREATE_USER', 'user', id, req.ip);

            res.status(201).json({ success: true, message: `User ${email} created.`, id });
        } catch (err) { next(err); }
    }
);

// ─── PATCH /api/admin/users/:id ───────────────────────────────────────────────
router.patch('/users/:id', requireSuperAdmin, [
    body('is_active').optional().isBoolean().toBoolean(),
    body('role').optional().isIn(['superadmin', 'manager']),
], handleValidation, (req, res, next) => {
    try {
        const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
        if (req.params.id === req.user.id) return res.status(400).json({ success: false, message: 'Cannot modify own account here.' });

        const updates = {};
        if (req.body.is_active !== undefined) updates.is_active = req.body.is_active ? 1 : 0;
        if (req.body.role !== undefined) updates.role = req.body.role;
        updates.updated_at = new Date().toISOString();

        const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
        db.prepare(`UPDATE users SET ${setClauses} WHERE id = ?`).run(...Object.values(updates), req.params.id);

        res.json({ success: true, message: 'User updated.' });
    } catch (err) { next(err); }
});

// ─── CSV Exports ─────────────────────────────────────────────────────────────

router.get('/export/reservations', (req, res, next) => {
    try {
        const where = req.query.date ? 'date = ?' : '1=1';
        const params = req.query.date ? [req.query.date] : [];
        const rows = db.prepare(`SELECT * FROM reservations WHERE ${where} AND deleted_at IS NULL ORDER BY date, time_slot`).all(...params);
        const csv = generateReservationsCsv(rows);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="somaa-reservations-${Date.now()}.csv"`);
        res.send(csv);
    } catch (err) { next(err); }
});

router.get('/export/party-bookings', (req, res, next) => {
    try {
        const rows = db.prepare('SELECT * FROM party_bookings WHERE deleted_at IS NULL ORDER BY created_at DESC').all();
        const csv = generatePartyBookingsCsv(rows);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="somaa-party-bookings-${Date.now()}.csv"`);
        res.send(csv);
    } catch (err) { next(err); }
});

router.get('/export/inquiries', (req, res, next) => {
    try {
        const rows = db.prepare('SELECT * FROM inquiries ORDER BY created_at DESC').all();
        const csv = generateInquiriesCsv(rows);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="somaa-inquiries-${Date.now()}.csv"`);
        res.send(csv);
    } catch (err) { next(err); }
});

module.exports = router;
