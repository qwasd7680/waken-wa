import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return

  const raw = fs.readFileSync(envPath, 'utf8')
  const lines = raw.split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const idx = trimmed.indexOf('=')
    if (idx === -1) continue

    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }
}

// Same order as typical Next/Prisma: .env then .env.local overrides
loadEnvFile(path.join(root, '.env'))
loadEnvFile(path.join(root, '.env.local'))

function isPostgresUrl(s) {
  const t = typeof s === 'string' ? s.trim() : ''
  return t.length > 0 && /^postgres(ql)?:\/\//i.test(t)
}

function pickPostgresUrl() {
  const a = process.env.DATABASE_URL?.trim()
  const b = process.env.POSTGRES_URL?.trim()
  const c = process.env.POSTGRES_PRISMA_URL?.trim()
  if (isPostgresUrl(a)) return a
  if (isPostgresUrl(b)) return b
  if (isPostgresUrl(c)) return c
  return null
}

const inferredPostgres = pickPostgresUrl() !== null
const explicitPostgres = (process.env.DATABASE_PROVIDER || '').toLowerCase() === 'postgresql'
const provider =
  inferredPostgres || explicitPostgres ? 'postgresql' : (process.env.DATABASE_PROVIDER || 'sqlite').toLowerCase()

const schemaRel =
  provider === 'postgresql' ? 'prisma/schema.postgres.prisma' : 'prisma/schema.prisma'

if (provider === 'sqlite') {
  if (!process.env.DATABASE_URL?.trim()) {
    process.env.DATABASE_URL = 'file:./prisma/dev.db'
    console.log('[init-db] DATABASE_URL unset; using default file:./prisma/dev.db')
  }
} else {
  const pgUrl = pickPostgresUrl()
  if (!pgUrl) {
    console.error(
      '[init-db] PostgreSQL: set DATABASE_URL or POSTGRES_URL to a standard postgres URL (postgresql://... or postgres://...)',
    )
    process.exit(1)
  }
  process.env.DATABASE_URL = pgUrl
}

function run(cmd) {
  execSync(cmd, { stdio: 'inherit', cwd: root, env: process.env, shell: true })
}

console.log(`[init-db] provider=${provider} schema=${schemaRel}`)

run(`npx prisma generate --schema ${schemaRel}`)
run(`npx prisma db push --schema ${schemaRel}`)

console.log('[init-db] done')
