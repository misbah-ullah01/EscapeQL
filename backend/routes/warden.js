const express = require('express');
const router = express.Router();
const { wardenPool } = require('../db');

// Basic auth check for warden routes
const requireWarden = (req, res, next) => {
    if (req.session.isWarden) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized. Warden access only.' });
    }
};

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    // Authenticate with .env credentials
    const u = (username || '').trim().toLowerCase();
    const p = (password || '').trim();
    if (u === process.env.DB_WARDEN_USER.toLowerCase() && p === process.env.DB_WARDEN_PASSWORD) {
        req.session.isWarden = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

router.post('/logout', requireWarden, (req, res) => {
    req.session.isWarden = false;
    res.json({ success: true });
});

router.get('/status', requireWarden, (req, res) => {
    res.json({ status: 'optimal' });
});

router.get('/prisoners', requireWarden, async (req, res) => {
    try {
        const result = await wardenPool.query(`
            SELECT p.username, p.current_room, 
                   (SELECT COUNT(*) FROM warden.attempt_log a WHERE a.player_id = p.player_id) as attempts,
                   (SELECT array_agg(rl.room_name) FROM warden.room_log rl WHERE rl.player_id = p.player_id) as keys_collected
            FROM warden.players p
            ORDER BY p.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch prisoners' });
    }
});

router.post('/reset-prisoner', requireWarden, async (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'username required' });
    
    const client = await wardenPool.connect();
    try {
        await client.query('BEGIN');
        const pRes = await client.query('SELECT player_id FROM warden.players WHERE username = $1', [username]);
        if (pRes.rowCount === 0) throw new Error('Prisoner not found');
        const playerId = pRes.rows[0].player_id;
        
        await client.query(`UPDATE warden.players SET current_room = 'Lobby', completed_at = NULL WHERE player_id = $1`, [playerId]);
        await client.query(`DELETE FROM warden.room_log WHERE player_id = $1`, [playerId]);
        await client.query(`DELETE FROM warden.attempt_log WHERE player_id = $1`, [playerId]);
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Failed to reset prisoner' });
    } finally {
        client.release();
    }
});

router.post('/reset-all', requireWarden, async (req, res) => {
    const client = await wardenPool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`UPDATE warden.players SET current_room = 'Lobby', completed_at = NULL`);
        await client.query(`DELETE FROM warden.room_log`);
        await client.query(`DELETE FROM warden.attempt_log`);
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Failed to reset all prisoners' });
    } finally {
        client.release();
    }
});

module.exports = router;
