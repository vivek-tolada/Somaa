'use strict';

const db = require('../config/database');
const logger = require('../config/logger');

// ─── Configurable capacity ────────────────────────────────────────────────────
const MAX_CAPACITY = parseInt(process.env.MAX_CAPACITY || '120');          // total restaurant capacity
const MAX_GUESTS_PER_SLOT = parseInt(process.env.MAX_GUESTS_PER_SLOT || '80'); // per time slot

// Valid time slots (every 30 min, 11:30 AM – 11:00 PM last booking)
const VALID_SLOTS = (() => {
    const slots = [];
    for (let h = 11; h <= 22; h++) {
        slots.push(`${String(h).padStart(2, '0')}:00`);
        if (h < 23) slots.push(`${String(h).padStart(2, '0')}:30`);
    }
    // Start from 11:30
    return slots.filter(s => s >= '11:30');
})();

/**
 * Check if a slot is valid
 */
const isValidSlot = (slot) => VALID_SLOTS.includes(slot);

/**
 * Check remaining capacity for a date/slot.
 * Returns { available: boolean, remaining: number }
 */
const checkCapacity = (date, timeSlot, requestedGuests) => {
    const { total } = db.getActiveGuestsOnSlot.get(date, timeSlot);
    const remaining = MAX_GUESTS_PER_SLOT - total;
    return {
        available: remaining >= requestedGuests,
        remaining,
        booked: total,
        capacity: MAX_GUESTS_PER_SLOT,
    };
};

/**
 * Get all reservations summary for a date
 */
const getDailyOccupancy = (date) => {
    const rows = db.prepare(`
    SELECT time_slot,
           COUNT(*) as bookings,
           SUM(guests) as total_guests
    FROM reservations
    WHERE date = ? AND status NOT IN ('cancelled') AND deleted_at IS NULL
    GROUP BY time_slot
    ORDER BY time_slot
  `).all(date);

    return {
        date,
        slots: rows,
        totalGuests: rows.reduce((sum, r) => sum + (r.total_guests || 0), 0),
    };
};

/**
 * Get available slots for a date given a guest count
 */
const getAvailableSlots = (date, guestCount = 1) => {
    return VALID_SLOTS.map(slot => {
        const cap = checkCapacity(date, slot, guestCount);
        return { slot, ...cap };
    });
};

module.exports = {
    isValidSlot,
    checkCapacity,
    getDailyOccupancy,
    getAvailableSlots,
    VALID_SLOTS,
    MAX_CAPACITY,
    MAX_GUESTS_PER_SLOT,
};
