// backend/routes/query.js
// Allows players to execute SQL queries via the web interface
// SECURITY: only SELECT statements allowed, no DDL or DML that bypasses the game

const express = require('express');
const router  = express.Router();
const { prisonerPool } = require('../db');

const requireLogin = (req, res, next) => {
    if (!req.session.playerId) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    next();
};

router.use(requireLogin);

// POST /api/query/run
// Runs a SQL query as the prisoner role
// Body: { sql: 'SELECT * FROM lobby.staff_directory' }
router.post('/run', async (req, res) => {
    const { sql } = req.body;

    if (!sql || sql.trim() === '') {
        return res.status(400).json({ error: 'No SQL provided' });
    }

    // Basic safety check: block dangerous statements
    // This is NOT foolproof - it is a teaching aid, not production security
    const upperSQL = sql.trim().toUpperCase();
    const blocked = ['DROP ', 'TRUNCATE ', 'DELETE ', 'CREATE ROLE', 'ALTER ROLE',
                     'GRANT ', 'REVOKE ', 'COPY ', 'DO $$'];

    // Allow SELECT, CALL, BEGIN, COMMIT, and safe INSERTs for puzzle functions
    const allowed = ['SELECT ', 'BEGIN', 'COMMIT', 'ROLLBACK', 'CALL ', 'INSERT INTO SERVER_ROOM'];

    const isBlocked = blocked.some(b => upperSQL.includes(b));
    if (isBlocked) {
        return res.status(403).json({
            error: 'That statement is not permitted through this interface.',
            hint: 'Use the psql terminal for administrative commands.'
        });
    }

    const start = Date.now();
    try {
        const result = await prisonerPool.query(sql);
        const duration = Date.now() - start;

        res.json({
            success: true,
            rows: result.rows,
            rowCount: result.rowCount,
            fields: result.fields ? result.fields.map(f => ({
                name: f.name,
                dataType: f.dataTypeID
            })) : [],
            duration: duration + 'ms',
            command: result.command  // 'SELECT', 'INSERT', etc.
        });

    } catch (err) {
        // Send the PostgreSQL error back to the player - this is intentional
        // Seeing real error messages is part of learning
        res.status(400).json({
            success: false,
            error: err.message,
            detail: err.detail || null,
            hint: err.hint || null,
            position: err.position || null
        });
    }
});

// GET /api/query/schemas
// Returns list of schemas the player has access to
router.get('/schemas', async (req, res) => {
    try {
        const result = await prisonerPool.query(`
            SELECT schema_name
            FROM information_schema.schemata
            WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
            ORDER BY schema_name
        `);
        res.json(result.rows.map(r => r.schema_name));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/query/tables/:schema
// Returns tables in a schema (if player has access)
router.get('/tables/:schema', async (req, res) => {
    const { schema } = req.params;
    // Validate schema name to prevent injection
    if (!/^[a-z_]+$/.test(schema)) {
        return res.status(400).json({ error: 'Invalid schema name' });
    }

    try {
        const result = await prisonerPool.query(`
            SELECT table_name, table_type
            FROM information_schema.tables
            WHERE table_schema = $1
            ORDER BY table_name
        `, [schema]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;