# EscapeQL - SQL Escape Room Game

**Learn PostgreSQL by escaping a database prison.**

EscapeQL is a Interactive, story-driven SQL escape room where the **database is the Game**. Players take on the role of a "prisoner" and must solve increasingly complex PostgreSQL puzzles accross five themed rooms to escape.

Built as a teaching tool to make learning advanced database concepts fun, hands-on, and memorable.

---

## Game Overview

You wake up inside the `escape_room` database with almost no privileges.
Your only tools are web-based SQL terminal and your knowledge of PostgreSQL.

**Rooms & Concepts Taught:**

| Room          | Theme             | Core Concepts taught                              |
|---------------|-------------------|------------------------------------|
|**Loby**       | NULL Puzzle       | Null Handeling, column comments, metadata queries                    |
|**Corridor**   |Broken View        |Views, `pg_views`, relational algebra, base tables                |
|**Vault**      |Normalizatoin      |2NF violation, functional dependencies, transactions          |
|**Server Room**|Trigger Debugging  |Triggers, `pg_triger`, debugging, concurrency (`SKIP_LOCKED`)         |
|**Escape**     |Encryption         |`pgcrupto`, `pgp_sym_decrypt`, key assembly                            |

---

## Features

- Fully Functional web frontend with SQL terminal
- Real PostgreSQL backend with multiple shemas acting as "rooms"
- Role-based security (`warden`, `prisoner`)
- Secure answer validation using hashed passwords
- Progress tracking, fragments collections, and leaderboard
- Safe query executor (blocks dangerous commands)
- Responsive Pixelated/Terminal/Game aesthetic
- Complete reset script for easy replay

---

## Tech Stach

- **Database**: PostgreSQL 16
- **Backend**: Node.js + Express + pg
- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Authentication**: Session-based
- **Security**: Row-Level Security (RLS), `SECURITY DEFINER` functions, parameterized queries

---

## Project Structure

```bash
escapeql/
