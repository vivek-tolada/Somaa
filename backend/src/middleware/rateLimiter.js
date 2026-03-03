'use strict';

const rateLimit = require('express-rate-limit');

const createLimiter = (max, windowMinutes, message) =>
    rateLimit({
        windowMs: windowMinutes * 60 * 1000,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, message },
        skip: () => process.env.NODE_ENV === 'test',
    });

/** Tight limit for public form submission endpoints */
const publicFormLimiter = createLimiter(
    parseInt(process.env.RATE_LIMIT_PUBLIC || '10'),
    1,
    'Too many requests from this IP. Please wait a minute and try again.'
);

/** Moderate limit for admin API endpoints */
const adminLimiter = createLimiter(
    parseInt(process.env.RATE_LIMIT_ADMIN || '120'),
    1,
    'Too many requests. Slow down.'
);

/** Very tight limit for auth attempts */
const authLimiter = createLimiter(
    5,
    15,
    'Too many login attempts. Please try again in 15 minutes.'
);

module.exports = { publicFormLimiter, adminLimiter, authLimiter };
