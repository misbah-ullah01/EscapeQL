-- We use different Schemas as different "rooms" in the EscapeQL game
-- A schema is like a Folder inside a database
-- 'warden' schema is the hidden admin/control area

CREATE SCHEMA IF NOT EXISTS warden;

-- Security: Only warden role can access this schema
REVOKE ALL ON SCHEMA warden FROM PUBLIC;
GRANT ALL ON SCHEMA warden TO warden;

-- ===================================================

CREATE TABLE IF NOT EXISTS warden.players (
	player_id 		SERIAL PRIMARY KEY,
	username 		VARCHAR(50) UNIQUE NOT NULL,
	created_at 		TIMESTAMPTZ DEFAULT NOW(),		-- TIMESTAMP TZ is timestamp with timezone
	completed_at 	TIMESTAMPTZ,					-- NULL unitl they successfully escape
	current_room 	VARCHAR(50) DEFAULT 'lobby',
	is_active 		BOOLEAN DEFAULT TRUE
);

-- ===================================================

CREATE TABLE IF NOT EXISTS warden.room_log(
	log_id 		SERIAL PRIMARY KEY,
	player_id 	INT NOT NULL REFERENCES warden.players(player_id),	--Foerign Key
	room_name 	VARCHAR(50) NOT NULL,
	solved_at 	TIMESTAMPTZ DEFAULT NOW(),
	attempts 	INT DEFAULT 1,
	time_taken 	INTERVAL		-- Example: '00:12:23' (Hours:minute:seconds)
);

-- ===================================================

CREATE TABLE IF NOT EXISTS warden.answers (
	room_name 				VARCHAR(50) PRIMARY KEY,
	answer_hash 			TEXT NOT NULL,			-- SHA-256 hash of the real answer
	unlock_target 			VARCHAR(50) NOT NULL,	-- which schema/room to unclock on success
	key_fragments 			VARCHAR(50) NOT NULL	-- Piece of the final escape key
);

-- ===================================================

CREATE TABLE IF EXISTS warden.attempt_log (
	id 				SERIAL PRIMARY KEY,
	player_id 		INT REFERENCES warden.players(player_id),
	room_name 		VARCHAR(50),
	submitted 		TEXT,			-- What players actually typed
	correct 		BOOLEAN,
	attempted_at 	TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================================

INSERT INTO warden.answers (room_name, answer_hash, unlock_target, key_fragments)
VALUES
	('lobby',
	encode(digest('MARCUS_VOID_KNOWS', 'sha256'), 'hex'),
	'corridor',
	'ALPHA'),

	('corridor',
	encode(digest('DOOR_SEVEN_FOUND', 'sha256'), 'hex'),
	'vault',
	'BRAVO'),

	('vault',
	encode(digest('4471-DELTA', 'sha256'), 'hex'),
	'server_room',
	'CHARLIE'),

	('server_room',
	encode(digest('HATCH_UNLOCKED', 'sha256'), 'hex'),
	'escape',
	'DELTA')
ON CONFLICT (room_name) DO NOTHING;

-- ===================================================

-- Now to give warden full permission on everything we created

GRANT ALL ON ALL TABLES IN SCHEMA warden TO warden;
GRANT ALL ON ALL SEQUENCES IN SCHEMA warden TO warden;

-- ===================================================

CREATE OR REPLACE VIEW warden.player_progress AS 
SELECT
	p.username,
	p.current_room,
	(p.completed_at IS NOT NULL) AS has_escaped,
	COUNT(rl.log_id) AS rooms_completed
FROM warden.players p
LEFT JOIN warden.room_log rl ON rl.player_id = p.player_id
GROUP BY p.player_id, p.username, p.current_room, p.completed_at;

-- ===================================================