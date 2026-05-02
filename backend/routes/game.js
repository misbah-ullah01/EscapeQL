// backend/routes/game.js
// All game mechanics: room status, unlock attempts, fragments

const express = require('express');
const router  = express.Router();
const { prisonerPool, wardenPool } = require('../db');

// Middleware: require login for all game routes
const requireLogin = (req, res, next) => {
    if (!req.session.playerId) {
        return res.status(401).json({ error: 'You must be logged in to play.' });
    }
    next();
};

router.use(requireLogin);

// GET /api/game/status
// Returns full player progress: which rooms are complete, current room, fragments
router.get('/status', async (req, res) => {
    const playerId = req.session.playerId;

    try {
        // Get player info
        const playerResult = await wardenPool.query(
            `SELECT player_id, username, current_room, created_at, completed_at
             FROM warden.players WHERE player_id = $1`,
            [playerId]
        );

        // Get completed rooms
        const roomsResult = await wardenPool.query(
            `SELECT room_name, solved_at, attempts, time_taken
             FROM warden.room_log
             WHERE player_id = $1
             ORDER BY solved_at`,
            [playerId]
        );

        // Get attempt counts per room
        const attemptsResult = await wardenPool.query(
            `SELECT room_name, COUNT(*) as total, SUM(CASE WHEN correct THEN 1 ELSE 0 END) as correct_count
             FROM warden.attempt_log
             WHERE player_id = $1
             GROUP BY room_name`,
            [playerId]
        );

        const player = playerResult.rows[0];
        const completedRooms = roomsResult.rows.map(r => r.room_name);

        // Build room status array
        const allRooms = ['lobby', 'corridor', 'vault', 'server_room', 'escape'];
        const roomStatus = allRooms.map(room => ({
            name: room,
            completed: completedRooms.includes(room),
            unlocked: isRoomUnlocked(room, completedRooms),
            completedAt: roomsResult.rows.find(r => r.room_name === room)?.solved_at || null,
            attempts: attemptsResult.rows.find(r => r.room_name === room)?.total || 0
        }));

        res.json({
            player: {
                id: player.player_id,
                username: player.username,
                currentRoom: player.current_room,
                startedAt: player.created_at,
                completedAt: player.completed_at,
                escaped: player.completed_at !== null
            },
            rooms: roomStatus
        });

    } catch (err) {
        console.error('Status error:', err.message);
        res.status(500).json({ error: 'Could not fetch status' });
    }
});

// Helper: determine if a room is unlocked based on completions
function isRoomUnlocked(room, completedRooms) {
    const order = ['lobby', 'corridor', 'vault', 'server_room', 'escape'];
    const idx = order.indexOf(room);
    if (idx === 0) return true;  // lobby always unlocked
    return completedRooms.includes(order[idx - 1]);
}

// POST /api/game/unlock
// Submit an answer for a room
// Body: { room: 'lobby', answer: 'MARCUS_VOID_KNOWS' }
router.post('/unlock', async (req, res) => {
    const { room, answer } = req.body;
    const playerId = req.session.playerId;
    const normalizedRoom = (room || '').toString().trim().toLowerCase();
    const normalizedAnswer = (answer || '').toString().trim().toUpperCase();

    if (!normalizedRoom || !normalizedAnswer) {
        return res.status(400).json({ error: 'room and answer are required' });
    }

    const validRooms = ['lobby', 'corridor', 'vault', 'server_room'];
    if (!validRooms.includes(normalizedRoom)) {
        return res.status(400).json({ error: 'Invalid room name' });
    }

    try {
        let result;
        // Each room has its own unlock function
        // vault needs special transaction handling
        if (normalizedRoom === 'vault') {
            // Simulate the transaction requirement for vault
            const client = await prisonerPool.connect();
            try {
                await client.query('BEGIN');
                await client.query("SELECT set_config('vault.transaction_ready', 'yes', TRUE)");
                result = await client.query(
                    'SELECT vault.attempt_unlock($1, $2) AS result',
                    [playerId, normalizedAnswer]
                );
                await client.query('COMMIT');
            } catch (e) {
                await client.query('ROLLBACK');
                throw e;
            } finally {
                client.release();
            }
        } else if (normalizedRoom === 'server_room') {
            result = await prisonerPool.query(
                'SELECT server_room.attempt_unlock($1) AS result',
                [playerId]
            );
        } else {
            result = await prisonerPool.query(
                `SELECT ${normalizedRoom}.attempt_unlock($1, $2) AS result`,
                [playerId, normalizedAnswer]
            );
        }

        res.json(result.rows[0].result);

    } catch (err) {
        console.error('Unlock error:', err.message);
        res.status(500).json({ error: 'Unlock attempt failed: ' + err.message });
    }
});

// POST /api/game/escape
// Final room: submit assembled key
// Body: { key: 'ALPHA-BRAVO-CHARLIE-DELTA' }
router.post('/escape', async (req, res) => {
    const { key } = req.body;
    const playerId = req.session.playerId;

    if (!key) return res.status(400).json({ error: 'key is required' });

    try {
        const result = await prisonerPool.query(
            'SELECT escape.complete_game($1, $2) AS result',
            [playerId, key]
        );
        res.json(result.rows[0].result);
    } catch (err) {
        res.status(500).json({ error: 'Escape attempt failed: ' + err.message });
    }
});

// GET /api/game/leaderboard
// Top 10 completions
router.get('/leaderboard', async (req, res) => {
    try {
        const result = await wardenPool.query(`
            SELECT
                p.username,
                p.completed_at - p.created_at AS total_time,
                p.completed_at,
                COUNT(rl.log_id) AS rooms_completed,
                (SELECT COUNT(*) FROM warden.attempt_log al
                 WHERE al.player_id = p.player_id AND al.correct = FALSE) AS wrong_attempts
            FROM warden.players p
            LEFT JOIN warden.room_log rl ON rl.player_id = p.player_id
            WHERE p.completed_at IS NOT NULL
            GROUP BY p.player_id, p.username, p.completed_at, p.created_at
            ORDER BY total_time ASC
            LIMIT 10
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Could not fetch leaderboard' });
    }
});

// POST /api/game/busted
// Resets player progress after 7 failed attempts
router.post('/busted', async (req, res) => {
    const playerId = req.session.playerId;
    const client = await wardenPool.connect();
    try {
        await client.query('BEGIN');
        // Reset room and completetion
        await client.query(`UPDATE warden.players SET current_room = 'Lobby', completed_at = NULL WHERE player_id = $1`, [playerId]);
        // Remove completion logs
        await client.query(`DELETE FROM warden.room_log WHERE player_id = $1`, [playerId]);
        // Remove attempt logs
        await client.query(`DELETE FROM warden.attempt_log WHERE player_id = $1`, [playerId]);
        await client.query('COMMIT');
        res.json({ success: true, message: 'Player busted and reset.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Busted reset error:', err.message);
        res.status(500).json({ error: 'Failed to reset busted player' });
    } finally {
        client.release();
    }
});

module.exports = router;