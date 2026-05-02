-- Create the warden schema (hidden admin area)
CREATE SCHEMA warden;

-- Security: Only warden role can access this schema
REVOKE ALL ON SCHEMA warden FROM PUBLIC;
GRANT ALL ON SCHEMA warden TO warden;

-- ===================================================

-- Stores every player account
CREATE TABLE warden.players (
	player_id 		SERIAL PRIMARY KEY,
	username 		VARCHAR(50) UNIQUE NOT NULL,
	created_at 		TIMESTAMPTZ DEFAULT NOW(),
	completed_at 	TIMESTAMPTZ,
	current_room 	VARCHAR(50) DEFAULT 'lobby',
	is_active 		BOOLEAN DEFAULT TRUE
);

-- ===================================================

-- Audit trail: every room completion is recorded here
CREATE TABLE warden.room_log(
	log_id 		SERIAL PRIMARY KEY,
	player_id 	INT NOT NULL REFERENCES warden.players(player_id),
	room_name 	VARCHAR(50) NOT NULL,
	solved_at 	TIMESTAMPTZ DEFAULT NOW(),
	attempts 	INT DEFAULT 1,
	time_taken 	INTERVAL
);

-- ===================================================

-- Stores hashed answers for each room
CREATE TABLE warden.answers (
	room_name 				VARCHAR(50) PRIMARY KEY,
	answer_hash 			TEXT NOT NULL,
	unlock_target 			VARCHAR(50) NOT NULL,
	key_fragment 			VARCHAR(100) NOT NULL
);

-- ===================================================

-- Records every unlock attempt (correct or wrong)
CREATE TABLE warden.attempt_log (
	id 				SERIAL PRIMARY KEY,
	player_id 		INT REFERENCES warden.players(player_id),
	room_name 		VARCHAR(50),
	submitted 		TEXT,
	correct 		BOOLEAN,
	attempted_at 	TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================================

INSERT INTO warden.answers (room_name, answer_hash, unlock_target, key_fragment)
VALUES
    ('lobby',        encode(digest('MARCUS_VOID_KNOWS', 'sha256'), 'hex'), 'corridor',    'ALPHA'),
    ('corridor',     encode(digest('DOOR_SEVEN_FOUND', 'sha256'), 'hex'),  'vault',       'BRAVO'),
    ('vault',        encode(digest('4471-DELTA', 'sha256'), 'hex'),        'server_room', 'CHARLIE'),
    ('server_room',  encode(digest('HATCH_UNLOCKED', 'sha256'), 'hex'),   'escape',      'DELTA')
ON CONFLICT (room_name) DO NOTHING;

-- ===================================================

-- Give warden permissions on everything created in this schema

GRANT ALL ON ALL TABLES IN SCHEMA warden TO warden;
GRANT ALL ON ALL SEQUENCES IN SCHEMA warden TO warden;

-- ===================================================

-- Optional presentation helper view for quick status checks
CREATE OR REPLACE VIEW warden.player_progress AS
SELECT
    p.username,
    p.current_room,
    (p.completed_at IS NOT NULL) AS has_escaped,
    COUNT(rl.log_id) AS rooms_completed
FROM warden.players p
LEFT JOIN warden.room_log rl ON rl.player_id = p.player_id
GROUP BY p.player_id, p.username, p.current_room, p.completed_at;