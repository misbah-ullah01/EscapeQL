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

- MUltiplayer support with real-time updates
- Docker Compose setup for easier deployment
- Admin dashboard for instructors
- Difficulty levels / hints system
- Score based on time and attempts

---

## License

MIT License

Feel Free to Fork, modify, and use it in your classes or personal Learning

---

## Acknowledgements

- Built as a fun way to teach advanced PostgreSql concepts
- Inspired by classic escape room games and SQL learning platforms

---

_***Made with ❤️ for database learners everywhere***_
_Start Escaping_
