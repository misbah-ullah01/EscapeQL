-- File: database/06_escape.sql

CREATE SCHEMA escape;

CREATE TABLE escape.freedom (
    id      INT PRIMARY KEY DEFAULT 1,
    message BYTEA NOT NULL     -- encrypted with pgp_sym_encrypt
);

-- The message is encrypted with the key 'ALPHA-BRAVO-CHARLIE-DELTA'
-- (the four fragments assembled in order)
INSERT INTO escape.freedom (message)
VALUES (
    pgp_sym_encrypt(
        'You are free. The database was never just storage. It was the world.',
        'ALPHA-BRAVO-CHARLIE-DELTA'
    )
);

-- The player calls:
-- SELECT convert_from(
--     pgp_sym_decrypt(message, 'ALPHA-BRAVO-CHARLIE-DELTA'),
--     'UTF8'
-- ) FROM escape.freedom;

-- Final completion function
CREATE OR REPLACE FUNCTION escape.complete_game(
    p_player_id INT,
    p_key TEXT
)
RETURNS JSON AS $$
DECLARE
    v_decrypted TEXT;
BEGIN
    BEGIN
        SELECT convert_from(
            pgp_sym_decrypt(message, p_key),
            'UTF8'
        ) INTO v_decrypted
        FROM escape.freedom;
    EXCEPTION WHEN OTHERS THEN
        RETURN json_build_object(
            'success', FALSE,
            'message', 'Wrong key. The message stays encrypted.',
            'hint', 'Assemble your fragments in order: room1-room2-room3-room4'
        );
    END;

    UPDATE warden.players
    SET completed_at = NOW(), current_room = 'ESCAPED'
    WHERE player_id = p_player_id;

    INSERT INTO warden.room_log (player_id, room_name)
    VALUES (p_player_id, 'escape') ON CONFLICT DO NOTHING;

    PERFORM pg_notify('game_completed',
        json_build_object('player_id', p_player_id, 'at', NOW())::TEXT);

    RETURN json_build_object(
        'success', TRUE,
        'message', v_decrypted,
        'completed_at', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION escape.complete_game(INT, TEXT) TO prisoner;