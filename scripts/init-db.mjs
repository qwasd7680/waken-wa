import { execSync } from 'node:child_process'

import { repoRoot, resolveDatabaseEnv } from './resolve-database-env.mjs'

try {
  const { drizzleConfig, provider } = resolveDatabaseEnv({ forInitDb: true })

  function run(cmd) {
    execSync(cmd, { stdio: 'inherit', cwd: repoRoot, env: process.env, shell: true })
  }

  console.log(`[init-db] provider=${provider} config=${drizzleConfig}`)

  run(`pnpm exec drizzle-kit push --config ${drizzleConfig}`)

  console.log('[init-db] done')
} catch (e) {
  console.error('[init-db]', e.message || e)
  process.exit(1)
}
