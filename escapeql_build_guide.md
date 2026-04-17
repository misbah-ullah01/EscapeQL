# EscapeQL — Complete Step-by-Step Build Guide
### Instructions for AI-Assisted Development

> **How to use this document:**
> Feed each Phase to your AI assistant one at a time. Ask it to explain
> every line before you run it. Never copy-paste blindly. When stuck,
> paste the exact error message and ask the AI what it means.

---

## PHASE 0 — Tools You Need (All Free)

### Install These First

| Tool | What It Is | Download |
|---|---|---|
| **PostgreSQL 16** | The database engine. The entire game runs inside this. | https://www.postgresql.org/download/ |
| **pgAdmin 4** | A visual GUI to browse your database while building it. Free. Comes bundled with PostgreSQL installer on Windows. | https://www.pgadmin.org/ |
| **VS Code** | Code editor. You will write SQL, JavaScript, and HTML here. | https://code.visualstudio.com/ |
| **Node.js (LTS)** | JavaScript runtime for the web frontend server. | https://nodejs.org/ |
| **Git** | Version control. Track your changes. | https://git-scm.com/ |
| **Postman** | Test your backend API routes before connecting the frontend. | https://www.postman.com/downloads/ |

### VS Code Extensions to Install

Open VS Code, press `Ctrl+Shift+X`, and install:
- **PostgreSQL** by Chris Kolkman — lets you run SQL directly from VS Code
- **SQLTools** — another SQL client inside VS Code
- **ESLint** — catches JavaScript errors
- **Prettier** — auto-formats your code

### Verify Everything is Working

Open a terminal and run these one by one:
```bash
psql --version          # should say: psql (PostgreSQL) 16.x
node --version          # should say: v20.x.x or similar
npm --version           # should say: 10.x.x or similar
git --version           # should say: git version 2.x.x
```

If any command is not found, the tool is not installed correctly or not added to PATH. Ask your AI to fix the PATH issue for your operating system.

---

## PHASE 1 — Understanding the Project Architecture

### What You Are Building

```
┌─────────────────────────────────────────────────────────┐
│                    EscapeQL System                       │
│                                                         │
│   ┌─────────────────┐       ┌─────────────────────┐    │
│   │   Web Frontend  │  <->  │   Node.js Backend   │    │
│   │  (HTML/CSS/JS)  │       │   (Express Server)  │    │
│   │                 │       │                     │    │
│   │  - Game map     │       │  - REST API routes  │    │
│   │  - Room status  │       │  - Auth middleware   │    │
│   │  - SQL terminal │       │  - Query executor   │    │
│   │  - Leaderboard  │       │  - Session manager  │    │
│   └─────────────────┘       └──────────┬──────────┘    │
│                                        │                │
│                              ┌─────────▼──────────┐    │
│                              │   PostgreSQL 16     │    │
│                              │                     │    │
│                              │  schema: warden     │    │
│                              │  schema: lobby      │    │
│                              │  schema: corridor   │    │
│                              │  schema: vault      │    │
│                              │  schema: server_rm  │    │
│                              │  schema: escape     │    │
│                              └─────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### Folder Structure You Will Create

```
escapeql/
├── database/
│   ├── 00_setup.sql          ← Creates users and database
│   ├── 01_warden_schema.sql  ← Admin tables
│   ├── 02_lobby.sql          ← Room 1
│   ├── 03_corridor.sql       ← Room 2
│   ├── 04_vault.sql          ← Room 3
│   ├── 05_server_room.sql    ← Room 4
│   ├── 06_escape.sql         ← Final room
│   ├── 07_permissions.sql    ← All GRANT/REVOKE statements
│   └── reset.sql             ← Resets game to start
├── backend/
│   ├── server.js             ← Main Express server
│   ├── db.js                 ← PostgreSQL connection
│   ├── routes/
│   │   ├── auth.js           ← Login/register routes
│   │   ├── game.js           ← Room status, unlock routes
│   │   └── query.js          ← Safe SQL executor route
│   └── package.json
├── frontend/
│   ├── index.html            ← Login page
│   ├── game.html             ← Main game dashboard
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── auth.js
│       └── game.js
└── README.md
```

---

## PHASE 2 — Database Setup

### Step 2.1 — Create the Database and Users

Open pgAdmin or your terminal. Connect as the default `postgres` superuser.

**Ask your AI:** "Explain what a PostgreSQL role is, what SUPERUSER means, and why we need two separate roles here."

```sql
-- File: database/00_setup.sql
-- Run this as the postgres superuser

-- Create the game database
CREATE DATABASE escape_room
    ENCODING 'UTF8'
    LC_COLLATE 'en_US.UTF-8'
    LC_CTYPE 'en_US.UTF-8';

-- Connect to the new database before running the rest
\c escape_room

-- The warden is the game master (superuser equivalent for this DB)
-- This account is used by the instructor/evaluator
CREATE ROLE warden WITH
    LOGIN
    PASSWORD 'warden_secure_pass_2024'
    CREATEROLE;

-- The prisoner is the player account
-- Starts with almost no privileges
CREATE ROLE prisoner WITH
    LOGIN
    PASSWORD 'prisoner_pass_2024';

-- Enable required extensions
-- pgcrypto gives us encryption functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- pg_audit gives us query logging (may need to be enabled in postgresql.conf)
-- CREATE EXTENSION IF NOT EXISTS pgaudit;

-- Revoke default public schema access from prisoner
-- This ensures prisoner cannot see anything we haven't explicitly granted
REVOKE ALL ON DATABASE escape_room FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM PUBLIC;

-- Give warden full access
GRANT ALL ON DATABASE escape_room TO warden;
GRANT ALL ON SCHEMA public TO warden;
```

**How to run this:**
```bash
# In your terminal, connect to postgres as superuser
psql -U postgres

# Then inside psql, run the file
\i /full/path/to/database/00_setup.sql

# Or run it directly from terminal
psql -U postgres -f database/00_setup.sql
```

**Ask your AI:** "What does REVOKE ALL ON SCHEMA public FROM PUBLIC mean? Why is this important for our game?"

---

### Step 2.2 — Create the Warden Schema (Admin Layer)

**Ask your AI:** "What is a PostgreSQL schema? How is it different from a database? Why are we using schemas as rooms?"

```sql
-- File: database/01_warden_schema.sql
-- Connect as warden to run this
-- \c escape_room warden

-- Create the warden schema (hidden admin area)
CREATE SCHEMA warden;

-- Only warden can see or use this schema
REVOKE ALL ON SCHEMA warden FROM PUBLIC;
GRANT ALL ON SCHEMA warden TO warden;

-- ─────────────────────────────────────────────────────────
-- Table: warden.players
-- Stores every player account
-- ─────────────────────────────────────────────────────────
CREATE TABLE warden.players (
    player_id    SERIAL PRIMARY KEY,
    username     VARCHAR(50) UNIQUE NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,           -- NULL until they escape
    current_room VARCHAR(50) DEFAULT 'lobby',
    is_active    BOOLEAN DEFAULT TRUE
);

-- What is SERIAL? It auto-increments (1, 2, 3...) for each new row
-- What is TIMESTAMPTZ? Timestamp WITH timezone - always good practice
-- What is DEFAULT NOW()? Automatically fills in the current time

-- ─────────────────────────────────────────────────────────
-- Table: warden.room_log
-- Audit trail: every room completion is recorded here
-- ─────────────────────────────────────────────────────────
CREATE TABLE warden.room_log (
    log_id      SERIAL PRIMARY KEY,
    player_id   INT NOT NULL REFERENCES warden.players(player_id),
    room_name   VARCHAR(50) NOT NULL,
    solved_at   TIMESTAMPTZ DEFAULT NOW(),
    attempts    INT DEFAULT 1,
    time_taken  INTERVAL     -- e.g. '00:12:34' (12 minutes 34 seconds)
);

-- What is REFERENCES? This is a FOREIGN KEY constraint.
-- It means player_id in room_log must exist in players.player_id
-- This enforces referential integrity (course topic: Relational Model)

-- ─────────────────────────────────────────────────────────
-- Table: warden.answers
-- Stores hashed answers for each room
-- Players NEVER have SELECT access on this table
-- ─────────────────────────────────────────────────────────
CREATE TABLE warden.answers (
    room_name      VARCHAR(50) PRIMARY KEY,
    answer_hash    TEXT NOT NULL,    -- SHA-256 hash of the real answer
    unlock_target  VARCHAR(50) NOT NULL, -- which schema to unlock on success
    key_fragment   VARCHAR(100) NOT NULL -- piece of final decryption key
);

-- ─────────────────────────────────────────────────────────
-- Table: warden.attempt_log
-- Records every unlock attempt (correct or wrong)
-- Used for the evaluator dashboard
-- ─────────────────────────────────────────────────────────
CREATE TABLE warden.attempt_log (
    id           SERIAL PRIMARY KEY,
    player_id    INT REFERENCES warden.players(player_id),
    room_name    VARCHAR(50),
    submitted    TEXT,          -- what they submitted
    correct      BOOLEAN,
    attempted_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────
-- Insert the answer key
-- We hash the answers so they cannot be read even if warden
-- table is somehow exposed
-- ─────────────────────────────────────────────────────────
INSERT INTO warden.answers (room_name, answer_hash, unlock_target, key_fragment)
VALUES
    ('lobby',
     encode(digest('MARCUS_VOID_KNOWS', 'sha256'), 'hex'),
     'corridor',
     'ALPHA'),
    ('corridor',
     encode(digest('DOOR_SEVEN_FOUND', 'sha256'), 'hex'),
     'vault',
     'BRAVO'),
    ('vault',
     encode(digest('4471-DELTA', 'sha256'), 'hex'),
     'server_room',
     'CHARLIE'),
    ('server_room',
     encode(digest('HATCH_UNLOCKED', 'sha256'), 'hex'),
     'escape',
     'DELTA');

-- What is encode(digest(...), 'hex')?
-- digest() from pgcrypto computes a SHA-256 hash (returns bytes)
-- encode(..., 'hex') converts those bytes to a readable hex string
-- Result looks like: 'a3f1c2d4...' (64 hex characters)

-- Grant warden ownership of all these tables
GRANT ALL ON ALL TABLES IN SCHEMA warden TO warden;
GRANT ALL ON ALL SEQUENCES IN SCHEMA warden TO warden;
```

---

### Step 2.3 — Room 1: The Lobby (NULL Puzzle)

**Concept taught:** Basic SQL, NULL values, metadata queries, column comments

**The puzzle:** One staff member has NULL in their `access_code` column. A column comment says "the one who left no trace knows the way." The player must find the NULL row, join with `hint_board`, and get the passphrase.

**Ask your AI:** "What is NULL in SQL? Why is NULL different from an empty string or zero? What does IS NULL mean versus = NULL?"

```sql
-- File: database/02_lobby.sql

CREATE SCHEMA lobby;

-- Give prisoner access to lobby immediately (starting room)
GRANT USAGE ON SCHEMA lobby TO prisoner;
GRANT SELECT ON ALL TABLES IN SCHEMA lobby TO prisoner;

-- ─────────────────────────────────────────────────────────
-- Table: lobby.staff_directory
-- The puzzle is hiding in the access_code column
-- ─────────────────────────────────────────────────────────
CREATE TABLE lobby.staff_directory (
    staff_id    SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    department  VARCHAR(50),
    access_code VARCHAR(20),    -- intentionally NULL for one row
    clue        TEXT,
    active      BOOLEAN DEFAULT TRUE
);

-- The column comment IS the first clue
-- Players can read it with: \d+ lobby.staff_directory
COMMENT ON COLUMN lobby.staff_directory.access_code
    IS 'The one who left no trace knows the way.';

-- ─────────────────────────────────────────────────────────
-- Table: lobby.hint_board
-- Contains the passphrase once you know who to look for
-- ─────────────────────────────────────────────────────────
CREATE TABLE lobby.hint_board (
    hint_id    SERIAL PRIMARY KEY,
    staff_name VARCHAR(100),
    message    TEXT,
    passphrase VARCHAR(100)
);

-- ─────────────────────────────────────────────────────────
-- Seed Data: 12 staff members, only Marcus Void has NULL
-- ─────────────────────────────────────────────────────────
INSERT INTO lobby.staff_directory (name, department, access_code, clue) VALUES
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
    -- ^^^ This is the one. NULL access_code. Department is "Unknown".

-- Hint board: only Marcus Void's row matters
INSERT INTO lobby.hint_board (staff_name, message, passphrase) VALUES
    ('Marcus Void',
     'You found me. The corridor opens with the words below.',
     'MARCUS_VOID_KNOWS');

-- ─────────────────────────────────────────────────────────
-- Function: lobby.attempt_unlock(player_id, passphrase)
-- This is what gets called when a player submits their answer
-- If correct: grants access to corridor schema
-- If wrong: logs the attempt and returns an error message
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION lobby.attempt_unlock(
    p_player_id INT,
    p_passphrase TEXT
)
RETURNS JSON AS $$
DECLARE
    v_expected_hash TEXT;
    v_submitted_hash TEXT;
    v_fragment TEXT;
BEGIN
    -- Get the expected hash from warden
    SELECT answer_hash, key_fragment
    INTO v_expected_hash, v_fragment
    FROM warden.answers
    WHERE room_name = 'lobby';

    -- Hash what the player submitted
    v_submitted_hash := encode(digest(p_passphrase, 'sha256'), 'hex');

    -- Log this attempt regardless of outcome
    INSERT INTO warden.attempt_log (player_id, room_name, submitted, correct)
    VALUES (p_player_id, 'lobby', p_passphrase, v_submitted_hash = v_expected_hash);

    -- Check if correct
    IF v_submitted_hash = v_expected_hash THEN
        -- Unlock corridor for this player
        -- Note: In a real multi-player setup you would use RLS
        -- For single player: grant directly
        EXECUTE 'GRANT USAGE ON SCHEMA corridor TO prisoner';
        EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA corridor TO prisoner';

        -- Log the room completion
        INSERT INTO warden.room_log (player_id, room_name)
        VALUES (p_player_id, 'lobby')
        ON CONFLICT DO NOTHING;

        -- Update player's current room
        UPDATE warden.players
        SET current_room = 'corridor'
        WHERE player_id = p_player_id;

        -- Notify warden terminal (LISTEN/NOTIFY)
        PERFORM pg_notify(
            'room_unlocked',
            json_build_object(
                'player_id', p_player_id,
                'room', 'lobby',
                'unlocked', 'corridor',
                'at', NOW()
            )::TEXT
        );

        RETURN json_build_object(
            'success', TRUE,
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
-- SECURITY DEFINER means this function runs with the permissions of its owner
-- (warden), not the caller (prisoner). This is how prisoner can call a function
-- that grants privileges it does not have itself.

GRANT EXECUTE ON FUNCTION lobby.attempt_unlock(INT, TEXT) TO prisoner;
```

**Ask your AI to explain:**
1. What is `SECURITY DEFINER` and why is it needed here?
2. What does `pg_notify` do and what is the LISTEN/NOTIFY pattern?
3. What is `ON CONFLICT DO NOTHING`?

---

### Step 2.4 — Room 2: The Corridor (Broken View Puzzle)

**Concept taught:** Views, relational algebra (selection on derived relation), metadata inspection

**The puzzle:** A view called `camera_feeds` shows all doors but has `WHERE active = true`, hiding door number 7 (which is `active = false`). The player must inspect `pg_views` to see the view definition, then query the base table directly to find door 7 and cross-reference `maintenance_notes`.

**Ask your AI:** "What is a PostgreSQL VIEW? How is it different from a table? What does it mean that a view is a derived relation in relational algebra?"

```sql
-- File: database/03_corridor.sql

CREATE SCHEMA corridor;
-- (Access granted after lobby is solved, so no GRANT here yet)

-- ─────────────────────────────────────────────────────────
-- Table: corridor.door_log
-- Base table with ALL doors including the hidden one
-- ─────────────────────────────────────────────────────────
CREATE TABLE corridor.door_log (
    door_id     SERIAL PRIMARY KEY,
    location    VARCHAR(100) NOT NULL,
    status      VARCHAR(20) DEFAULT 'LOCKED',
    active      BOOLEAN DEFAULT TRUE,    -- door 7 is FALSE
    secret_code VARCHAR(50)
);

-- ─────────────────────────────────────────────────────────
-- Table: corridor.maintenance_notes
-- Cross-reference table. Door 7's note contains the answer clue.
-- ─────────────────────────────────────────────────────────
CREATE TABLE corridor.maintenance_notes (
    note_id     SERIAL PRIMARY KEY,
    door_id     INT REFERENCES corridor.door_log(door_id),
    note_text   TEXT,
    technician  VARCHAR(50),
    note_date   DATE DEFAULT CURRENT_DATE
);

-- ─────────────────────────────────────────────────────────
-- THE BROKEN VIEW
-- This is the puzzle. Players see this first.
-- The WHERE active = true hides door 7.
-- ─────────────────────────────────────────────────────────
CREATE VIEW corridor.camera_feeds AS
    SELECT door_id, location, status
    FROM corridor.door_log
    WHERE active = TRUE;
-- The player will notice door 7 is missing after counting
-- They inspect: SELECT definition FROM pg_views WHERE viewname='camera_feeds'
-- They see the WHERE clause and realize they need the base table

COMMENT ON VIEW corridor.camera_feeds
    IS 'Live feed from all active corridor cameras.';
-- This comment sounds innocent. It is a misdirection.
-- The word "active" in the comment is the hint if they read carefully.

-- ─────────────────────────────────────────────────────────
-- Seed Data
-- ─────────────────────────────────────────────────────────
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

-- Unlock function for corridor
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
    SELECT answer_hash, key_fragment INTO v_expected_hash, v_fragment
    FROM warden.answers WHERE room_name = 'corridor';

    v_submitted_hash := encode(digest(p_code, 'sha256'), 'hex');

    INSERT INTO warden.attempt_log (player_id, room_name, submitted, correct)
    VALUES (p_player_id, 'corridor', p_code, v_submitted_hash = v_expected_hash);

    IF v_submitted_hash = v_expected_hash THEN
        EXECUTE 'GRANT USAGE ON SCHEMA vault TO prisoner';
        EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA vault TO prisoner';
        EXECUTE 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA vault TO prisoner';

        INSERT INTO warden.room_log (player_id, room_name)
        VALUES (p_player_id, 'corridor') ON CONFLICT DO NOTHING;

        UPDATE warden.players SET current_room = 'vault'
        WHERE player_id = p_player_id;

        PERFORM pg_notify('room_unlocked',
            json_build_object('player_id', p_player_id,
                'room', 'corridor', 'at', NOW())::TEXT);

        RETURN json_build_object('success', TRUE,
            'message', 'The vault door slides open.',
            'fragment', v_fragment, 'next_room', 'vault');
    ELSE
        RETURN json_build_object('success', FALSE,
            'message', 'The corridor stays dark.', 'fragment', NULL);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION corridor.attempt_unlock(INT, TEXT) TO prisoner;

-- Grant prisoner read access to pg_views (needed to solve the puzzle)
GRANT SELECT ON pg_views TO prisoner;
```

---

### Step 2.5 — Room 3: The Vault (Normalization Puzzle)

**Concept taught:** Functional dependencies, 2NF violation, update anomalies, transactions

**The puzzle:** The `safety_deposit_boxes` table violates 2NF. One owner appears 3 times with 3 different addresses (update anomaly). Two are wrong. The correct one satisfies the functional dependency `owner_name -> owner_address`. The answer must be submitted inside a `BEGIN/COMMIT` block or the function rejects it.

**Ask your AI:** "What is Second Normal Form (2NF)? What is an update anomaly? What is a functional dependency? Show me an example."

```sql
-- File: database/04_vault.sql

CREATE SCHEMA vault;

-- ─────────────────────────────────────────────────────────
-- This table DELIBERATELY violates 2NF
-- owner_address depends only on owner_name,
-- but the PRIMARY KEY is (box_id, owner_name) - composite
-- So owner_address is a partial dependency = 2NF violation
-- ─────────────────────────────────────────────────────────
CREATE TABLE vault.safety_deposit_boxes (
    box_id        SERIAL,
    owner_name    VARCHAR(100),
    owner_address VARCHAR(200),   -- THE ANOMALY IS HERE
    owner_phone   VARCHAR(20),
    box_code      VARCHAR(50),
    vault_zone    CHAR(1),
    checked_out   BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (box_id, owner_name)
    -- Notice: composite PK (box_id, owner_name)
    -- owner_address only depends on owner_name (partial dependency)
    -- This is exactly a 2NF violation
);

COMMENT ON TABLE vault.safety_deposit_boxes
    IS 'The truth is in the consistent value. Anomalies reveal the liar.';

COMMENT ON COLUMN vault.safety_deposit_boxes.owner_address
    IS 'Something is inconsistent here. Find the functional dependency.';

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
CREATE OR REPLACE FUNCTION vault.attempt_unlock(
    p_player_id INT,
    p_box_code TEXT
)
RETURNS JSON AS $$
DECLARE
    v_expected_hash TEXT;
    v_submitted_hash TEXT;
    v_fragment TEXT;
    v_txn_level INT;
BEGIN
    -- Check if we are inside a transaction block
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
            'message', 'The vault does not accept unsigned submissions. Use BEGIN and COMMIT.',
            'hint', 'Try: BEGIN; SELECT vault.set_ready(); SELECT vault.attempt_unlock(id, code); COMMIT;'
        );
    END IF;

    SELECT answer_hash, key_fragment INTO v_expected_hash, v_fragment
    FROM warden.answers WHERE room_name = 'vault';

    v_submitted_hash := encode(digest(p_box_code, 'sha256'), 'hex');

    INSERT INTO warden.attempt_log (player_id, room_name, submitted, correct)
    VALUES (p_player_id, 'vault', p_box_code, v_submitted_hash = v_expected_hash);

    IF v_submitted_hash = v_expected_hash THEN
        -- Mark the box as checked out (satisfying the transaction requirement)
        UPDATE vault.safety_deposit_boxes
        SET checked_out = TRUE
        WHERE box_code = p_box_code;

        EXECUTE 'GRANT USAGE ON SCHEMA server_room TO prisoner';
        EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA server_room TO prisoner';
        EXECUTE 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA server_room TO prisoner';

        INSERT INTO warden.room_log (player_id, room_name)
        VALUES (p_player_id, 'vault') ON CONFLICT DO NOTHING;

        UPDATE warden.players SET current_room = 'server_room'
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
        RETURN json_build_object('success', FALSE,
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
```

---

### Step 2.6 — Room 4: The Server Room (Trigger Debugging Puzzle)

**Concept taught:** Triggers, pl/pgSQL debugging, concurrency control, recovery

**The puzzle:** A trigger function `unlock_hatch()` contains a bug: it references column `clearance_id` which was renamed to `auth_id`. The player must read the trigger definition from `pg_trigger`, find the bug, rewrite the function, AND deal with a simulated lock held by a competing session using `SELECT FOR UPDATE SKIP LOCKED`.

**Ask your AI:** "What is a PostgreSQL trigger? What is AFTER INSERT? What does it mean when a trigger references a column that does not exist?"

```sql
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
```

---

### Step 2.7 — The Final Room: Escape (pgcrypto Puzzle)

**Concept taught:** Encryption, pgcrypto, advanced PostgreSQL

**The puzzle:** One encrypted row. Player assembles the 4 fragments from previous rooms into a key and calls `pgp_sym_decrypt()`.

```sql
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
```

---

### Step 2.8 — Final Permissions and Row-Level Security

```sql
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
```

---

## PHASE 3 — Node.js Backend

### Step 3.1 — Initialize the Backend Project

```bash
# In your terminal, navigate to the project folder
cd escapeql/backend

# Initialize Node.js project
npm init -y

# Install required packages
npm install express pg cors express-session bcryptjs dotenv

# Install development tools
npm install --save-dev nodemon
```

**What each package does:**
- `express` — web framework that handles HTTP requests and responses
- `pg` — PostgreSQL client for Node.js, lets us run SQL queries from JavaScript
- `cors` — allows the frontend (different port) to talk to the backend
- `express-session` — manages user sessions (remembers who is logged in)
- `bcryptjs` — hashes passwords (never store plain text passwords)
- `dotenv` — loads environment variables from a `.env` file

**Ask your AI:** "What is a REST API? What is the difference between GET and POST? What is CORS and why do we need it?"

### Step 3.2 — Environment Variables

```bash
# Create a .env file in backend/
# NEVER commit this file to Git
touch .env
```

```env
# backend/.env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=escape_room
DB_USER=prisoner
DB_PASSWORD=prisoner_pass_2024

DB_WARDEN_USER=warden
DB_WARDEN_PASSWORD=warden_secure_pass_2024

SESSION_SECRET=some_very_long_random_string_change_this_in_production
PORT=3001
```

```
# Add to .gitignore
echo ".env" >> .gitignore
echo "node_modules/" >> .gitignore
```

### Step 3.3 — Database Connection Module

```javascript
// backend/db.js
// This module creates and exports two database connection pools:
// one for the prisoner role, one for the warden role

const { Pool } = require('pg');
require('dotenv').config();

// Pool = a collection of reusable database connections
// Instead of opening a new connection for every request (slow),
// we maintain a pool of connections that stay open

// Prisoner pool: limited privileges, used for player actions
const prisonerPool = new Pool({
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 10,          // maximum 10 connections in pool
    idleTimeoutMillis: 30000,  // close idle connections after 30s
    connectionTimeoutMillis: 2000,  // fail if connection takes > 2s
});

// Warden pool: full privileges, used for admin/evaluator actions
const wardenPool = new Pool({
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user:     process.env.DB_WARDEN_USER,
    password: process.env.DB_WARDEN_PASSWORD,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Test connection on startup
prisonerPool.connect((err, client, release) => {
    if (err) {
        console.error('Failed to connect prisoner pool:', err.message);
    } else {
        console.log('Prisoner pool connected to PostgreSQL');
        release(); // always release the client back to pool
    }
});

module.exports = { prisonerPool, wardenPool };
```

### Step 3.4 — Authentication Routes

```javascript
// backend/routes/auth.js
// Handles player registration and login

const express = require('express');
const router  = express.Router();
const { prisonerPool, wardenPool } = require('../db');

// POST /api/auth/register
// Creates a new player account
// Body: { username: "playerName" }
router.post('/register', async (req, res) => {
    const { username } = req.body;

    // Basic validation
    if (!username || username.length < 3 || username.length > 50) {
        return res.status(400).json({
            error: 'Username must be between 3 and 50 characters'
        });
    }

    // Only allow letters, numbers, underscores (prevent SQL injection via username)
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({
            error: 'Username can only contain letters, numbers, and underscores'
        });
    }

    try {
        // Call the warden function to register the player
        // We use parameterized queries ($1) to prevent SQL injection
        const result = await wardenPool.query(
            'SELECT warden.register_player($1) AS player',
            [username]
        );

        const player = result.rows[0].player;

        // Store player info in session
        req.session.playerId = player.player_id;
        req.session.username = player.username;

        res.json({
            success: true,
            player_id: player.player_id,
            username: player.username,
            message: 'Welcome, Prisoner.'
        });

    } catch (err) {
        // Check if username already exists
        if (err.code === '23505') { // unique_violation PostgreSQL error code
            return res.status(409).json({ error: 'Username already taken' });
        }
        console.error('Register error:', err.message);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// POST /api/auth/login
// Logs in an existing player
router.post('/login', async (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ error: 'Username required' });
    }

    try {
        const result = await wardenPool.query(
            'SELECT player_id, username, current_room, completed_at FROM warden.players WHERE username = $1 AND is_active = TRUE',
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Player not found. Register first.' });
        }

        const player = result.rows[0];
        req.session.playerId = player.player_id;
        req.session.username = player.username;

        res.json({
            success: true,
            player_id: player.player_id,
            username: player.username,
            current_room: player.current_room,
            completed: player.completed_at !== null
        });

    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ error: 'Login failed' });
    }
});

// GET /api/auth/me
// Returns current session player info
router.get('/me', async (req, res) => {
    if (!req.session.playerId) {
        return res.status(401).json({ error: 'Not logged in' });
    }

    try {
        const result = await wardenPool.query(
            'SELECT warden.get_my_status($1) AS status',
            [req.session.playerId]
        );
        res.json(result.rows[0].status);
    } catch (err) {
        res.status(500).json({ error: 'Could not fetch status' });
    }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true, message: 'Session ended.' });
    });
});

module.exports = router;
```

### Step 3.5 — Game Routes

```javascript
// backend/routes/game.js
// All game mechanics: room status, unlock attempts, fragments

const express = require('express');
const router  = express.Router();
const { wardenPool } = require('../db');

// Middleware: require login for all game routes
const requireLogin = (req, res, next) => {
    if (!req.session.playerId) {
        return res.status(401).json({ error: 'You must be logged in to play.' });
    }
    next();
};

router.use(requireLogin);

// GET /api/game/status
// Returns full player progress: which rooms are complete, current room, fragments
router.get('/status', async (req, res) => {
    const playerId = req.session.playerId;

    try {
        // Get player info
        const playerResult = await wardenPool.query(
            `SELECT player_id, username, current_room, created_at, completed_at
             FROM warden.players WHERE player_id = $1`,
            [playerId]
        );

        // Get completed rooms
        const roomsResult = await wardenPool.query(
            `SELECT room_name, solved_at, attempts, time_taken
             FROM warden.room_log
             WHERE player_id = $1
             ORDER BY solved_at`,
            [playerId]
        );

        // Get attempt counts per room
        const attemptsResult = await wardenPool.query(
            `SELECT room_name, COUNT(*) as total, SUM(CASE WHEN correct THEN 1 ELSE 0 END) as correct_count
             FROM warden.attempt_log
             WHERE player_id = $1
             GROUP BY room_name`,
            [playerId]
        );

        const player = playerResult.rows[0];
        const completedRooms = roomsResult.rows.map(r => r.room_name);

        // Build room status array
        const allRooms = ['lobby', 'corridor', 'vault', 'server_room', 'escape'];
        const roomStatus = allRooms.map(room => ({
            name: room,
            completed: completedRooms.includes(room),
            unlocked: isRoomUnlocked(room, completedRooms),
            completedAt: roomsResult.rows.find(r => r.room_name === room)?.solved_at || null,
            attempts: attemptsResult.rows.find(r => r.room_name === room)?.total || 0
        }));

        res.json({
            player: {
                id: player.player_id,
                username: player.username,
                currentRoom: player.current_room,
                startedAt: player.created_at,
                completedAt: player.completed_at,
                escaped: player.completed_at !== null
            },
            rooms: roomStatus
        });

    } catch (err) {
        console.error('Status error:', err.message);
        res.status(500).json({ error: 'Could not fetch status' });
    }
});

// Helper: determine if a room is unlocked based on completions
function isRoomUnlocked(room, completedRooms) {
    const order = ['lobby', 'corridor', 'vault', 'server_room', 'escape'];
    const idx = order.indexOf(room);
    if (idx === 0) return true;  // lobby always unlocked
    return completedRooms.includes(order[idx - 1]);
}

// POST /api/game/unlock
// Submit an answer for a room
// Body: { room: 'lobby', answer: 'MARCUS_VOID_KNOWS' }
router.post('/unlock', async (req, res) => {
    const { room, answer } = req.body;
    const playerId = req.session.playerId;

    if (!room || !answer) {
        return res.status(400).json({ error: 'room and answer are required' });
    }

    const validRooms = ['lobby', 'corridor', 'vault', 'server_room'];
    if (!validRooms.includes(room)) {
        return res.status(400).json({ error: 'Invalid room name' });
    }

    try {
        let result;
        // Each room has its own unlock function
        // vault needs special transaction handling
        if (room === 'vault') {
            // Simulate the transaction requirement for vault
            const client = await wardenPool.connect();
            try {
                await client.query('BEGIN');
                await client.query("SELECT set_config('vault.transaction_ready', 'yes', TRUE)");
                result = await client.query(
                    'SELECT vault.attempt_unlock($1, $2) AS result',
                    [playerId, answer]
                );
                await client.query('COMMIT');
            } catch (e) {
                await client.query('ROLLBACK');
                throw e;
            } finally {
                client.release();
            }
        } else if (room === 'server_room') {
            result = await wardenPool.query(
                'SELECT server_room.attempt_unlock($1) AS result',
                [playerId]
            );
        } else {
            result = await wardenPool.query(
                `SELECT ${room}.attempt_unlock($1, $2) AS result`,
                [playerId, answer]
            );
        }

        res.json(result.rows[0].result);

    } catch (err) {
        console.error('Unlock error:', err.message);
        res.status(500).json({ error: 'Unlock attempt failed: ' + err.message });
    }
});

// POST /api/game/escape
// Final room: submit assembled key
// Body: { key: 'ALPHA-BRAVO-CHARLIE-DELTA' }
router.post('/escape', async (req, res) => {
    const { key } = req.body;
    const playerId = req.session.playerId;

    if (!key) return res.status(400).json({ error: 'key is required' });

    try {
        const result = await wardenPool.query(
            'SELECT escape.complete_game($1, $2) AS result',
            [playerId, key]
        );
        res.json(result.rows[0].result);
    } catch (err) {
        res.status(500).json({ error: 'Escape attempt failed: ' + err.message });
    }
});

// GET /api/game/leaderboard
// Top 10 completions
router.get('/leaderboard', async (req, res) => {
    try {
        const result = await wardenPool.query(`
            SELECT
                p.username,
                p.completed_at - p.created_at AS total_time,
                p.completed_at,
                COUNT(rl.log_id) AS rooms_completed,
                (SELECT COUNT(*) FROM warden.attempt_log al
                 WHERE al.player_id = p.player_id AND al.correct = FALSE) AS wrong_attempts
            FROM warden.players p
            LEFT JOIN warden.room_log rl ON rl.player_id = p.player_id
            WHERE p.completed_at IS NOT NULL
            GROUP BY p.player_id, p.username, p.completed_at, p.created_at
            ORDER BY total_time ASC
            LIMIT 10
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Could not fetch leaderboard' });
    }
});

module.exports = router;
```

### Step 3.6 — Safe SQL Query Executor Route

This is the route that lets the web frontend run SQL queries safely.

```javascript
// backend/routes/query.js
// Allows players to execute SQL queries via the web interface
// SECURITY: only SELECT statements allowed, no DDL or DML that bypasses the game

const express = require('express');
const router  = express.Router();
const { prisonerPool } = require('../db');

const requireLogin = (req, res, next) => {
    if (!req.session.playerId) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    next();
};

router.use(requireLogin);

// POST /api/query/run
// Runs a SQL query as the prisoner role
// Body: { sql: 'SELECT * FROM lobby.staff_directory' }
router.post('/run', async (req, res) => {
    const { sql } = req.body;

    if (!sql || sql.trim() === '') {
        return res.status(400).json({ error: 'No SQL provided' });
    }

    // Basic safety check: block dangerous statements
    // This is NOT foolproof - it is a teaching aid, not production security
    const upperSQL = sql.trim().toUpperCase();
    const blocked = ['DROP ', 'TRUNCATE ', 'DELETE ', 'CREATE ROLE', 'ALTER ROLE',
                     'GRANT ', 'REVOKE ', 'COPY ', 'DO $$'];

    // Allow SELECT, CALL, BEGIN, COMMIT, and safe INSERTs for puzzle functions
    const allowed = ['SELECT ', 'BEGIN', 'COMMIT', 'ROLLBACK', 'CALL ', 'INSERT INTO SERVER_ROOM'];

    const isBlocked = blocked.some(b => upperSQL.includes(b));
    if (isBlocked) {
        return res.status(403).json({
            error: 'That statement is not permitted through this interface.',
            hint: 'Use the psql terminal for administrative commands.'
        });
    }

    const start = Date.now();
    try {
        const result = await prisonerPool.query(sql);
        const duration = Date.now() - start;

        res.json({
            success: true,
            rows: result.rows,
            rowCount: result.rowCount,
            fields: result.fields ? result.fields.map(f => ({
                name: f.name,
                dataType: f.dataTypeID
            })) : [],
            duration: duration + 'ms',
            command: result.command  // 'SELECT', 'INSERT', etc.
        });

    } catch (err) {
        // Send the PostgreSQL error back to the player - this is intentional
        // Seeing real error messages is part of learning
        res.status(400).json({
            success: false,
            error: err.message,
            detail: err.detail || null,
            hint: err.hint || null,
            position: err.position || null
        });
    }
});

// GET /api/query/schemas
// Returns list of schemas the player has access to
router.get('/schemas', async (req, res) => {
    try {
        const result = await prisonerPool.query(`
            SELECT schema_name
            FROM information_schema.schemata
            WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
            ORDER BY schema_name
        `);
        res.json(result.rows.map(r => r.schema_name));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/query/tables/:schema
// Returns tables in a schema (if player has access)
router.get('/tables/:schema', async (req, res) => {
    const { schema } = req.params;
    // Validate schema name to prevent injection
    if (!/^[a-z_]+$/.test(schema)) {
        return res.status(400).json({ error: 'Invalid schema name' });
    }

    try {
        const result = await prisonerPool.query(`
            SELECT table_name, table_type
            FROM information_schema.tables
            WHERE table_schema = $1
            ORDER BY table_name
        `, [schema]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
```

### Step 3.7 — Main Server File

```javascript
// backend/server.js
const express       = require('express');
const session       = require('express-session');
const cors          = require('cors');
const path          = require('path');
require('dotenv').config();

const authRoutes    = require('./routes/auth');
const gameRoutes    = require('./routes/game');
const queryRoutes   = require('./routes/query');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());  // parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // parse form data

// CORS: allow frontend (port 5500 or 3000) to call this backend (port 3001)
app.use(cors({
    origin: ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:3000'],
    credentials: true  // allow cookies (needed for sessions)
}));

// Sessions: remembers who is logged in between requests
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback_secret_change_this',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,   // set to true in production with HTTPS
        httpOnly: true,  // prevent JavaScript from reading the cookie
        maxAge: 24 * 60 * 60 * 1000  // 24 hours
    }
}));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',  authRoutes);
app.use('/api/game',  gameRoutes);
app.use('/api/query', queryRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

// Catch-all: serve frontend for any unmatched route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── Start Server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`EscapeQL backend running on http://localhost:${PORT}`);
    console.log(`API available at http://localhost:${PORT}/api`);
});
```

Add to `backend/package.json` scripts section:
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

---

## PHASE 4 — Web Frontend

### Step 4.1 — Login Page

```html
<!-- frontend/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EscapeQL</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body class="login-page">

    <div class="login-container">
        <div class="logo-area">
            <h1 class="game-title">EscapeQL</h1>
            <p class="tagline">The database IS the game</p>
        </div>

        <div class="terminal-box">
            <div class="terminal-bar">
                <span class="dot red"></span>
                <span class="dot yellow"></span>
                <span class="dot green"></span>
                <span class="terminal-title">prisoner@escape-room:~$</span>
            </div>
            <div class="terminal-body">
                <p class="terminal-text">
                    > Connecting to escape_room...<br>
                    > Connection established.<br>
                    > Awaiting identification.
                </p>
            </div>
        </div>

        <div class="auth-forms">
            <div class="tab-buttons">
                <button class="tab-btn active" onclick="switchTab('login')">Login</button>
                <button class="tab-btn" onclick="switchTab('register')">Register</button>
            </div>

            <!-- Login Form -->
            <div id="login-form" class="form-panel active">
                <div class="form-group">
                    <label for="login-username">Username</label>
                    <input type="text" id="login-username" placeholder="Enter your username" autocomplete="off">
                </div>
                <button class="btn-primary" onclick="login()">Enter the Room</button>
                <p id="login-error" class="error-msg"></p>
            </div>

            <!-- Register Form -->
            <div id="register-form" class="form-panel">
                <div class="form-group">
                    <label for="reg-username">Choose a Username</label>
                    <input type="text" id="reg-username" placeholder="Letters, numbers, underscores only" autocomplete="off">
                </div>
                <button class="btn-primary" onclick="register()">Register as Prisoner</button>
                <p id="reg-error" class="error-msg"></p>
            </div>
        </div>
    </div>

    <script src="js/auth.js"></script>
</body>
</html>
```

### Step 4.2 — Game Dashboard

```html
<!-- frontend/game.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>EscapeQL - Game</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body class="game-page">

    <!-- Top Bar -->
    <header class="topbar">
        <div class="topbar-left">
            <span class="game-logo">EscapeQL</span>
        </div>
        <div class="topbar-center">
            <span id="player-name">Loading...</span>
        </div>
        <div class="topbar-right">
            <button class="btn-small" onclick="openLeaderboard()">Leaderboard</button>
            <button class="btn-small btn-danger" onclick="logout()">Exit</button>
        </div>
    </header>

    <div class="game-layout">

        <!-- Left Panel: Room Map -->
        <aside class="room-panel">
            <h3 class="panel-title">Rooms</h3>
            <div class="room-list" id="room-list">
                <!-- Populated by JS -->
            </div>
            <div class="progress-bar-container">
                <div class="progress-label">Escape Progress</div>
                <div class="progress-bar">
                    <div class="progress-fill" id="progress-fill"></div>
                </div>
                <span id="progress-text">0 / 5</span>
            </div>
        </aside>

        <!-- Center Panel: SQL Terminal -->
        <main class="terminal-panel">
            <div class="terminal-header">
                <div class="terminal-dots">
                    <span class="dot red"></span>
                    <span class="dot yellow"></span>
                    <span class="dot green"></span>
                </div>
                <span class="terminal-path" id="terminal-path">prisoner@escape_room:lobby#</span>
            </div>

            <div class="terminal-output" id="terminal-output">
                <div class="output-line system">Welcome, Prisoner. The schema never lies.</div>
                <div class="output-line system">Type SQL and press Run, or use the hint panel on the right.</div>
                <div class="output-line system">Start with: SELECT * FROM lobby.staff_directory;</div>
            </div>

            <div class="terminal-input-area">
                <textarea
                    id="sql-input"
                    class="sql-input"
                    placeholder="Enter SQL query here..."
                    rows="4"
                    spellcheck="false"
                ></textarea>
                <div class="input-controls">
                    <button class="btn-run" onclick="runQuery()">Run Query (F5)</button>
                    <button class="btn-clear" onclick="clearOutput()">Clear</button>
                    <span class="query-timer" id="query-timer"></span>
                </div>
            </div>

            <!-- Answer Submission Area -->
            <div class="answer-area" id="answer-area">
                <h4>Submit Answer for <span id="current-room-label">lobby</span></h4>
                <div class="answer-row">
                    <input type="text" id="answer-input" placeholder="Your answer..." autocomplete="off">
                    <button class="btn-submit" onclick="submitAnswer()">Submit</button>
                </div>
                <p id="answer-feedback" class="answer-feedback"></p>
            </div>

            <!-- Final Room: Assemble Key -->
            <div class="escape-area hidden" id="escape-area">
                <h4>Final Room: Assemble Your Key</h4>
                <p class="escape-hint">Combine your fragments in order, separated by hyphens.</p>
                <div class="fragment-display" id="fragment-display"></div>
                <div class="answer-row">
                    <input type="text" id="escape-key-input" placeholder="FRAGMENT1-FRAGMENT2-FRAGMENT3-FRAGMENT4">
                    <button class="btn-submit btn-escape" onclick="attemptEscape()">Decrypt and Escape</button>
                </div>
                <p id="escape-feedback" class="answer-feedback"></p>
            </div>
        </main>

        <!-- Right Panel: Hints and Info -->
        <aside class="hint-panel">
            <h3 class="panel-title">Room Guide</h3>
            <div id="room-hint-content">
                <!-- Populated by JS based on current room -->
            </div>

            <div class="fragments-section">
                <h4>Key Fragments Collected</h4>
                <div id="fragments-list" class="fragments-list">
                    <!-- Populated by JS -->
                </div>
            </div>

            <div class="quick-commands">
                <h4>Quick Commands</h4>
                <div class="cmd-list">
                    <button class="cmd-btn" onclick="insertSQL('SELECT * FROM lobby.staff_directory;')">
                        List staff
                    </button>
                    <button class="cmd-btn" onclick="insertSQL('SELECT definition FROM pg_views WHERE viewname = \'camera_feeds\';')">
                        Inspect view
                    </button>
                    <button class="cmd-btn" onclick="insertSQL('SELECT schema_name FROM information_schema.schemata;')">
                        List schemas
                    </button>
                    <button class="cmd-btn" onclick="insertSQL('SELECT table_name FROM information_schema.tables WHERE table_schema = \'lobby\';')">
                        Lobby tables
                    </button>
                </div>
            </div>
        </aside>

    </div>

    <!-- Leaderboard Modal -->
    <div id="leaderboard-modal" class="modal hidden">
        <div class="modal-content">
            <div class="modal-header">
                <h3>Leaderboard - Fastest Escapes</h3>
                <button class="modal-close" onclick="closeLeaderboard()">x</button>
            </div>
            <div class="modal-body" id="leaderboard-body">
                Loading...
            </div>
        </div>
    </div>

    <script src="js/game.js"></script>
</body>
</html>
```

### Step 4.3 — CSS Stylesheet

```css
/* frontend/css/style.css */

/* ── Reset and Base ─────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
    --bg:         #0f0f13;
    --bg2:        #16161d;
    --bg3:        #1e1e28;
    --border:     #2a2a3a;
    --accent:     #4a9eff;
    --accent2:    #2d6bbf;
    --green:      #4caf7d;
    --red:        #e05252;
    --yellow:     #e8c547;
    --text:       #d4d4dc;
    --text-dim:   #7a7a8e;
    --font-mono:  'Courier New', Courier, monospace;
    --font-sans:  -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

body { background: var(--bg); color: var(--text);
       font-family: var(--font-sans); min-height: 100vh; }

/* ── Login Page ─────────────────────────────────────────── */
.login-page {
    display: flex; align-items: center; justify-content: center;
    background: radial-gradient(ellipse at center, #1a1a2e 0%, #0f0f13 70%);
}

.login-container {
    width: 400px; display: flex; flex-direction: column; gap: 20px;
}

.logo-area { text-align: center; }
.game-title { font-size: 3rem; font-weight: 800; color: var(--accent);
              font-family: var(--font-mono); letter-spacing: 2px; }
.tagline { color: var(--text-dim); font-style: italic; margin-top: 4px; }

/* Terminal decorative box on login */
.terminal-box { background: var(--bg2); border: 1px solid var(--border);
                border-radius: 6px; overflow: hidden; }
.terminal-bar { background: var(--bg3); padding: 8px 12px;
                display: flex; align-items: center; gap: 6px; }
.dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.dot.red    { background: var(--red); }
.dot.yellow { background: var(--yellow); }
.dot.green  { background: var(--green); }
.terminal-title { margin-left: 8px; font-family: var(--font-mono);
                  font-size: 0.75rem; color: var(--text-dim); }
.terminal-body { padding: 12px; }
.terminal-text { font-family: var(--font-mono); font-size: 0.78rem;
                 color: var(--green); line-height: 1.6; }

/* Auth forms */
.auth-forms { background: var(--bg2); border: 1px solid var(--border);
              border-radius: 6px; padding: 20px; }
.tab-buttons { display: flex; gap: 4px; margin-bottom: 16px; }
.tab-btn { flex: 1; padding: 8px; background: transparent;
           border: 1px solid var(--border); color: var(--text-dim);
           cursor: pointer; border-radius: 4px; transition: all 0.2s; }
.tab-btn.active { background: var(--accent2); color: white; border-color: var(--accent); }

.form-panel { display: none; }
.form-panel.active { display: block; }
.form-group { margin-bottom: 14px; }
.form-group label { display: block; margin-bottom: 5px;
                    font-size: 0.85rem; color: var(--text-dim); }
.form-group input { width: 100%; padding: 10px 12px;
                    background: var(--bg3); border: 1px solid var(--border);
                    color: var(--text); border-radius: 4px; font-size: 0.9rem;
                    font-family: var(--font-mono); }
.form-group input:focus { outline: none; border-color: var(--accent); }

.btn-primary { width: 100%; padding: 10px; background: var(--accent2);
               color: white; border: none; border-radius: 4px;
               cursor: pointer; font-size: 0.9rem; font-weight: 600;
               transition: background 0.2s; }
.btn-primary:hover { background: var(--accent); }

.error-msg { color: var(--red); font-size: 0.8rem; margin-top: 8px;
             min-height: 18px; }

/* ── Game Page ──────────────────────────────────────────── */
.game-page { display: flex; flex-direction: column; height: 100vh; }

.topbar { background: var(--bg2); border-bottom: 1px solid var(--border);
          padding: 10px 20px; display: flex; align-items: center;
          justify-content: space-between; }
.game-logo { font-family: var(--font-mono); font-weight: 800;
             color: var(--accent); font-size: 1.1rem; }
#player-name { color: var(--text-dim); font-size: 0.85rem; }
.btn-small { padding: 5px 12px; background: var(--bg3); color: var(--text);
             border: 1px solid var(--border); border-radius: 4px;
             cursor: pointer; font-size: 0.8rem; margin-left: 6px; }
.btn-small:hover { border-color: var(--accent); color: var(--accent); }
.btn-danger { border-color: var(--red) !important; color: var(--red) !important; }

.game-layout { flex: 1; display: grid;
               grid-template-columns: 200px 1fr 240px;
               overflow: hidden; }

/* Left panel: rooms */
.room-panel { background: var(--bg2); border-right: 1px solid var(--border);
              padding: 16px; overflow-y: auto; }
.panel-title { font-size: 0.75rem; text-transform: uppercase;
               letter-spacing: 1px; color: var(--text-dim);
               margin-bottom: 12px; }

.room-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 20px; }
.room-item { padding: 8px 10px; border-radius: 4px; font-size: 0.82rem;
             font-family: var(--font-mono); cursor: pointer;
             border: 1px solid transparent; transition: all 0.2s; }
.room-item.completed  { background: rgba(76,175,125,0.1);
                        border-color: var(--green); color: var(--green); }
.room-item.current    { background: rgba(74,158,255,0.1);
                        border-color: var(--accent); color: var(--accent); }
.room-item.locked     { color: var(--text-dim); border-color: var(--border); }
.room-item.unlocked   { color: var(--text); border-color: var(--border); }

.progress-bar-container { margin-top: auto; }
.progress-label { font-size: 0.72rem; color: var(--text-dim); margin-bottom: 5px; }
.progress-bar { height: 6px; background: var(--bg3); border-radius: 3px;
                overflow: hidden; }
.progress-fill { height: 100%; background: var(--accent);
                 transition: width 0.5s ease; width: 0%; }
#progress-text { font-size: 0.72rem; color: var(--text-dim); }

/* Center: terminal */
.terminal-panel { display: flex; flex-direction: column;
                  background: var(--bg); overflow: hidden; }
.terminal-header { background: var(--bg3); padding: 8px 14px;
                   display: flex; align-items: center; gap: 8px;
                   border-bottom: 1px solid var(--border); }
.terminal-dots { display: flex; gap: 5px; }
.terminal-path { font-family: var(--font-mono); font-size: 0.75rem;
                 color: var(--green); margin-left: 8px; }

.terminal-output { flex: 1; overflow-y: auto; padding: 14px;
                   font-family: var(--font-mono); font-size: 0.82rem;
                   line-height: 1.55; }
.output-line { margin-bottom: 2px; }
.output-line.system  { color: var(--text-dim); }
.output-line.sql     { color: var(--accent); }
.output-line.success { color: var(--green); }
.output-line.error   { color: var(--red); }
.output-line.result  { color: var(--text); }

/* Results table in terminal */
.result-table { border-collapse: collapse; margin: 6px 0; font-size: 0.78rem; }
.result-table th { background: var(--bg3); padding: 4px 10px;
                   text-align: left; color: var(--accent);
                   border-bottom: 1px solid var(--border); }
.result-table td { padding: 3px 10px; border-bottom: 1px solid var(--border);
                   color: var(--text); }
.result-table tr:hover td { background: var(--bg2); }
.null-value { color: var(--text-dim); font-style: italic; }

.terminal-input-area { border-top: 1px solid var(--border); padding: 12px; }
.sql-input { width: 100%; background: var(--bg2); border: 1px solid var(--border);
             color: var(--text); border-radius: 4px; padding: 10px;
             font-family: var(--font-mono); font-size: 0.83rem;
             resize: vertical; outline: none; }
.sql-input:focus { border-color: var(--accent); }
.input-controls { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.btn-run   { padding: 7px 16px; background: var(--accent2); color: white;
             border: none; border-radius: 4px; cursor: pointer;
             font-weight: 600; font-size: 0.82rem; }
.btn-run:hover { background: var(--accent); }
.btn-clear { padding: 7px 12px; background: transparent;
             color: var(--text-dim); border: 1px solid var(--border);
             border-radius: 4px; cursor: pointer; font-size: 0.82rem; }
.query-timer { font-size: 0.75rem; color: var(--text-dim);
               font-family: var(--font-mono); }

/* Answer and escape areas */
.answer-area, .escape-area {
    border-top: 1px solid var(--border); padding: 12px;
    background: var(--bg2);
}
.answer-area h4, .escape-area h4 {
    font-size: 0.82rem; color: var(--text-dim);
    text-transform: uppercase; letter-spacing: 0.5px;
    margin-bottom: 8px;
}
.answer-row { display: flex; gap: 8px; }
.answer-row input { flex: 1; padding: 8px 10px; background: var(--bg3);
                    border: 1px solid var(--border); color: var(--text);
                    border-radius: 4px; font-family: var(--font-mono);
                    font-size: 0.85rem; }
.answer-row input:focus { outline: none; border-color: var(--accent); }
.btn-submit { padding: 8px 16px; background: var(--green); color: white;
              border: none; border-radius: 4px; cursor: pointer;
              font-weight: 600; font-size: 0.82rem; white-space: nowrap; }
.btn-escape { background: var(--accent) !important; }
.answer-feedback { font-size: 0.8rem; margin-top: 6px; min-height: 18px; }

/* Right panel: hints */
.hint-panel { background: var(--bg2); border-left: 1px solid var(--border);
              padding: 16px; overflow-y: auto; font-size: 0.82rem; }
#room-hint-content p { color: var(--text); line-height: 1.5; margin-bottom: 8px; }
.hint-step { background: var(--bg3); border-left: 2px solid var(--accent);
             padding: 8px 10px; margin: 6px 0; border-radius: 0 4px 4px 0;
             font-size: 0.78rem; }

.fragments-section { margin-top: 16px; border-top: 1px solid var(--border);
                     padding-top: 12px; }
.fragments-section h4 { font-size: 0.72rem; text-transform: uppercase;
                        letter-spacing: 1px; color: var(--text-dim);
                        margin-bottom: 8px; }
.fragment-item { background: rgba(76,175,125,0.1); border: 1px solid var(--green);
                 color: var(--green); border-radius: 4px; padding: 4px 8px;
                 font-family: var(--font-mono); font-size: 0.78rem;
                 margin-bottom: 4px; }
.fragment-empty { color: var(--text-dim); font-style: italic; font-size: 0.78rem; }

.quick-commands { margin-top: 16px; border-top: 1px solid var(--border);
                  padding-top: 12px; }
.quick-commands h4 { font-size: 0.72rem; text-transform: uppercase;
                     letter-spacing: 1px; color: var(--text-dim); margin-bottom: 8px; }
.cmd-list { display: flex; flex-direction: column; gap: 4px; }
.cmd-btn { padding: 6px 8px; background: var(--bg3); color: var(--text-dim);
           border: 1px solid var(--border); border-radius: 4px;
           cursor: pointer; text-align: left; font-size: 0.75rem;
           font-family: var(--font-mono); transition: all 0.15s; }
.cmd-btn:hover { border-color: var(--accent); color: var(--accent); }

/* Modal */
.modal { position: fixed; inset: 0; background: rgba(0,0,0,0.7);
         display: flex; align-items: center; justify-content: center;
         z-index: 100; }
.modal.hidden { display: none; }
.modal-content { background: var(--bg2); border: 1px solid var(--border);
                 border-radius: 8px; width: 560px; max-width: 90vw; }
.modal-header { padding: 16px 20px; border-bottom: 1px solid var(--border);
                display: flex; justify-content: space-between; align-items: center; }
.modal-header h3 { font-size: 1rem; }
.modal-close { background: none; border: none; color: var(--text-dim);
               cursor: pointer; font-size: 1.1rem; padding: 0; }
.modal-body { padding: 16px 20px; }

.leaderboard-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
.leaderboard-table th { color: var(--text-dim); text-align: left;
                         padding: 6px 10px; font-size: 0.72rem;
                         text-transform: uppercase; letter-spacing: 0.5px; }
.leaderboard-table td { padding: 7px 10px;
                         border-top: 1px solid var(--border); }
.rank-1 { color: var(--yellow); font-weight: 700; }
.hidden { display: none !important; }
```

### Step 4.4 — Frontend JavaScript

```javascript
// frontend/js/auth.js
const API = 'http://localhost:3001/api';

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.form-panel').forEach(p => p.classList.remove('active'));
    document.querySelector(`#${tab}-form`).classList.add('active');
    event.target.classList.add('active');
}

async function login() {
    const username = document.getElementById('login-username').value.trim();
    const errorEl = document.getElementById('login-error');
    errorEl.textContent = '';

    if (!username) { errorEl.textContent = 'Enter a username.'; return; }

    try {
        const res = await fetch(`${API}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',   // important: sends the session cookie
            body: JSON.stringify({ username })
        });
        const data = await res.json();
        if (data.error) { errorEl.textContent = data.error; return; }
        window.location.href = 'game.html';
    } catch (err) {
        errorEl.textContent = 'Could not connect to server. Is it running?';
    }
}

async function register() {
    const username = document.getElementById('reg-username').value.trim();
    const errorEl = document.getElementById('reg-error');
    errorEl.textContent = '';

    if (!username) { errorEl.textContent = 'Enter a username.'; return; }

    try {
        const res = await fetch(`${API}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username })
        });
        const data = await res.json();
        if (data.error) { errorEl.textContent = data.error; return; }
        window.location.href = 'game.html';
    } catch (err) {
        errorEl.textContent = 'Could not connect to server.';
    }
}

// Check if already logged in
(async () => {
    try {
        const res = await fetch(`${API}/auth/me`, { credentials: 'include' });
        if (res.ok) window.location.href = 'game.html';
    } catch (e) {}
})();
```

```javascript
// frontend/js/game.js
const API = 'http://localhost:3001/api';

let playerState = null;
let collectedFragments = {};

const roomHints = {
    lobby: {
        title: 'Room 1: The Lobby',
        description: 'Someone on the staff left no trace. Find who has no access code.',
        steps: [
            'Run: SELECT * FROM lobby.staff_directory;',
            'Find the row with NULL in access_code.',
            'Use \\d+ lobby.staff_directory to read column comments.',
            'Join with hint_board using that person name.',
            'Submit the passphrase you find.'
        ]
    },
    corridor: {
        title: 'Room 2: The Corridor',
        description: 'The cameras do not show everything. Question the view.',
        steps: [
            'Run: SELECT * FROM corridor.camera_feeds;',
            'Count the doors. Something is missing.',
            'Inspect: SELECT definition FROM pg_views WHERE viewname=\'camera_feeds\';',
            'Query the base table directly: corridor.door_log',
            'Find the hidden door, cross-reference maintenance_notes.',
            'Submit the secret_code from the hidden door.'
        ]
    },
    vault: {
        title: 'Room 3: The Vault',
        description: 'The same person appears three times. One address is the truth.',
        steps: [
            'Run: SELECT * FROM vault.safety_deposit_boxes;',
            'Find the owner who appears 3 times with different addresses.',
            'The consistent address satisfies the functional dependency.',
            'You must submit INSIDE a transaction:',
            'BEGIN; SELECT vault.set_ready(); SELECT vault.attempt_unlock(YOUR_ID, \'CODE\'); COMMIT;'
        ]
    },
    server_room: {
        title: 'Room 4: The Server Room',
        description: 'The trigger is broken. Find the bug and fix it.',
        steps: [
            'Read: SELECT prosrc FROM pg_proc WHERE proname=\'unlock_hatch\';',
            'Or: SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname=\'unlock_hatch\';',
            'Find the column name that does not exist.',
            'Check actual column names: SELECT column_name FROM information_schema.columns WHERE table_name=\'hatch\';',
            'Rewrite the function with the correct column name.',
            'INSERT INTO server_room.authorization_log(auth_id, status, operator) VALUES(\'KEY-001\', \'AUTHORIZED\', \'your_name\');',
            'Then call: SELECT server_room.attempt_unlock(YOUR_ID);'
        ]
    },
    escape: {
        title: 'Final Room: Escape',
        description: 'One message. Four fragments. One key.',
        steps: [
            'Assemble fragments from all rooms in order.',
            'Format: FRAG1-FRAG2-FRAG3-FRAG4',
            'Use the Decrypt and Escape button below.',
            'Or in psql: SELECT convert_from(pgp_sym_decrypt(message, \'KEY\'), \'UTF8\') FROM escape.freedom;'
        ]
    }
};

// ── Init ──────────────────────────────────────────────────
(async () => {
    try {
        const res = await fetch(`${API}/auth/me`, { credentials: 'include' });
        if (!res.ok) { window.location.href = 'index.html'; return; }
        await loadGameState();
    } catch (e) {
        window.location.href = 'index.html';
    }
})();

async function loadGameState() {
    try {
        const res = await fetch(`${API}/game/status`, { credentials: 'include' });
        const data = await res.json();
        playerState = data;
        renderAll();
    } catch (err) {
        addOutputLine('error', 'Failed to load game state: ' + err.message);
    }
}

function renderAll() {
    if (!playerState) return;
    const p = playerState.player;
    document.getElementById('player-name').textContent =
        `prisoner: ${p.username} | ${p.currentRoom}`;
    document.getElementById('terminal-path').textContent =
        `prisoner@escape_room:${p.currentRoom}#`;
    document.getElementById('current-room-label').textContent = p.currentRoom;

    renderRoomList();
    renderHintPanel();
    renderFragments();
    renderProgress();

    // Show escape area if on escape schema
    if (p.currentRoom === 'escape' || p.currentRoom === 'ESCAPED') {
        document.getElementById('answer-area').classList.add('hidden');
        document.getElementById('escape-area').classList.remove('hidden');
    }
}

function renderRoomList() {
    const list = document.getElementById('room-list');
    list.innerHTML = '';
    playerState.rooms.forEach(room => {
        const div = document.createElement('div');
        let cls = 'room-item ';
        if (room.completed) cls += 'completed';
        else if (room.name === playerState.player.currentRoom) cls += 'current';
        else if (room.unlocked) cls += 'unlocked';
        else cls += 'locked';

        const icon = room.completed ? 'OK' : (room.locked ? 'LOCK' : '>');
        div.className = cls;
        div.textContent = `[${icon}] ${room.name}`;
        if (room.attempts > 0) {
            div.title = `Attempts: ${room.attempts}`;
        }
        list.appendChild(div);
    });
}

function renderHintPanel() {
    const current = playerState.player.currentRoom;
    const hint = roomHints[current];
    if (!hint) return;

    const el = document.getElementById('room-hint-content');
    el.innerHTML = `
        <p><strong>${hint.title}</strong></p>
        <p style="color:var(--text-dim); margin-bottom:10px;">${hint.description}</p>
        ${hint.steps.map((s, i) => `<div class="hint-step">${i+1}. ${s}</div>`).join('')}
    `;
}

function renderFragments() {
    const el = document.getElementById('fragments-list');
    const fragDisplay = document.getElementById('fragment-display');
    const rooms = ['lobby', 'corridor', 'vault', 'server_room'];
    const completed = playerState.rooms.filter(r => r.completed).map(r => r.name);

    el.innerHTML = '';
    rooms.forEach((r, i) => {
        const div = document.createElement('div');
        if (completed.includes(r) && collectedFragments[r]) {
            div.className = 'fragment-item';
            div.textContent = `${i+1}. ${collectedFragments[r]}`;
        } else if (completed.includes(r)) {
            div.className = 'fragment-item';
            div.textContent = `${i+1}. (check your answers)`;
        } else {
            div.className = 'fragment-empty';
            div.textContent = `${i+1}. locked`;
        }
        el.appendChild(div);
    });

    if (fragDisplay) {
        const assembled = rooms.map(r => collectedFragments[r] || '???').join('-');
        fragDisplay.textContent = assembled;
    }
}

function renderProgress() {
    const total = 5;
    const done = playerState.rooms.filter(r => r.completed).length;
    const pct = (done / total) * 100;
    document.getElementById('progress-fill').style.width = pct + '%';
    document.getElementById('progress-text').textContent = `${done} / ${total}`;
}

// ── SQL Terminal ──────────────────────────────────────────
async function runQuery() {
    const sql = document.getElementById('sql-input').value.trim();
    if (!sql) return;

    addOutputLine('sql', '> ' + sql);

    try {
        const start = Date.now();
        const res = await fetch(`${API}/query/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ sql })
        });
        const data = await res.json();
        const elapsed = Date.now() - start;
        document.getElementById('query-timer').textContent = elapsed + 'ms';

        if (!data.success) {
            addOutputLine('error', 'ERROR: ' + data.error);
            if (data.hint) addOutputLine('error', 'HINT: ' + data.hint);
            return;
        }

        if (data.rows && data.rows.length > 0) {
            addTableOutput(data.fields, data.rows);
            addOutputLine('system', `(${data.rowCount} row${data.rowCount !== 1 ? 's' : ''})`);
        } else {
            addOutputLine('success', `OK: ${data.command} — ${data.rowCount} rows affected.`);
        }
    } catch (err) {
        addOutputLine('error', 'Request failed: ' + err.message);
    }
}

function addOutputLine(type, text) {
    const out = document.getElementById('terminal-output');
    const div = document.createElement('div');
    div.className = `output-line ${type}`;
    div.textContent = text;
    out.appendChild(div);
    out.scrollTop = out.scrollHeight;
}

function addTableOutput(fields, rows) {
    const out = document.getElementById('terminal-output');
    const table = document.createElement('table');
    table.className = 'result-table';

    // Header row
    const thead = table.createTHead();
    const headerRow = thead.insertRow();
    fields.forEach(f => {
        const th = document.createElement('th');
        th.textContent = f.name;
        headerRow.appendChild(th);
    });

    // Data rows
    const tbody = table.createTBody();
    rows.forEach(row => {
        const tr = tbody.insertRow();
        fields.forEach(f => {
            const td = tr.insertCell();
            const val = row[f.name];
            if (val === null) {
                td.innerHTML = '<span class="null-value">NULL</span>';
            } else {
                td.textContent = String(val);
            }
        });
    });

    out.appendChild(table);
    out.scrollTop = out.scrollHeight;
}

function clearOutput() {
    document.getElementById('terminal-output').innerHTML =
        '<div class="output-line system">Terminal cleared.</div>';
}

function insertSQL(sql) {
    document.getElementById('sql-input').value = sql;
    document.getElementById('sql-input').focus();
}

// Keyboard shortcut: F5 to run query
document.addEventListener('keydown', e => {
    if (e.key === 'F5') { e.preventDefault(); runQuery(); }
});

// ── Answer Submission ─────────────────────────────────────
async function submitAnswer() {
    const answer = document.getElementById('answer-input').value.trim();
    const feedback = document.getElementById('answer-feedback');
    const room = playerState.player.currentRoom;

    if (!answer) { feedback.textContent = 'Enter your answer first.'; return; }
    feedback.textContent = 'Submitting...';
    feedback.style.color = 'var(--text-dim)';

    try {
        const res = await fetch(`${API}/game/unlock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ room, answer })
        });
        const data = await res.json();

        if (data.success) {
            feedback.style.color = 'var(--green)';
            feedback.textContent = data.message;
            addOutputLine('success', '>>> ' + data.message);

            // Store fragment
            if (data.fragment) {
                collectedFragments[room] = data.fragment;
                addOutputLine('success', `Key fragment collected: ${data.fragment}`);
            }

            // Reload game state after short delay
            setTimeout(async () => {
                await loadGameState();
                document.getElementById('answer-input').value = '';
            }, 1000);
        } else {
            feedback.style.color = 'var(--red)';
            feedback.textContent = data.message;
            addOutputLine('error', '>>> ' + data.message);
        }
    } catch (err) {
        feedback.textContent = 'Request failed: ' + err.message;
    }
}

async function attemptEscape() {
    const key = document.getElementById('escape-key-input').value.trim();
    const feedback = document.getElementById('escape-feedback');
    if (!key) { feedback.textContent = 'Enter your assembled key.'; return; }

    feedback.textContent = 'Decrypting...';
    try {
        const res = await fetch(`${API}/game/escape`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ key })
        });
        const data = await res.json();

        if (data.success) {
            feedback.style.color = 'var(--green)';
            feedback.textContent = data.message;
            addOutputLine('success', '>>> ESCAPED: ' + data.message);
        } else {
            feedback.style.color = 'var(--red)';
            feedback.textContent = data.message;
        }
    } catch (err) {
        feedback.textContent = 'Failed: ' + err.message;
    }
}

// ── Leaderboard ───────────────────────────────────────────
async function openLeaderboard() {
    document.getElementById('leaderboard-modal').classList.remove('hidden');
    const body = document.getElementById('leaderboard-body');
    body.innerHTML = 'Loading...';
    try {
        const res = await fetch(`${API}/game/leaderboard`, { credentials: 'include' });
        const rows = await res.json();
        if (rows.length === 0) {
            body.innerHTML = '<p style="color:var(--text-dim)">No completions yet.</p>';
            return;
        }
        body.innerHTML = `
            <table class="leaderboard-table">
                <thead><tr>
                    <th>#</th><th>Player</th><th>Time</th><th>Wrong Attempts</th>
                </tr></thead>
                <tbody>
                    ${rows.map((r, i) => `
                        <tr>
                            <td class="${i===0?'rank-1':''}">${i+1}</td>
                            <td>${r.username}</td>
                            <td>${formatInterval(r.total_time)}</td>
                            <td>${r.wrong_attempts}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>`;
    } catch (err) {
        body.innerHTML = '<p style="color:var(--red)">Could not load leaderboard.</p>';
    }
}

function closeLeaderboard() {
    document.getElementById('leaderboard-modal').classList.add('hidden');
}

function formatInterval(interval) {
    if (!interval) return '--';
    // interval comes from PostgreSQL as a string like '00:12:34.123456'
    const parts = String(interval).split(':');
    if (parts.length >= 2) {
        return `${parts[0]}h ${parts[1]}m`;
    }
    return interval;
}

async function logout() {
    await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' });
    window.location.href = 'index.html';
}
```

---

## PHASE 5 — Running the Project

### Step 5.1 — Run the Database Scripts

```bash
# Run all SQL files in order as postgres superuser
psql -U postgres -f database/00_setup.sql
psql -U warden -d escape_room -f database/01_warden_schema.sql
psql -U warden -d escape_room -f database/02_lobby.sql
psql -U warden -d escape_room -f database/03_corridor.sql
psql -U warden -d escape_room -f database/04_vault.sql
psql -U warden -d escape_room -f database/05_server_room.sql
psql -U warden -d escape_room -f database/06_escape.sql
psql -U warden -d escape_room -f database/07_permissions.sql
```

### Step 5.2 — Start the Backend

```bash
cd escapeql/backend
npm run dev
# Should print: EscapeQL backend running on http://localhost:3001
```

### Step 5.3 — Open the Frontend

Open `frontend/index.html` in a browser, OR use VS Code Live Server extension:
- Install "Live Server" extension in VS Code
- Right-click `index.html` and select "Open with Live Server"
- It opens on `http://127.0.0.1:5500`

### Step 5.4 — Test the Game

1. Register a new player at the login screen
2. Run `SELECT * FROM lobby.staff_directory;` in the SQL terminal
3. Find Marcus Void's NULL row
4. Submit `MARCUS_VOID_KNOWS` as the answer
5. Watch the corridor room unlock

### Step 5.5 — Game Reset Script

```sql
-- database/reset.sql
-- Run this to reset the entire game for a fresh start
-- Run as warden: psql -U warden -d escape_room -f database/reset.sql

-- Remove all player data
TRUNCATE warden.room_log CASCADE;
TRUNCATE warden.attempt_log CASCADE;
TRUNCATE warden.players CASCADE;

-- Reset vault (unchecked boxes)
UPDATE vault.safety_deposit_boxes SET checked_out = FALSE;

-- Reset hatch
UPDATE server_room.hatch SET open = FALSE;

-- Revoke all room access from prisoner (back to just lobby)
REVOKE USAGE ON SCHEMA corridor FROM prisoner;
REVOKE USAGE ON SCHEMA vault FROM prisoner;
REVOKE USAGE ON SCHEMA server_room FROM prisoner;
REVOKE USAGE ON SCHEMA escape FROM prisoner;
REVOKE ALL ON ALL TABLES IN SCHEMA corridor FROM prisoner;
REVOKE ALL ON ALL TABLES IN SCHEMA vault FROM prisoner;
REVOKE ALL ON ALL TABLES IN SCHEMA server_room FROM prisoner;
REVOKE ALL ON ALL TABLES IN SCHEMA escape FROM prisoner;
```

---

## PHASE 6 — Explanations to Ask Your AI

After completing each phase, ask your AI to explain these things in detail:

### After Phase 2 (Database)
- "Explain what SECURITY DEFINER does and what the security risk is if you use it carelessly."
- "Show me what MVCC means in PostgreSQL and how xmin and xmax work."
- "What is the difference between a transaction and a savepoint?"
- "Explain Row-Level Security with a simple example."
- "What is a functional dependency? Give me examples from the vault table."

### After Phase 3 (Backend)
- "What is a connection pool and why is it better than opening a new connection per request?"
- "Explain SQL injection. Show me a vulnerable query and a safe parameterized version."
- "What is an HTTP session? How does express-session store state?"
- "What does credentials: include do in fetch and why is it needed?"

### After Phase 4 (Frontend)
- "Explain the fetch API. What is async/await and what did we do before it existed?"
- "What is the DOM? How does JavaScript manipulate it?"
- "Why do we need CORS? What happens without it?"

---

## PHASE 7 — Submission Checklist

- [ ] All five rooms implemented and playable
- [ ] Web frontend displays room progress correctly
- [ ] SQL terminal runs queries and shows results
- [ ] Answer submission unlocks next room
- [ ] Fragments collected and displayed
- [ ] Final escape decryption works
- [ ] Leaderboard shows completed players
- [ ] Reset script works cleanly
- [ ] All 13 course topics demonstrable on request
- [ ] ER diagram and proposal document ready

---

*End of Build Guide. Feed one Phase at a time to your AI assistant.*
*Ask it to explain every concept before you move to the next step.*
