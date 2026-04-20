-- File: database/02_lobby.sql

CREATE SCHEMA LOBBY;

-- =================================================

-- Give prisoner access to lobby immediately
GRANT USAGE ON SCHEMA lobby TO prisoner;
GRANT SELECT ON ALL TABLES IN SCHEMA lobby TO prisoner;

-- =================================================

--Table: lobby.staff_directory
-- The puzzle is hiding in the access_code colums

CREATE TABLE lobby.staff_directory (
	staff_id	SERIAL PRIMARY KEY,
	name 		VARCHAR(50) NOT NULL,
	department 	VARCHAR(50),
	access_code	VARCHAR(20),
	clue		TECT,
	active		BOOLEAN DEFAULT TRUE
);

-- =================================================

-- The column comment IS the first clue
-- Player can read it with: \d+ lobby.staff_directory
COMMENT ON COLUMN Lobby.staff_directory.access_code
	IS 'The one who left no trace knows the way.';

-- =================================================

-- Table: lobby.hint_borad
-- Contains the passphrase once you know who to look for

CREATE TABLE lobby.hint_board (
	hint_id		SERIAL PRIMARY KEY,
	staff_name	VARCHAR(100),
	message		TEXT,
	passphrase	VARCHAR(100)
);

-- =================================================
