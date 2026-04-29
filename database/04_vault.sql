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


