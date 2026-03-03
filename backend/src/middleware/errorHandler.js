'use strict';

const logger = require('../config/logger');

// Global error handler — must have 4 params for Express to treat as error middleware
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    const message = status < 500 ? err.message : 'An unexpected error occurred. Please try again.';

    logger.error('Unhandled error', {
        status,
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        ip: req.ip,
    });

    return res.status(status).json({
        success: false,
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
};

// Catch-all 404 for unmatched routes
const notFound = (req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.path} not found.`,
    });
};

module.exports = { errorHandler, notFound };
