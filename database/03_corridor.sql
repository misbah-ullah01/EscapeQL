-- File: database/03_corridor.sql

CREATE SCHEMA corridor;

-- =================================================

CREATE TABLE corridor.door_log (
    door_id     SERIAL PRIMARY KEY,
    location    VARCHAR(100) NOT NULL,
    status      VARCHAR(20) DEFAULT 'LOCKED',
    active      BOOLEAN DEFAULT TRUE,   -- door 7 is false
    secret_code VARCHAR(50)
);

-- =================================================

CREATE TABLE corridor.maintenance_ntoes (
    note_id     SERIAL PRIMARY KEY,
    door_id     INT REFERENCES corridor.door_log(door_id),
    note_text   TEXT,
    technician  VARCHAR(50),
    note_date   DATE DEFAULT CURRENT_DATE
);

-- =================================================

CREATE VIEW corridor.camera_feeds AS
    SELECT door_id, location, status
    FROM corridor.door_log
    WHERE active = TRUE;

-- the player will notice door 7 is missing after counting
-- They inpect: SELECT definition FROM pg_views WHERE viewname='camera_feeds'
-- they see the where claude and realize they need the base table

COMMENT ON VIEW corridor.camera_feeds
    IS 'Live feed from all active corridor cameras.';

-- This comment sounds innocent. It is misdirection.
-- the word "active" in the comment is the hint if they read carefully

-- =================================================

INSERT INTO corridor.door_log (location, status, active, secret_code) VALUES
    ('North Wing A',    'LOCKED',    TRUE,  NULL),
    ('North Wing B',    'LOCKED',    TRUE,  NULL),
    ('East Stairwell',  'LOCKED',    TRUE,  NULL),
    ('Server Corridor', 'LOCKED',    TRUE,  NULL),
    ('Emergency Exit',  'LOCKED',    TRUE,  NULL),
    ('Basement Access', 'LOCKED',    TRUE,  NULL),
    ('Maintenance Bay', 'UNLOCKED',  FALSE, 'DOOR_SEVEN_FOUND'),
    -- ^^^ Door 7 is active=FALSE and has the secret code
    ('South Hallway',   'LOCKED',    TRUE,  NULL),
    ('West Wing',       'LOCKED',    TRUE,  NULL),
    ('Archive Room',    'LOCKED',    TRUE,  NULL);

-- =================================================

INSERT INTO corridor.maintenance_notes (door_id, note_text, technician, note_date) VALUES
    (1,  'Routine check. All clear.',            'T. Brown',   '2024-01-10'),
    (2,  'Hinge replaced.',                      'T. Brown',   '2024-01-11'),
    (3,  'Camera offline, fixed.',               'K. Mills',   '2024-01-12'),
    (4,  'Keypad battery replaced.',             'K. Mills',   '2024-01-13'),
    (5,  'Emergency bar tested.',                'T. Brown',   '2024-01-14'),
    (6,  'Basement access restricted.',          'Management', '2024-01-15'),
    (7,  'Door decommissioned. Do not use.',     'Unknown',    '2024-01-01'),
    -- ^^^ The "Unknown" technician and "decommissioned" is another hint
    (8,  'Routine check.',                       'K. Mills',   '2024-01-16'),
    (9,  'Lock serviced.',                       'T. Brown',   '2024-01-17'),
    (10, 'Archive sealed per policy directive.', 'Management', '2024-01-18');

-- =================================================

-- Unlock feature for corridor
CREATE OR REPLACE FUNCTION corridor.attempt_unlock(
    p_player_id INT,
    p_code TEXT
)
RETURNS JSON AS $$
DECLARE
    v_expected_hash TEXT;
    v_submitted_hash TEXT;
    v_fragment TEXT
BEGIN
    SELECT answer_hash, key_fragments INTO v_expected_hash, v_fragment
    FROM warden.answers WHERE room_name = 'corridor';

    v_submitted_hash := encode(digest(p_code, 'sha256'), 'hex');

    INSERT INTO warden.attempt_log (p_player_id, room_name, submitted_correct)
    VALUES (p_player_id, 'corridor', p_code, v_submitted_hash = v_expected_hash);

    IF v_submitted_hash = v_expected_hash THEN
        EXECUTE 'GRANT USAGE ON SCHEMA vault TO prisoner';
        EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA vault TO prisoner';
        EXECUTE 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA vault TO prisoner';

        INSERT INTO warden.room_log (player_id, room_name)
        VALUES (p_player_id, 'corridor') ON CONFLICT DO NOTHING;

        UPDATE warden.players SET current_room = 'vault'
        WHERE player_id = p_player_id;

        