-- Run once against your native Postgres install as a superuser:
--   psql -U postgres -f sql/setup-host-db.sql
-- Change the password before running.

CREATE ROLE todoapp WITH LOGIN PASSWORD 'CHANGE_ME';
CREATE DATABASE tododb OWNER todoapp;
