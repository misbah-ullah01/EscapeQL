-- File: database/07_permissions.sql

-- ─────────────────────────────────────────────────────────
-- Row-Level Security on room_log
-- Each player can only see their own completion records
-- ─────────────────────────────────────────────────────────
ALTER TABLE warden.room_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY player_sees_own_log ON warden.room_log
    FOR SELECT
    USING (
        player_id = (
            SELECT player_id FROM warden.players
            WHERE username = current_user
        )
    );

-- Warden bypasses RLS (superuser bypass is default, but explicit is cleaner)
ALTER TABLE warden.room_log FORCE ROW LEVEL SECURITY;
GRANT SELECT ON warden.room_log TO prisoner;

-- ─────────────────────────────────────────────────────────
-- Allow prisoner to call warden functions (player registration)
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION warden.register_player(p_username TEXT)
RETURNS JSON AS $$
DECLARE
    v_player_id INT;
BEGIN
    INSERT INTO warden.players (username)
    VALUES (p_username)
    ON CONFLICT (username) DO UPDATE SET is_active = TRUE
    RETURNING player_id INTO v_player_id;

    RETURN json_build_object('player_id', v_player_id, 'username', p_username);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION warden.register_player(TEXT) TO prisoner;

-- Allow prisoner to read their own player record
CREATE OR REPLACE FUNCTION warden.get_my_status(p_player_id INT)
RETURNS JSON AS $$
DECLARE
    v_row warden.players%ROWTYPE;
BEGIN
    SELECT * INTO v_row FROM warden.players WHERE player_id = p_player_id;
    RETURN json_build_object(
        'player_id', v_row.player_id,
        'username', v_row.username,
        'current_room', v_row.current_room,
        'completed', v_row.completed_at IS NOT NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION warden.get_my_status(INT) TO prisoner;