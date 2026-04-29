CREATE SCHEMA vault;

-- ─────────────────────────────────────────────────────────
-- This table DELIBERATELY violates 2NF
-- owner_address depends only on owner_name,
-- but the PRIMARY KEY is (box_id, owner_name) - composite
-- So owner_address is a partial dependency = 2NF violation
-- ─────────────────────────────────────────────────────────

CREATE TAVLE vault.safety_deposit_boxes (
    box_id          SERIAL,
    owner_name      VARCHAR(100),
    owner_address   VARCHAR(200),
    owner_phone     VARCHAR(20),
    box_code        VARCHAR(50),
    checked_out     BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (box_id, owner_name)

    -- Notice: composite PK (box_id, owner_name)
    -- owner_address only depends on owner_name (partial dependency)
    -- This is exactly a 2NF violation
);

COMMENT ON TABLE vault.safety_deposit_boxes
    IS 'The truth is in the consistent value. Anomalies reveal the liar.';

COMMENT ON COLUMN vault.safety_deposit_boxes.owner_address
    IS 'Something is inconsistent here. Find the function depedency.';


-- ─────────────────────────────────────────────────────────
-- Seed data: The Anderson account has 3 rows
-- Two have wrong/inconsistent addresses (update anomalies)
-- One has the correct address
-- The player must find which one is consistent
-- ─────────────────────────────────────────────────────────


INSERT INTO vault.safety_deposit_boxes
    (box_id, owner_name, owner_address, owner_phone, box_code, vault_zone) VALUES
    -- Normal accounts (other customers, not the puzzle)
(1,  'James Whitfield',  '14 Oak Street, Lahore',       '042-111-2222', 'JW-001', 'A'),
(2,  'Priya Sharma',     '7 Garden Road, Islamabad',    '051-333-4444', 'PS-002', 'A'),
(3,  'Omar Khalid',      '33 Sunset Ave, Karachi',      '021-555-6666', 'OK-003', 'B'),
(4,  'Liu Wei',          '88 Faisal Town, Lahore',      '042-777-8888', 'LW-004', 'B'),
(5,  'Sara Nazir',       '2 Blue Area, Islamabad',      '051-999-0000', 'SN-005', 'C'),
-- The Anderson puzzle rows
-- Same owner, 3 boxes, but addresses are INCONSISTENT (update anomaly)
-- The functional dependency says: owner_name -> owner_address (should be one value)
(6,  'T. Anderson',  '19 Clifton Block 4, Karachi',  '021-100-2000', '4471-DELTA', 'C'),
(7,  'T. Anderson',  '91 Clifton Block 4, Karachi',  '021-100-2000', 'TA-007',     'C'),
(8,  'T. Anderson',  '19 Cllfton Block 4, Karachi',  '021-100-2000', 'TA-008',     'C');
-- Box 6: '19 Clifton Block 4' <- CORRECT (box_code is the answer)
-- Box 7: '91 Clifton Block 4' <- WRONG (house number reversed, anomaly)
-- Box 8: '19 Cllfton Block 4' <- WRONG (typo in 'Cllfton', anomaly)
-- Player finds the consistent value = box 6, answer = '4471-DELTA'


-- ─────────────────────────────────────────────────────────
-- The transaction check
-- The function CHECKS if it was called inside a transaction
-- If not, it refuses to validate the answer
-- This forces the player to use BEGIN/COMMIT
-- ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION vault.attempt_unclock(
    p_player_id INT, 
    p_box TEXT
)
RETURNS JSON AS $$
DECLARE
    v_expected_hash TEXT;
    v_submitted_hash TEXT;
    v_fragment TEXT;
    v_txn_level INT;
BEGIN
    - Check if we are inside a transaction block
    -- pg_current_xact_id_if_assigned() returns NULL if no active transaction
    -- txid_current_if_assigned() is another way
    v_txn_level := current_setting('transaction_isolation', TRUE)::TEXT IS NOT NULL;

    -- Actually check using a different approach:
    -- If called outside BEGIN, this is a single-statement auto-transaction
    -- We use a session variable trick to detect this
    -- The player must call: SELECT vault.set_ready(); BEGIN; SELECT vault.attempt_unlock(...); COMMIT;
    -- For simplicity: check if a session flag was set

    IF current_setting('vault.transaction_ready', TRUE) IS NULL
        OR current_setting('vault.transaction_ready', TRUE) != 'yes' THEN
            RETURN json_build_object(
                'success', FALSE,
                'Message', 'The vault does not accept unsigned submissions. Use BEGIN and COMMIT.',
                'hint', 'Try: BEGIN; SELECT vault.set_ready(); SELECT vault.attempt_unlock(id, code); COMMIT;'
            );
    END IF;

    SELECT answer_hash, key_fragments INTO v_expected_hash, v_fragment
    FROM warden.answers WHERE room_name = 'vault';

    v_submitted_hash := encode(digest(p_box_code, 'sha256'), 'hex');

    INSERT INTO warden.attempt_log (player_id, room_name, submitted, correct)

    VALUES (player_id, 'vault', p_box_code, v_submitted_hash = v_expected_hash);

    IF v_submitted_hash = v_expected_hash THEN
        -- mark the box as checked out (satisfying the transaction requirement)
        UPDATE vault.safety_deposit_boxes
        SET checked_out = TRUE
        WHERE box_code = p_box_code;

        EXECUTE 'GRANT USAGE ON SCHEMA server_room TO prisoner';
        EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA server_room TO prisoner';
        EXECUTE 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA server_room TO prisoner';

        INSERT INTO warden.room_log (player_id, room_name)
        VALUES (p_player_id, 'vault') ON CONFLICT DO NOTHING;

        UPDATE warden.playes SET current_room = 'server_room'
        WHERE player_id = p_player_id;

        PERFORM pg_notify('room_unlocked',
            json_build_object('player_id', p_player_id,
                'room', 'vault', 'at', NOW())::TEXT);

        -- Reset the flag
        PERFORM set_config('vault.transaction_ready', '', TRUE);

        RETURN json_build_object('success', TRUE,
            'message', 'Box cleared. The server room door opens.',
            'fragment', v_fragment, 'next_room', 'server_room');
    ELSE
        ETURN json_build_object('success', FALSE,
            'message', 'Wrong code. The vault stays sealed.', 'fragment', NULL);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function the player must call inside their transaction
CREATE OR REPLACE FUNCTION vault.set_ready()
RETURNS TEXT AS $$
BEGIN
    PERFORM set_config('vault.transaction_ready', 'yes', TRUE);
    RETURN 'Transaction acknowledged. Now submit your answer.';
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION vault.attempt_unlock(INT, TEXT) TO prisoner;
GRANT EXECUTE ON FUNCTION vault.set_ready() TO prisoner;