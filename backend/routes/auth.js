// backend/routes/auth.js
// Handles player registration and login

const express = require('express');
const router  = express.Router();
const { prisonerPool, wardenPool } = require('../db');

// POST /api/auth/register
// Creates a new player account
// Body: { username: "playerName" }
router.post('/register', async (req, res) => {
    const { username } = req.body;

    // Basic validation
    if (!username || username.length < 3 || username.length > 50) {
        return res.status(400).json({
            error: 'Username must be between 3 and 50 characters'
        });
    }

    // Only allow letters, numbers, underscores (prevent SQL injection via username)
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({
            error: 'Username can only contain letters, numbers, and underscores'
        });
    }

    try {
        // Call the warden function to register the player
        // We use parameterized queries ($1) to prevent SQL injection
        const result = await wardenPool.query(
            'SELECT warden.register_player($1) AS player',
            [username]
        );

        const player = result.rows[0].player;

        // Store player info in session
        req.session.playerId = player.player_id;
        req.session.username = player.username;

        res.json({
            success: true,
            player_id: player.player_id,
            username: player.username,
            message: 'Welcome, Prisoner.'
        });

    } catch (err) {
        // Check if username already exists
        if (err.code === '23505') { // unique_violation PostgreSQL error code
            return res.status(409).json({ error: 'Username already taken' });
        }
        console.error('Register error:', err.message);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// POST /api/auth/login
// Logs in an existing player
router.post('/login', async (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ error: 'Username required' });
    }

    try {
        const result = await wardenPool.query(
            'SELECT player_id, username, current_room, completed_at FROM warden.players WHERE username = $1 AND is_active = TRUE',
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Player not found. Register first.' });
        }

        const player = result.rows[0];
        req.session.playerId = player.player_id;
        req.session.username = player.username;

        res.json({
            success: true,
            player_id: player.player_id,
            username: player.username,
            current_room: player.current_room,
            completed: player.completed_at !== null
        });

    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ error: 'Login failed' });
    }
});

// GET /api/auth/me
// Returns current session player info
router.get('/me', async (req, res) => {
    if (!req.session.playerId) {
        return res.status(401).json({ error: 'Not logged in' });
    }

    try {
        const result = await wardenPool.query(
            'SELECT warden.get_my_status($1) AS status',
            [req.session.playerId]
        );
        res.json(result.rows[0].status);
    } catch (err) {
        res.status(500).json({ error: 'Could not fetch status' });
    }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true, message: 'Session ended.' });
    });
});

module.exports = router;