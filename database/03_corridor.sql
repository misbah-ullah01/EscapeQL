CREATE SCHEMA corridor;
-- Access is granted only after lobby is solved.

-- Base table with ALL doors including the hidden one.
CREATE TABLE corridor.door_log (
    door_id     SERIAL PRIMARY KEY,
    location    VARCHAR(100) NOT NULL,
    status      VARCHAR(20) DEFAULT 'LOCKED',
    active      BOOLEAN DEFAULT TRUE,
    secret_code VARCHAR(50)
);

CREATE TABLE corridor.maintenance_notes (
    note_id     SERIAL PRIMARY KEY,
    door_id     INT REFERENCES corridor.door_log(door_id),
    note_text   TEXT,
    technician  VARCHAR(50),
    note_date   DATE DEFAULT CURRENT_DATE
);

CREATE VIEW corridor.camera_feeds AS
SELECT door_id, location, status
FROM corridor.door_log
WHERE active = TRUE;
-- Puzzle hook: this WHERE clause hides door 7 from normal view.

COMMENT ON VIEW corridor.camera_feeds
    IS 'Live feed from all active corridor cameras.';

INSERT INTO corridor.door_log (location, status, active, secret_code) VALUES
    ('North Wing A',    'LOCKED',    TRUE,  NULL),
    ('North Wing B',    'LOCKED',    TRUE,  NULL),
    ('East Stairwell',  'LOCKED',    TRUE,  NULL),
    ('Server Corridor', 'LOCKED',    TRUE,  NULL),
    ('Emergency Exit',  'LOCKED',    TRUE,  NULL),
    ('Basement Access', 'LOCKED',    TRUE,  NULL),
    ('Maintenance Bay', 'UNLOCKED',  FALSE, 'DOOR_SEVEN_FOUND'),
    -- Door 7 is intentionally inactive and contains the code.
    ('South Hallway',   'LOCKED',    TRUE,  NULL),
    ('West Wing',       'LOCKED',    TRUE,  NULL),
    ('Archive Room',    'LOCKED',    TRUE,  NULL);

INSERT INTO corridor.maintenance_notes (door_id, note_text, technician, note_date) VALUES
    (1,  'Routine check. All clear.',            'T. Brown',   '2024-01-10'),
    (2,  'Hinge replaced.',                      'T. Brown',   '2024-01-11'),
    (3,  'Camera offline, fixed.',               'K. Mills',   '2024-01-12'),
    (4,  'Keypad battery replaced.',             'K. Mills',   '2024-01-13'),
    (5,  'Emergency bar tested.',                'T. Brown',   '2024-01-14'),
    (6,  'Basement access restricted.',          'Management', '2024-01-15'),
    (7,  'Door decommissioned. Do not use.',     'Unknown',    '2024-01-01'),
    -- Extra hint: Unknown technician + decommissioned wording.
    (8,  'Routine check.',                       'K. Mills',   '2024-01-16'),
    (9,  'Lock serviced.',                       'T. Brown',   '2024-01-17'),
    (10, 'Archive sealed per policy directive.', 'Management', '2024-01-18');

CREATE OR REPLACE FUNCTION corridor.attempt_unlock(
    p_player_id INT,
    p_code TEXT
)
RETURNS JSON AS $$
DECLARE
    v_expected_hash TEXT;
    v_submitted_hash TEXT;
    v_fragment TEXT;
BEGIN
    SELECT answer_hash, key_fragment
    INTO v_expected_hash, v_fragment
    FROM warden.answers
    WHERE room_name = 'corridor';

    v_submitted_hash := encode(digest(p_code, 'sha256'), 'hex');

    INSERT INTO warden.attempt_log (player_id, room_name, submitted, correct)
    VALUES (p_player_id, 'corridor', p_code, v_submitted_hash = v_expected_hash);

    IF v_submitted_hash = v_expected_hash THEN
        -- Unlock next room privileges after correct submission.
        EXECUTE 'GRANT USAGE ON SCHEMA vault TO prisoner';
        EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA vault TO prisoner';
        EXECUTE 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA vault TO prisoner';

        INSERT INTO warden.room_log (player_id, room_name)
        VALUES (p_player_id, 'corridor')
        ON CONFLICT DO NOTHING;

        UPDATE warden.players
        SET current_room = 'vault'
        WHERE player_id = p_player_id;

        PERFORM pg_notify(
            'room_unlocked',
            json_build_object(
                'player_id', p_player_id,
                'room', 'corridor',
                'at', NOW()
            )::TEXT
        );

        RETURN json_build_object(
            'success', TRUE,
            'message', 'The vault door slides open.',
            'fragment', v_fragment,
            'next_room', 'vault'
        );
    ELSE
        RETURN json_build_object(
            'success', FALSE,
            'message', 'The corridor stays dark.',
            'fragment', NULL
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION corridor.attempt_unlock(INT, TEXT) TO prisoner;

GRANT SELECT ON pg_views TO prisoner;



