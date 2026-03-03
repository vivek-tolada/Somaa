'use strict';

const jwt = require('jsonwebtoken');
const db = require('../config/database');
const logger = require('../config/logger');

/**
 * Verifies JWT from Authorization header (Bearer token).
 * Attaches decoded user to req.user.
 */
const authenticate = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const token = authHeader.slice(7);
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // Fetch fresh user to catch deactivated accounts
        const user = db.prepare('SELECT id, name, email, role, is_active FROM users WHERE id = ?').get(decoded.id);
        if (!user || !user.is_active) {
            return res.status(401).json({ success: false, message: 'Account not found or inactive.' });
        }
        req.user = user;
        next();
    } catch (err) {
        logger.warn('JWT verification failed', { error: err.message, ip: req.ip });
        return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
    }
};

/**
 * Restricts access to superadmin role only.
 * Must be chained after `authenticate`.
 */
const requireSuperAdmin = (req, res, next) => {
    if (req.user?.role !== 'superadmin') {
        return res.status(403).json({ success: false, message: 'Superadmin access required.' });
    }
    next();
};

module.exports = { authenticate, requireSuperAdmin };
