-- Create the game database
-- DROP DATABASE IF EXISTS excape_room;
CREATE DATABASE escape_room
	ENCODING 'UTF8'
	LC_COLLATE 'en_US.UTF-8'
	LC_CTYPE 'en_US.UTF-8';

-- this is to connect to new database before running the rest
-- if using PgAdmin4 leave it as it is and manually connect database, if on terminal uncomment the line below
\c escape_room

-- Warden in this game is the Game Master (SuperUser equivalant fot this DB)
CREATE ROLE warden WITH
	LOGIN
	PASSWORD 'w@rd3n67'
	CREATEROLE;

-- The prisoner is the player account
-- starts with almost no privileges
CREATE ROLE prisoner WITH
	LOGIN
	PASSWORD 'pris-1234';

-- Enable required extensions
-- pgcrypto gives us encryption functions

-- First, check if pgcrypto is available at all
SELECT * FROM pg_available_extensions WHERE name = 'pgcrypto';

CREATE EXTENSION IF NOT EXISTS pgcrypto;

--Revoke default public schema access from prisoner
-- the ensures prisoner cannot see anything we haven't explicitly granted 
REVOKE ALL ON DATABASE escape_room FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM PUBLIC;

-- Give warden full access
GRANT ALL ON DATABASE escape_room TO warden;
GRANT ALL ON SCHEMA public TO warden;

-- Prisoner needs CONNECT so the query interface can run with limited role
GRANT CONNECT ON DATABASE escape_room TO prisoner;

SELECT * FROM pg_tables


	