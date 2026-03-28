/**
 * drizzle-kit SQLite push loads better-sqlite3; ensure .node exists (Node 24 / skipped install scripts).
 */
import { execSync } from 'node:child_process'

import { repoRoot } from './resolve-database-env.mjs'

export function rebuildBetterSqlite3() {
  try {
    execSync('pnpm rebuild better-sqlite3', {
      stdio: 'inherit',
      cwd: repoRoot,
      env: process.env,
      shell: true,
    })
  } catch {
    console.error(
      '[better-sqlite3] rebuild failed. Run: pnpm rebuild better-sqlite3\n' +
        'Windows: install VS Build Tools (C++ workload), or use Node 22 LTS if prebuilds are missing.',
    )
    process.exit(1)
  }
}
