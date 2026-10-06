#!/usr/bin/env bash
# Idempotent: creates the todoapp role, the tododb database and the schema in worktime's Postgres.
# Re-applies the password every time, so rotating the Jenkins credential just works.
#   DB_PASSWORD=... ./deploy/bootstrap-db.sh
# Runs psql inside the Postgres container: local socket connections are trusted there, so it needs no
# superuser password.
set -euo pipefail
: "${DB_PASSWORD:?set DB_PASSWORD}"
PG_CONTAINER="${PG_CONTAINER:-worktime-postgres-1}"
cd "$(dirname "$0")/.."

docker exec -i -e DB_PASSWORD "$PG_CONTAINER" psql -U worktime -d postgres -v ON_ERROR_STOP=1 -q <<'SQL'
\getenv pw DB_PASSWORD
SELECT 'CREATE ROLE todoapp LOGIN' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'todoapp')\gexec
SELECT format('ALTER ROLE todoapp PASSWORD %L', :'pw')\gexec
SELECT 'CREATE DATABASE tododb OWNER todoapp' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'tododb')\gexec
SQL

# As todoapp, so it owns the tables it uses.
docker exec -i "$PG_CONTAINER" psql -U todoapp -d tododb -v ON_ERROR_STOP=1 -q < sql/init.sql
echo "==> tododb ready in $PG_CONTAINER"
