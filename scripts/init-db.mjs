import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const provider = (process.env.DATABASE_PROVIDER || 'postgresql').toLowerCase()
const schemaRel =
  provider === 'sqlite' ? 'prisma/schema.sqlite.prisma' : 'prisma/schema.prisma'

const hasPostgresUrl = !!process.env.POSTGRES_URL?.trim()
const hasDatabaseUrl = !!process.env.DATABASE_URL?.trim()

if (provider === 'sqlite') {
  if (!hasDatabaseUrl) {
    console.error('[init-db] Set DATABASE_URL for sqlite (e.g. file:./dev.db)')
    process.exit(1)
  }
} else {
  if (!hasPostgresUrl) {
    console.error('[init-db] Set POSTGRES_URL for postgresql (e.g. postgres://... )')
    process.exit(1)
  }
}

// Note: Prisma reads datasource url from env inside the selected schema.
// We only validate presence here to fail fast with a clear error message.

function run(cmd) {
  execSync(cmd, { stdio: 'inherit', cwd: root, env: process.env, shell: true })
}

console.log(`[init-db] provider=${provider} schema=${schemaRel}`)

run(`npx prisma generate --schema ${schemaRel}`)
run(`npx prisma db push --schema ${schemaRel}`)
run(`npx tsx prisma/seed-if-needed.ts`)

console.log('[init-db] done')
