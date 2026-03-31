/**
 * Returns the current time in the format expected by each driver:
 * - PostgreSQL (`mode: 'date'`): `Date` object — Drizzle calls `.toISOString()` internally
 *   before sending to the wire. Passing a string triggers "e.ToISOString is not a function".
 * - SQLite (better-sqlite3): ISO-8601 string — better-sqlite3 only accepts primitive types
 *   (number, string, bigint, Buffer, null); passing a Date object causes a runtime error.
 */
function isPostgresUrl(): boolean {
  return /^postgres(ql)?:\/\//i.test(process.env.DATABASE_URL?.trim() ?? '')
}

export function sqlTimestamp(): Date | string {
  return isPostgresUrl() ? new Date() : new Date().toISOString()
}

/**
 * Converts a Date to the format expected by the active driver.
 * Use this wherever a Date value must be written to a Drizzle timestamp column.
 */
export function sqlDate(date: Date): Date | string {
  return isPostgresUrl() ? date : date.toISOString()
}
