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

INSERT INTO lobby.staff_directory (name, department, access_code, clue)
VALUES
	('Alice Chen',      'Engineering',  'AC-1042', 'Keep moving.'),
    ('Bob Rahman',      'Security',     'BR-2891', 'Wrong door.'),
    ('Carol Patel',     'HR',           'CP-3301', 'Not here.'),
    ('David Kim',       'Finance',      'DK-4412', 'Try again.'),
    ('Emma Torres',     'Legal',        'ET-5523', 'Cold.'),
    ('Frank Osei',      'Operations',   'FO-6634', 'Warmer?'),
    ('Grace Liu',       'IT',           'GL-7745', 'Not quite.'),
    ('Henry Mwangi',    'Facilities',   'HM-8856', 'Almost.'),
    ('Iris Johansson',  'Marketing',    'IJ-9967', 'Look harder.'),
    ('James Nakamura',  'Research',     'JN-1078', 'You are close.'),
    ('Karen Okafor',    'Procurement',  'KO-2189', 'One more.'),
    ('Marcus Void',     'Unknown',      NULL,       'I was never really here.');

-- =================================================

-- Hint board: only Marcus Void's row matters

INSERT INTO lobby.hint_board (staff_name, message, passphrase)
VALUES
	('Marcus Void', 'You Found me. The corridor opens with the word below.', 
	 'MARCUS_VOID_KNOWS');

-- =================================================
-- Function for lobby attep on unlock by player

CREATE OR REPLACE FUNCTION lobby.attempt_unlock(
	p_player_id INT,
	p_passphrase TEXT
)

RETURN JSON AS $$
DECLARE
	v_expected_hash TEXT;
	v_submitted_hash TEXT;
	v_fragment TEXT;
BEGIN
	-- Get the expexted hash from Warden
	SELECT answer_hash, key_fragment
	INTO v_expected_hash, v_fragment
	FROM warden.answers
	WHERE room_name = 'lobby';

	-- Hash what the player submitted
	v_submitted_hash := encode(digest(p_passphrase, 'sha256'), 'hex');
	
	-- Log this attempt regardless of outcome
	INSERT INTO warden.attempt_log (player_id, room_name, submitted, correct)
	VALUES (p_player_id, 'lobby', p_passphrase, v_submitted_hash = v_expected_hash);

	--Check if correct
	IF v_submitted_hash = v_expected_hash THEN
		-- Unlock corridor for this player
		EXECUTE 'GRANT USAGE ON SCHEMA corridor TO prisoner';
		EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA corridor TO prisoner';
	
		-- Log the room completeion
		INSERT INTO warden.room_log (player_id, room_name)
		VALUES (p_player_id, 'lobby')
		ON CONFLICT DO NOTHING;
	
		-- Update player's current room
		UPDATE warden.players
		SET current_room = 'corridor'
		WHERE player_id = p_player_id;
	
		-- Notify warden terminal
		PERFORM pg_notify (
			'room_unlocked',
			json_build_object(
				'player_id', p_player_id,
				'room', 'lobby',
				'unlocked', 'corridor',
				'at', NOW()
			)::TEXT
		);
	
		RETURN json_build_object(
			'succes', TRUE,
			'message', 'Correct. The corridor is open.',
			'fragment', v_fragment,
			'next_room', 'corridor'
		);
	ELSE 
		RETURN json_build_object(
			'success', FALSE,
			'message', 'Wrong. The door does not move.',
			'fragment', NULL
		);
	END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION lobby.attemp_unlock(INT, TEXT) TO prisoner;
	