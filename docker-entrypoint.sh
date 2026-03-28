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

start_app() {
  pnpm exec drizzle-kit push --config drizzle.config.sqlite.ts
  exec pnpm exec next start -H 0.0.0.0 -p "${PORT:-3000}"
}

if [ "$(id -u)" = 0 ]; then
  exec runuser -u nextjs -- env \
    DATABASE_URL="$DATABASE_URL" \
    JWT_SECRET="$JWT_SECRET" \
    PORT="${PORT:-3000}" \
    NODE_ENV="${NODE_ENV:-production}" \
    HOME=/tmp \
    sh -ec 'cd /app && pnpm exec drizzle-kit push --config drizzle.config.sqlite.ts && exec pnpm exec next start -H 0.0.0.0 -p "${PORT:-3000}"'
else
  start_app
fi
