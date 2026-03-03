'use strict';

const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs = require('fs');

const LOG_DIR = path.join(__dirname, '..', '..', 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.errors({ stack: true }),
        format.json()
    ),
    transports: [
        new transports.File({
            filename: path.join(LOG_DIR, 'error.log'),
            level: 'error',
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
        }),
        new transports.File({
            filename: path.join(LOG_DIR, 'combined.log'),
            maxsize: 10 * 1024 * 1024,
            maxFiles: 10,
        }),
    ],
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new transports.Console({
        format: format.combine(
            format.colorize(),
            format.printf(({ timestamp, level, message, stack }) =>
                `${timestamp} [${level}]: ${stack || message}`
            )
        ),
    }));
}

module.exports = logger;
