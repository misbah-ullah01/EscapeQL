# EscapeQL - SQL Escape Room Game

**Learn PostgreSQL by escaping a database prison.**

EscapeQL is a Interactive, story-driven SQL escape room where the **database is the Game**. Players take on the role of a "prisoner" and must solve increasingly complex PostgreSQL puzzles accross five themed rooms to escape.

Built as a teaching tool to make learning advanced database concepts fun, hands-on, and memorable.

---

## Game Overview

You wake up inside the `escape_room` database with almost no privileges.
Your only tools are web-based SQL terminal and your knowledge of PostgreSQL.

**Rooms & Concepts Taught:**

| Room            | Theme             | Core Concepts taught                                           |
| --------------- | ----------------- | -------------------------------------------------------------- |
| **Loby**        | NULL Puzzle       | Null Handeling, column comments, metadata queries              |
| **Corridor**    | Broken View       | Views, `pg_views`, relational algebra, base tables             |
| **Vault**       | Normalizatoin     | 2NF violation, functional dependencies, transactions           |
| **Server Room** | Trigger Debugging | Triggers, `pg_trigger`, debugging, concurrency (`SKIP_LOCKED`) |
| **Escape**      | Encryption        | `pgcrypto`, `pgp_sym_decrypt`, key assembly                    |

---

## Features

- Fully Functional web frontend with SQL terminal
- Real PostgreSQL backend with multiple schemas acting as "rooms"
- Role-based security (`warden`, `prisoner`)
- Secure answer validation using hashed passwords
- Progress tracking, fragments collections, and leaderboard
- Safe query executor (blocks dangerous commands)
- Responsive Pixelated/Terminal/Game aesthetic
- Complete reset script for easy replay

---

## Tech Stack

- **Database**: PostgreSQL 16
- **Backend**: Node.js + Express + pg
- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Authentication**: Session-based
- **Security**: Row-Level Security (RLS), `SECURITY DEFINER` functions, parameterized queries

## Quick Start (Local)

Follow these steps to run the full stack locally (PostgreSQL + backend + frontend):

1. Install prerequisites:
   - PostgreSQL 16 (or compatible)
   - Node.js 18+ and npm

2. Create the database and run the SQL setup scripts (adjust `postgres` user as needed):

```bash
# create database (run as a postgres superuser)
createdb escapeql

# run setup scripts in order
psql -d escapeql -f database/00_setup.sql
psql -d escapeql -f database/01_warden_schema.sql
psql -d escapeql -f database/02_lobby.sql
psql -d escapeql -f database/03_corridor.sql
psql -d escapeql -f database/04_vault.sql
psql -d escapeql -f database/05_server_room.sql
psql -d escapeql -f database/06_escape.sql
psql -d escapeql -f database/07_permissions.sql
```

3. Configure backend environment:
   - Copy `.env.example` (if present) or create a `.env` file inside `backend/` with at least these values:

```env
DATABASE_URL=postgres://<dbuser>:<dbpassword>@localhost:5432/escapeql
SESSION_SECRET=some_long_random_string
PORT=3001
```

4. Install and run the backend:

```bash
cd backend
npm install
# start server (serves static frontend and API)
npm start
# or during development
npm run dev
```

5. Open the game in your browser:
   - Navigate to http://localhost:3001/ — the backend serves the frontend and the API.

Notes and troubleshooting:

- If you open the frontend files directly via `file://`, cookies/sessions may not work. Run the backend so session cookies are properly set (http://localhost:3001).
- If the API requests fail due to CORS or credentials, ensure `PORT` and `DATABASE_URL` match and the backend is running.
- To reset the game state, use `database/reset.sql` or the backend reset endpoints (warden UI) depending on your setup.

## Prisoner Walkthrough — Detailed SQL Solutions (Per Room)

This section provides a step-by-step guide for the `prisoner` role to solve each room. It assumes the prisoner account has restricted privileges (mostly `SELECT` on specific tables/views) and that destructive commands (DDL/DML like `DROP`, `ALTER`, or `UPDATE`) are blocked by the game executor. Use only `SELECT`, `LIMIT`, `ORDER BY`, `JOIN`, simple string functions and `WHERE` filters. Examples below are written to be copy/pasted into the in-game SQL terminal.

General tips for the prisoner role

- Use `information_schema` to discover accessible tables and columns: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';`
- Inspect column names: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'doors';`
- Use `ILIKE` for case-insensitive matching and `%` wildcards to search text: `WHERE name ILIKE '%corridor%'`.
- Use `LIMIT 1` when you only need a single value.
- If a column returns `NULL`, try `IS NOT NULL` or `COALESCE(col, '<none>')`.
- If views are present and look empty, fetch the view definition to see underlying tables: `SELECT view_definition FROM information_schema.views WHERE table_name = 'my_view';`

Room: Lobby (Null handling & metadata)

- Goal: Find the corridor keycode stored in the `doors` table or related metadata.
- Restrictions: You may be able to `SELECT` from `doors` but some columns can be `NULL` or masked.

Steps & Example queries:

1. List tables you can access:

```sql
SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;
```

2. Inspect columns for `doors` (replace table name if different):

```sql
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'doors';
```

3. Query for the corridor code (common pattern):

```sql
SELECT code FROM doors WHERE name ILIKE '%corridor%' AND code IS NOT NULL LIMIT 1;
```

4. If result is NULL or split across rows, try searching comments or metadata columns:

```sql
SELECT * FROM doors WHERE description ILIKE '%corridor%' OR notes ILIKE '%corridor%';
```

Room: Corridor (Views, filtering, fragment discovery)

- Goal: Identify encrypted fragments in the `keys` (or similar) table and extract `fragment_code` values.
- Restrictions: The prisoner may only have access to a view rather than the underlying table; use `information_schema.views` to inspect view SQL.

Steps & Example queries:

1. See if a `keys` table or view exists:

```sql
SELECT table_name, table_type FROM information_schema.tables WHERE table_name ILIKE '%key%' OR table_name ILIKE '%keys%';
```

2. If `keys` is a view and empty, inspect its definition:

```sql
SELECT view_definition FROM information_schema.views WHERE table_name = 'keys';
```

3. Query the fragments you can see (typical):

```sql
SELECT fragment_code, status, created_at FROM keys WHERE status = 'ENCRYPTED' ORDER BY created_at DESC LIMIT 20;
```

4. If fragment codes are split or encoded, try string functions and casts:

```sql
-- If column is bytea
SELECT encode(fragment_code::bytea, 'hex') FROM keys WHERE status='ENCRYPTED' LIMIT 5;
```

Room: Vault (Normalization, joins, and secret lookup)

- Goal: Locate the admin password fragment stored across normalized tables (e.g., `employees`, `credentials`).
- Restrictions: Sensitive fields may be split across tables and require `JOIN` operations; prisoner should be allowed to perform `SELECT` with `JOIN`.

Steps & Example queries:

1. Find likely tables:

```sql
SELECT table_name FROM information_schema.tables WHERE table_name ILIKE '%employee%' OR table_name ILIKE '%cred%';
```

2. Inspect columns and then JOIN to combine fragments:

```sql
SELECT e.username, c.secret_fragment, e.clearance_level
FROM employees e
JOIN credentials c ON c.employee_id = e.id
WHERE e.clearance_level >= 5
ORDER BY e.clearance_level DESC LIMIT 10;
```

3. If the secret is split into parts across rows, aggregate them in order:

```sql
SELECT string_agg(part, '' ORDER BY part_index) AS full_fragment
FROM employee_fragments
WHERE employee_id = (SELECT id FROM employees WHERE username ILIKE '%admin%' LIMIT 1);
```

Room: Server Room (Logs, ordering, and JSON metadata)

- Goal: Extract override PIN or code from `system_logs` or JSON metadata fields.
- Restrictions: Recent logs might be protected by RLS; use `ORDER BY timestamp DESC` to prioritize recent error entries.

Steps & Example queries:

1. Look for log tables:

```sql
SELECT table_name FROM information_schema.tables WHERE table_name ILIKE '%log%' OR table_name ILIKE '%system%';
```

2. Search messages for keywords (PIN, OVERRIDE, ERROR):

```sql
SELECT timestamp, message, metadata FROM system_logs WHERE message ILIKE '%pin%' OR message ILIKE '%override%' ORDER BY timestamp DESC LIMIT 20;
```

3. If metadata is JSON and the PIN is a key inside it:

```sql
SELECT metadata->>'override_pin' AS pin, timestamp FROM system_logs WHERE metadata ? 'override_pin' ORDER BY timestamp DESC LIMIT 5;
```

Room: Escape (Assembling fragments & final key)

- Goal: Combine all collected fragments in the correct order to obtain the final decryption key.
- Restrictions: You may only have `SELECT` access to the `fragments` or `keys_collected` table; use ordering metadata to assemble.

Steps & Example queries:

1. List fragments you have collected (or rows marked as `collected_by = current_prisoner`):

```sql
SELECT fragment_code, fragment_index FROM fragments WHERE collected_by = 'prisoner_username' ORDER BY fragment_index;
```

2. Aggregate into a single key string:

```sql
SELECT string_agg(fragment_code, '' ORDER BY fragment_index) AS final_key FROM fragments WHERE collected_by = 'prisoner_username';
```

3. If fragments are encoded, decode or cast as needed before concatenation.

Submitting answers in the UI

- Use the in-game `ANSWER_SUBMISSION` box (right under the terminal) to submit single answers for room unlocks.
- For the final escape key use the `FINAL_DECRYPTION_KEY` input in the escape panel.

If any query returns permission errors

- The `prisoner` role intentionally lacks privileges on some tables. When you see `permission denied`, try these approaches:
  - Query views instead of base tables (views are often given read access).
  - Inspect `information_schema.views` to find alternative object names.
  - Search for the same data in other tables (e.g., `meta`, `notes`, `config`).

If you'd like, I can now:

- Add these walkthroughs as a standalone `docs/PRISONER_GUIDE.md` file, or
- Expand each room with exact table/column names from your database files for a fully concrete solution.

---

## Project Structure

```bash
escapeql/
├── database/              # All SQL setup files
│   ├── 00_setup.sql
│   ├── 01_warden_schema.sql
│   ├── 02_lobby.sql
│   ├── 03_corridor.sql
│   ├── 04_vault.sql
│   ├── 05_server_room.sql
│   ├── 06_escape.sql
│   ├── 07_permissions.sql
│   └── reset.sql
├── backend/
│   ├── server.js
│   ├── db.js
│   ├── routes/
│   └── package.json
├── frontend/
│   ├── index.html
│   ├── game.html
│   ├── css/
│   └── js/
└── README.md
```

---

## Teaching / Classroom Use

This project is excellent for teaching:

- Relational Database Design
- SQL Query writing & Optimization
- Database Security (Roles, Privileges, RLS)
- Transactions & Concurrency
- Triggers & Stored Procedures
- PostgreSQL System Catalogs(`pg_views`, `pg_triggers`, etc.)
- Normalization & Functional Dependencies
- Encryption with `pgcrypto`

---

## Future Improvements

- Multiplayer support with real-time updates
- Docker Compose setup for easier deployment
- Admin dashboard for instructors
- Difficulty levels / hints system
- Score based on time and attempts

---

## License

MIT License

_Copyright (c) 2026 Misbah Ullah_

Feel Free to Fork, modify, and use it in your classes or personal Learning

---

## Acknowledgements

- Built as a fun way to teach advanced PostgreSql concepts
- Inspired by classic escape room games and SQL learning platforms

---

_***Made with ❤️ for database learners everywhere***_

_Start Escaping_

If you open the game directly from the filesystem, use the backend server at `http://localhost:3001/` so registration and sessions work correctly.
