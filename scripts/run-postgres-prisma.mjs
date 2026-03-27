/**
 * Runs `npx prisma ...` with DATABASE_URL set from DATABASE_URL | POSTGRES_URL | POSTGRES_PRISMA_URL
 * (first standard postgres:// or postgresql:// URL wins).
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return
  const raw = fs.readFileSync(envPath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
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

const prismaArgs = process.argv.slice(2)
if (prismaArgs.length === 0) {
  console.error('Usage: node scripts/run-postgres-prisma.mjs <prisma subcommand and flags...>')
  process.exit(1)
}

const picked = pickPostgresUrl()
if (!picked) {
  console.error(
    '[prisma-postgres] Set DATABASE_URL or POSTGRES_URL to a postgres URL (postgresql://... or postgres://...)',
  )
  process.exit(1)
}

const env = { ...process.env, DATABASE_URL: picked }
const r = spawnSync('npx', ['prisma', ...prismaArgs], {
  stdio: 'inherit',
  cwd: root,
  env,
  shell: true,
})
process.exit(r.status === null ? 1 : r.status)
