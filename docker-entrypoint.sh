#!/bin/sh
set -e
cd /app

mkdir -p /app/data

# Persist JWT when unset: stable across restarts with the same named volume.
if [ -z "${JWT_SECRET:-}" ]; then
  if [ -f /app/data/.jwt_secret ]; then
    JWT_SECRET=$(tr -d '\n\r' < /app/data/.jwt_secret)
  else
    node -e "require('fs').writeFileSync('/app/data/.jwt_secret', require('crypto').randomBytes(32).toString('hex'))"
    chmod 600 /app/data/.jwt_secret
    JWT_SECRET=$(tr -d '\n\r' < /app/data/.jwt_secret)
  fi
  export JWT_SECRET
fi

if [ "$(id -u)" = 0 ]; then
  chown -R nextjs:nodejs /app/data
fi

export DATABASE_URL="${DATABASE_URL:-file:/app/data/dev.db}"

if [ "$(id -u)" = 0 ]; then
  exec runuser -u nextjs -- env \
    DATABASE_URL="$DATABASE_URL" \
    JWT_SECRET="$JWT_SECRET" \
    HOSTNAME="${HOSTNAME:-0.0.0.0}" \
    PORT="${PORT:-3000}" \
    NODE_ENV="${NODE_ENV:-production}" \
    sh -ec 'cd /app && npx prisma db push --schema prisma/schema.prisma && exec node server.js'
else
  exec sh -ec 'cd /app && npx prisma db push --schema prisma/schema.prisma && exec node server.js'
fi
