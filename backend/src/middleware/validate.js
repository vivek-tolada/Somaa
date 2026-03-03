'use strict';

const { validationResult } = require('express-validator');

/**
 * Runs after express-validator rules in a route handler.
 * Returns structured 422 response if any validation errors exist.
 */
const handleValidation = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({
            success: false,
            message: 'Validation failed.',
            errors: errors.array().map(e => ({ field: e.path, message: e.msg })),
        });
    }
    next();
};

module.exports = { handleValidation };
