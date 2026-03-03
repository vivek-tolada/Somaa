'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

const DB_DIR = path.join(__dirname, '..', '..', 'data');
const DB_PATH = path.join(DB_DIR, 'somaa.db');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH, {
    verbose: process.env.NODE_ENV === 'development' ? console.log : null,
});

// Performance pragmas
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

// ─── Schema ──────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role        TEXT NOT NULL CHECK(role IN ('superadmin','manager')) DEFAULT 'manager',
    is_active   INTEGER NOT NULL DEFAULT 1,
    last_login  TEXT,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE IF NOT EXISTS reservations (
    id               TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    phone            TEXT NOT NULL,
    email            TEXT,
    date             TEXT NOT NULL,
    time_slot        TEXT NOT NULL,
    guests           INTEGER NOT NULL DEFAULT 1,
    special_requests TEXT,
    status           TEXT NOT NULL CHECK(status IN ('pending','confirmed','cancelled','completed')) DEFAULT 'pending',
    notes            TEXT,
    notified         INTEGER NOT NULL DEFAULT 0,
    created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    deleted_at       TEXT
  );

  CREATE TABLE IF NOT EXISTS party_bookings (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    phone        TEXT NOT NULL,
    email        TEXT,
    event_type   TEXT NOT NULL CHECK(event_type IN ('birthday','corporate','social','other')) DEFAULT 'other',
    preferred_date TEXT NOT NULL,
    guest_count  INTEGER NOT NULL DEFAULT 1,
    notes        TEXT,
    status       TEXT NOT NULL CHECK(status IN ('new','contacted','quoted','confirmed','closed')) DEFAULT 'new',
    priority     TEXT NOT NULL DEFAULT 'high',
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    deleted_at   TEXT
  );

  CREATE TABLE IF NOT EXISTS inquiries (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    phone      TEXT,
    message    TEXT NOT NULL,
    source     TEXT NOT NULL DEFAULT 'website',
    ip_address TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE IF NOT EXISTS system_logs (
    id          TEXT PRIMARY KEY,
    admin_id    TEXT,
    action      TEXT NOT NULL,
    entity_type TEXT,
    entity_id   TEXT,
    details     TEXT,
    ip_address  TEXT,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    FOREIGN KEY (admin_id) REFERENCES users(id)
  );

  -- Indexes
  CREATE INDEX IF NOT EXISTS idx_reservations_date   ON reservations(date);
  CREATE INDEX IF NOT EXISTS idx_reservations_phone  ON reservations(phone);
  CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
  CREATE INDEX IF NOT EXISTS idx_reservations_deleted ON reservations(deleted_at);

  CREATE INDEX IF NOT EXISTS idx_party_date    ON party_bookings(preferred_date);
  CREATE INDEX IF NOT EXISTS idx_party_phone   ON party_bookings(phone);
  CREATE INDEX IF NOT EXISTS idx_party_status  ON party_bookings(status);
  CREATE INDEX IF NOT EXISTS idx_party_deleted ON party_bookings(deleted_at);

  CREATE INDEX IF NOT EXISTS idx_inquiries_created ON inquiries(created_at);
  CREATE INDEX IF NOT EXISTS idx_logs_admin ON system_logs(admin_id);
  CREATE INDEX IF NOT EXISTS idx_logs_created ON system_logs(created_at);
`);

// ─── Prepared statements (shared) ────────────────────────────────────────────

db.getReservationsByDate = db.prepare(
    `SELECT * FROM reservations WHERE date = ? AND deleted_at IS NULL`
);

db.getActiveGuestsOnSlot = db.prepare(
    `SELECT COALESCE(SUM(guests), 0) as total FROM reservations
   WHERE date = ? AND time_slot = ? AND status NOT IN ('cancelled','completed')
   AND deleted_at IS NULL`
);

module.exports = db;
