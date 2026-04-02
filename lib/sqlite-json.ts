import 'server-only'

import { isPostgresConnectionUrl } from '@/lib/db-env'

const usePg = isPostgresConnectionUrl(process.env.DATABASE_URL?.trim())

/**
 * Drizzle + better-sqlite3 cannot bind plain object/array values directly.
 * For SQLite JSON text columns, convert structured values to JSON string.
 */
export function toDbJsonValue<T>(value: T): T | string {
  if (usePg) return value
  if (value === null) return value
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

/**
 * Normalize only known JSON fields in a record before DB write.
 */
export function normalizeJsonFieldsForDb<T extends Record<string, unknown>>(
  record: T,
  jsonFieldNames: readonly string[],
): T {
  if (usePg) return record
  const next: Record<string, unknown> = { ...record }
  for (const key of jsonFieldNames) {
    if (!(key in next)) continue
    const value = next[key]
    if (value === undefined) continue
    next[key] = toDbJsonValue(value)
  }
  return next as T
}

