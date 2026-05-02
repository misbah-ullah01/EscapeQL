-- EscapeQL full reset script
-- Run from the database/ directory with:
-- psql -U postgres -f reset.sql

\set ON_ERROR_STOP on

\echo 'Resetting EscapeQL database and roles...'

-- Clean slate
DROP DATABASE IF EXISTS escape_room;

-- Clear any role-owned privileges in the current maintenance database
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'prisoner') THEN
		EXECUTE 'REASSIGN OWNED BY prisoner TO postgres';
		EXECUTE 'DROP OWNED BY prisoner';
	END IF;
END
$$;

DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'warden') THEN
		EXECUTE 'REASSIGN OWNED BY warden TO postgres';
		EXECUTE 'DROP OWNED BY warden';
	END IF;
END
$$;

DROP ROLE IF EXISTS prisoner;
DROP ROLE IF EXISTS warden;

\echo 'Rebuilding schema, rooms, and permissions...'

-- Re-run setup in order
\i 00_setup.sql
\i 01_warden_schema.sql
\i 02_lobby.sql
\i 03_corridor.sql
\i 04_vault.sql
\i 05_server_room.sql
\i 06_escape.sql
\i 07_permissions.sql

\echo 'EscapeQL reset complete.'
