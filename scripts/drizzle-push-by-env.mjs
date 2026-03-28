/**
 * Runs `drizzle-kit push` with the config chosen from env (same rules as init-db / postinstall).
 */
import { execSync } from 'node:child_process'

import { rebuildBetterSqlite3 } from './ensure-better-sqlite3.mjs'
import { repoRoot, resolveDatabaseEnv } from './resolve-database-env.mjs'

const forcePostgres = process.argv.includes('--postgres')

try {
  const { drizzleConfig, provider } = resolveDatabaseEnv({
    forceProvider: forcePostgres ? 'postgresql' : undefined,
  })
  console.log(`[drizzle-push] provider=${provider} config=${drizzleConfig}`)
  if (provider === 'sqlite') {
    rebuildBetterSqlite3()
  }
  execSync(`pnpm exec drizzle-kit push --config ${drizzleConfig}`, {
    stdio: 'inherit',
    cwd: repoRoot,
    env: process.env,
    shell: true,
  })
} catch (e) {
  console.error(e.message || e)
  process.exit(1)
}
