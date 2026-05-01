-- File: database/05_server_room.sql

CREATE SCHEMA server_room;

-- ─────────────────────────────────────────────────────────
-- Table: server_room.authorization_log
-- Player inserts a row with status='AUTHORIZED' to trigger unlock
-- ─────────────────────────────────────────────────────────
CREATE TABLE server_room.authorization_log (
    log_id     SERIAL PRIMARY KEY,
    auth_id    VARCHAR(50) NOT NULL,   -- this column was RENAMED from clearance_id
    status     VARCHAR(20) DEFAULT 'PENDING',
    operator   VARCHAR(50),
    logged_at  TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN server_room.authorization_log.auth_id
    IS 'Authorization identifier. Previously known by a different name.';
-- The comment is a hint: "previously known by a different name"

-- ─────────────────────────────────────────────────────────
-- Table: server_room.hatch
-- The trigger is supposed to set open=true on this table
-- ─────────────────────────────────────────────────────────
CREATE TABLE server_room.hatch (
    hatch_id   SERIAL PRIMARY KEY,
    auth_id    VARCHAR(50),
    open       BOOLEAN DEFAULT FALSE,
    last_attempt TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO server_room.hatch (auth_id, open) VALUES ('HATCH-MAIN', FALSE);

-- ─────────────────────────────────────────────────────────
-- THE BROKEN TRIGGER FUNCTION
-- Bug: references 'clearance_id' which does not exist
-- The column is named 'auth_id'
-- Player must find this, rewrite the function, and re-attach
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION server_room.unlock_hatch()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'AUTHORIZED' THEN
        UPDATE server_room.hatch
        SET open = TRUE, last_attempt = NOW()
        WHERE clearance_id = NEW.clearance_id;
        -- BUG: 'clearance_id' does not exist in either table
        -- The correct column name is 'auth_id'
        -- This will throw: ERROR: column "clearance_id" does not exist
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_auth_insert
    AFTER INSERT ON server_room.authorization_log
    FOR EACH ROW
    EXECUTE FUNCTION server_room.unlock_hatch();

-- ─────────────────────────────────────────────────────────
-- CONCURRENCY TRAP
-- A simulated competing session holds a lock on the hatch row
-- The player needs SELECT FOR UPDATE SKIP LOCKED to proceed
-- We simulate this with a "lock holder" table and advisory locks
-- ─────────────────────────────────────────────────────────
CREATE TABLE server_room.lock_holder (
    id          INT PRIMARY KEY DEFAULT 1,
    held_by     VARCHAR(50) DEFAULT 'system_process_449',
    held_since  TIMESTAMPTZ DEFAULT NOW(),
    note        TEXT DEFAULT 'Another process is modifying the hatch. Use SKIP LOCKED.'
);

INSERT INTO server_room.lock_holder DEFAULT VALUES;

-- The player will see this table and understand they need SKIP LOCKED:
-- SELECT * FROM server_room.hatch FOR UPDATE SKIP LOCKED;
-- If the row is locked, it returns empty. They need to understand why.

-- Unlock function for server room
CREATE OR REPLACE FUNCTION server_room.attempt_unlock(p_player_id INT)
RETURNS JSON AS $$
DECLARE
    v_hatch_open BOOLEAN;
    v_fragment TEXT;
BEGIN
    -- Check if hatch was actually opened by the fixed trigger
    SELECT open INTO v_hatch_open FROM server_room.hatch WHERE hatch_id = 1;

    IF v_hatch_open = TRUE THEN
        SELECT key_fragment INTO v_fragment
        FROM warden.answers WHERE room_name = 'server_room';

        EXECUTE 'GRANT USAGE ON SCHEMA escape TO prisoner';
        EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA escape TO prisoner';
        EXECUTE 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA escape TO prisoner';

        INSERT INTO warden.room_log (player_id, room_name)
        VALUES (p_player_id, 'server_room') ON CONFLICT DO NOTHING;

        UPDATE warden.players SET current_room = 'escape'
        WHERE player_id = p_player_id;

        PERFORM pg_notify('room_unlocked',
            json_build_object('player_id', p_player_id,
                'room', 'server_room', 'at', NOW())::TEXT);

        RETURN json_build_object('success', TRUE,
            'message', 'Systems online. The escape hatch is open.',
            'fragment', v_fragment, 'next_room', 'escape');
    ELSE
        RETURN json_build_object('success', FALSE,
            'message', 'Hatch is still sealed. Fix the trigger first.',
            'hint', 'Read the trigger definition. Something was renamed.');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION server_room.attempt_unlock(INT) TO prisoner;
GRANT SELECT ON server_room.hatch TO prisoner;
GRANT SELECT ON server_room.lock_holder TO prisoner;
GRANT SELECT ON server_room.authorization_log TO prisoner;
GRANT INSERT ON server_room.authorization_log TO prisoner;

-- Grant access to pg_trigger so player can read trigger definitions
GRANT SELECT ON pg_trigger TO prisoner;
GRANT SELECT ON information_schema.columns TO prisoner;