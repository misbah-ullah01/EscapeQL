CREATE SCHEMA vault;

-- This table deliberately violates 2NF for the normalization puzzle.
-- owner_address depends on owner_name, while the PK is (box_id, owner_name).
CREATE TABLE vault.safety_deposit_boxes (
    box_id          SERIAL,
    owner_name      VARCHAR(100),
    owner_address   VARCHAR(200),
    owner_phone     VARCHAR(20),
    box_code        VARCHAR(50),
    vault_zone      CHAR(1),
    checked_out     BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (box_id, owner_name)
);

COMMENT ON TABLE vault.safety_deposit_boxes
    IS 'The truth is in the consistent value. Anomalies reveal the liar.';

COMMENT ON COLUMN vault.safety_deposit_boxes.owner_address
    IS 'Something is inconsistent here. Find the functional dependency.';

INSERT INTO vault.safety_deposit_boxes
    (box_id, owner_name, owner_address, owner_phone, box_code, vault_zone)
VALUES
    (1,  'James Whitfield', '14 Oak Street, Lahore',      '042-111-2222', 'JW-001',     'A'),
    (2,  'Priya Sharma',    '7 Garden Road, Islamabad',   '051-333-4444', 'PS-002',     'A'),
    (3,  'Omar Khalid',     '33 Sunset Ave, Karachi',     '021-555-6666', 'OK-003',     'B'),
    (4,  'Liu Wei',         '88 Faisal Town, Lahore',     '042-777-8888', 'LW-004',     'B'),
    (5,  'Sara Nazir',      '2 Blue Area, Islamabad',     '051-999-0000', 'SN-005',     'C'),
    (6,  'T. Anderson',     '19 Clifton Block 4, Karachi','021-100-2000', '4471-DELTA', 'C'),
    -- Correct row: this box_code is the expected puzzle answer.
    (7,  'T. Anderson',     '91 Clifton Block 4, Karachi','021-100-2000', 'TA-007',     'C'),
    (8,  'T. Anderson',     '19 Cllfton Block 4, Karachi','021-100-2000', 'TA-008',     'C');

CREATE OR REPLACE FUNCTION vault.attempt_unlock(
    p_player_id INT,
    p_box_code TEXT
)
RETURNS JSON AS $$
DECLARE
    v_expected_hash TEXT;
    v_submitted_hash TEXT;
    v_fragment TEXT;
    v_txn_level BOOLEAN;
BEGIN
    -- Kept for teaching/discussion, even though the guard uses a session flag.
    v_txn_level := current_setting('transaction_isolation', TRUE) IS NOT NULL;

    -- Players must set this flag inside BEGIN/COMMIT via vault.set_ready().
    IF current_setting('vault.transaction_ready', TRUE) IS DISTINCT FROM 'yes' THEN
        RETURN json_build_object(
            'success', FALSE,
            'message', 'The vault does not accept unsigned submissions. Use BEGIN and COMMIT.',
            'hint', 'Try: BEGIN; SELECT vault.set_ready(); SELECT vault.attempt_unlock(id, code); COMMIT;'
        );
    END IF;

    SELECT answer_hash, key_fragment
    INTO v_expected_hash, v_fragment
    FROM warden.answers
    WHERE room_name = 'vault';

    v_submitted_hash := encode(digest(p_box_code, 'sha256'), 'hex');

    INSERT INTO warden.attempt_log (player_id, room_name, submitted, correct)
    VALUES (p_player_id, 'vault', p_box_code, v_submitted_hash = v_expected_hash);

    IF v_submitted_hash = v_expected_hash THEN
        -- Mark success in data to make the transaction requirement visible.
        UPDATE vault.safety_deposit_boxes
        SET checked_out = TRUE
        WHERE box_code = p_box_code;

        EXECUTE 'GRANT USAGE ON SCHEMA server_room TO prisoner';
        EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA server_room TO prisoner';
        EXECUTE 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA server_room TO prisoner';

        INSERT INTO warden.room_log (player_id, room_name)
        VALUES (p_player_id, 'vault')
        ON CONFLICT DO NOTHING;

        UPDATE warden.players
        SET current_room = 'server_room'
        WHERE player_id = p_player_id;

        PERFORM pg_notify(
            'room_unlocked',
            json_build_object(
                'player_id', p_player_id,
                'room', 'vault',
                'at', NOW()
            )::TEXT
        );

        PERFORM set_config('vault.transaction_ready', '', TRUE);

        RETURN json_build_object(
            'success', TRUE,
            'message', 'Box cleared. The server room door opens.',
            'fragment', v_fragment,
            'next_room', 'server_room'
        );
    ELSE
        RETURN json_build_object(
            'success', FALSE,
            'message', 'Wrong code. The vault stays sealed.',
            'fragment', NULL
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION vault.set_ready()
RETURNS TEXT AS $$
BEGIN
    PERFORM set_config('vault.transaction_ready', 'yes', TRUE);
    RETURN 'Transaction acknowledged. Now submit your answer.';
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION vault.attempt_unlock(INT, TEXT) TO prisoner;
GRANT EXECUTE ON FUNCTION vault.set_ready() TO prisoner;