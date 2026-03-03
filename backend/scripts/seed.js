#!/usr/bin/env node
'use strict';

/**
 * Seed script — creates the initial superadmin user.
 * Usage:  node scripts/seed.js
 *
 * Override defaults with env vars:
 *   SEED_ADMIN_NAME=YourName SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASS=strong_pass node scripts/seed.js
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../src/config/database');

const name = process.env.SEED_ADMIN_NAME || 'SOMAA Admin';
const email = process.env.SEED_ADMIN_EMAIL || 'admin@somaa.in';
const pass = process.env.SEED_ADMIN_PASS || 'Somaa@2026!';

(async () => {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
        console.log(`✓ Admin already exists: ${email}`);
        process.exit(0);
    }

    const hash = await bcrypt.hash(pass, 12);
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(
        'INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at) VALUES (?,?,?,?,?,?,?)'
    ).run(id, name, email, hash, 'superadmin', now, now);

    console.log('\n🎉  Superadmin created successfully!');
    console.log(`    Email   : ${email}`);
    console.log(`    Password: ${pass}`);
    console.log('\n⚠️   Change the default password after first login!\n');
    process.exit(0);
})().catch(err => {
    console.error('Seed failed:', err.message);
    process.exit(1);
});
