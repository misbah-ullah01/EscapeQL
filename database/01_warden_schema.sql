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



