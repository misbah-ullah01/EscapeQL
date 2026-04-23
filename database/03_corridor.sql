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

