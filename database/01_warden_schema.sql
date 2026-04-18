-- We use different Schemas as different "rooms" in the EscapeQL game
-- A schema is like a Folder inside a database
-- 'warden' schema is the hidden admin/control area

CREATE SCHEMA IF NOT EXISTS warden;

-- Security: Only warden role can access this schema
REVOKE ALL ON SCHEMA warden FROM PUBLIC;
GRANT ALL ON SCHEMA warden TO warden;

CREATE TABLE IF NOT EXISTS warden.players (
	player_id 		SERIAL PRIMARY KEY,
	username 		VARCHAR(50) UNIQUE NOT NULL,
	created_at 		TIMESTAMPTZ DEFAULT NOW(),
	completed_at 	TIMESTAMPTZ,
	current_room 	VARCHAR(50) DEFAULT 'lobby',
	is_active 		BOOLEAN DEFAULT TRUE
);

