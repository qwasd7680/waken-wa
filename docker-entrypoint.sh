#!/bin/sh
set -e
cd /app

# Sync PostgreSQL schema (migrations in repo are SQLite; production PG uses schema.postgres.prisma + db push).
npx prisma db push --schema prisma/schema.postgres.prisma

exec node server.js
