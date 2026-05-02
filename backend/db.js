// backend/db.js
// This module creates and exports two database connection pools:
// one for the prisoner role, one for the warden role

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Pool = a collection of reusable database connections
// Instead of opening a new connection for every request (slow),
// we maintain a pool of connections that stay open

// Prisoner pool: limited privileges, used for player actions
const prisonerPool = new Pool({
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 10,          // maximum 10 connections in pool
    idleTimeoutMillis: 30000,  // close idle connections after 30s
    connectionTimeoutMillis: 2000,  // fail if connection takes > 2s
});

// Warden pool: full privileges, used for admin/evaluator actions
const wardenPool = new Pool({
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user:     process.env.DB_WARDEN_USER,
    password: process.env.DB_WARDEN_PASSWORD,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Test connections on startup
prisonerPool.connect((err, client, release) => {
    if (err) {
        console.error('Failed to connect prisoner pool:', err.message);
    } else {
        console.log('Prisoner pool connected to PostgreSQL');
        release(); // always release the client back to pool
    }
});

wardenPool.connect((err, client, release) => {
    if (err) {
        console.error('Failed to connect warden pool:', err.message);
    } else {
        console.log('Warden pool connected to PostgreSQL');
        release();
    }
});

module.exports = { prisonerPool, wardenPool };
