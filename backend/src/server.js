'use strict';

require('dotenv').config();
const app = require('./app');
const logger = require('./config/logger');

const PORT = parseInt(process.env.PORT || '5000');
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
    logger.info(`SOMAA API server running on http://${HOST}:${PORT}`, {
        env: process.env.NODE_ENV || 'development',
        port: PORT,
    });
    console.log(`\n  🍽️  SOMAA Backend API`);
    console.log(`  📡  http://localhost:${PORT}`);
    console.log(`  🩺  http://localhost:${PORT}/health\n`);
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
const shutdown = (signal) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });

    // Force exit after 10s
    setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Promise Rejection', { reason });
});

process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception — shutting down', { error: err.message, stack: err.stack });
    process.exit(1);
});

module.exports = server;
