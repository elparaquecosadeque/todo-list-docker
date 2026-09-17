#!/bin/sh
psql "$DATABASE_URL" -c "DELETE FROM todos;"
