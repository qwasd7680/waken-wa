import { and, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { apiTokens } from '@/lib/drizzle-schema'

type CacheRow = any | null

type CacheEntry = {
  at: number
  value: CacheRow
}

const TOKEN_AUTH_CACHE_TTL_MS = 15_000
const tokenAuthCache = new Map<string, CacheEntry>()

function isFresh(entry: CacheEntry | undefined, now: number): entry is CacheEntry {
  return !!entry && now - entry.at < TOKEN_AUTH_CACHE_TTL_MS
}

export function clearApiTokenAuthCache(): void {
  tokenAuthCache.clear()
}

export function primeApiTokenAuthCache(hashedToken: string, value: CacheRow): void {
  tokenAuthCache.set(hashedToken, { at: Date.now(), value })
}

export async function getActiveApiTokenByHashedCached(hashedToken: string): Promise<CacheRow> {
  const now = Date.now()
  const hit = tokenAuthCache.get(hashedToken)
  if (isFresh(hit, now)) return hit.value

  const [row] = await db
    .select()
    .from(apiTokens)
    .where(and(eq(apiTokens.token, hashedToken), eq(apiTokens.isActive, true)))
    .limit(1)

  const value = row ?? null
  tokenAuthCache.set(hashedToken, { at: now, value })
  return value
}
