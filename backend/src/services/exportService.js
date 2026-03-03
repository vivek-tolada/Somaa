'use strict';

const { Parser } = require('json2csv');
const logger = require('../config/logger');

/**
 * Generate a CSV buffer from an array of objects.
 * @param {Object[]} rows
 * @param {string[]} fields
 * @returns {string} CSV string
 */
const generateCsv = (rows, fields) => {
    if (!rows || rows.length === 0) {
        return fields.join(',') + '\n';
    }
    try {
        const parser = new Parser({ fields, withBOM: true });
        return parser.parse(rows);
    } catch (err) {
        logger.error('CSV generation failed', { error: err.message });
        throw new Error('Failed to generate CSV export.');
    }
};

// Fields for each export type
const RESERVATION_FIELDS = [
    'id', 'name', 'phone', 'email', 'date', 'time_slot', 'guests',
    'special_requests', 'status', 'notes', 'created_at', 'updated_at',
];

const PARTY_FIELDS = [
    'id', 'name', 'phone', 'email', 'event_type', 'preferred_date',
    'guest_count', 'notes', 'status', 'priority', 'created_at', 'updated_at',
];

const INQUIRY_FIELDS = [
    'id', 'name', 'phone', 'message', 'source', 'created_at',
];

module.exports = {
    generateReservationsCsv: (rows) => generateCsv(rows, RESERVATION_FIELDS),
    generatePartyBookingsCsv: (rows) => generateCsv(rows, PARTY_FIELDS),
    generateInquiriesCsv: (rows) => generateCsv(rows, INQUIRY_FIELDS),
};
