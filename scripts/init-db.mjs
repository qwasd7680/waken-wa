import { execSync } from 'node:child_process'

import { rebuildBetterSqlite3 } from './ensure-better-sqlite3.mjs'
import { repoRoot, resolveDatabaseEnv } from './resolve-database-env.mjs'

if (process.env.SKIP_POSTINSTALL_DB === '1') {
  console.log('[init-db] SKIP_POSTINSTALL_DB=1, skipping')
  process.exit(0)
}

try {
  const { drizzleConfig, provider, onVercel } = resolveDatabaseEnv({ forInitDb: true })

  function run(cmd) {
    execSync(cmd, { stdio: 'inherit', cwd: repoRoot, env: process.env, shell: true })
  }

  if (onVercel) {
    console.log('[init-db] VERCEL=1 detected — forcing PostgreSQL')
  }
  console.log(`[init-db] provider=${provider} config=${drizzleConfig}`)

  if (provider === 'sqlite') {
    rebuildBetterSqlite3()
  }

  run(`pnpm exec drizzle-kit push --config ${drizzleConfig}`)

  console.log('[init-db] done')
} catch (e) {
  console.error('[init-db]', e.message || e)
  process.exit(1)
}
