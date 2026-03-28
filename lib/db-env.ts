const POSTGRES_URL_RE = /^postgres(ql)?:\/\//i

export function isPostgresConnectionUrl(value: string | undefined): boolean {
  const s = value?.trim()
  return !!s && POSTGRES_URL_RE.test(s)
}

/**
 * First standard postgres URL among env vars.
 * Priority: DATABASE_URL, then POSTGRES_URL.
 */
export function pickPostgresUrlFromEnv(): string | null {
  const a = process.env.DATABASE_URL?.trim()
  const b = process.env.POSTGRES_URL?.trim()
  if (isPostgresConnectionUrl(a)) return a!
  if (isPostgresConnectionUrl(b)) return b!
  return null
}

/**
 * When deploying with PostgreSQL env aliases, ensure DATABASE_URL is a postgres URL
 * (copy from POSTGRES_URL / etc. if needed).
 */
export function applyDatabaseUrlAliases(): void {
  const picked = pickPostgresUrlFromEnv()
  if (!picked) return

  const cur = process.env.DATABASE_URL?.trim()
  if (!cur) {
    process.env.DATABASE_URL = picked
    return
  }
  if (cur.startsWith('file:')) return
  if (isPostgresConnectionUrl(cur)) {
    process.env.DATABASE_URL = picked
  }
}

applyDatabaseUrlAliases()
