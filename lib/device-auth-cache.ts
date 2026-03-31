import { and, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { devices } from '@/lib/drizzle-schema'

type CacheEntry = {
  at: number
  ok: boolean
}

const DEVICE_AUTH_CACHE_TTL_MS = 15_000
const deviceAuthCache = new Map<string, CacheEntry>()

function cacheKey(tokenId: number, generatedHashKey: string): string {
  return `${tokenId}:${generatedHashKey}`
}

function isFresh(entry: CacheEntry | undefined, now: number): entry is CacheEntry {
  return !!entry && now - entry.at < DEVICE_AUTH_CACHE_TTL_MS
}

export function clearDeviceAuthCache(): void {
  deviceAuthCache.clear()
}

export async function isActiveDeviceBoundToTokenCached(
  tokenId: number,
  generatedHashKey: string,
): Promise<boolean> {
  const key = cacheKey(tokenId, generatedHashKey)
  const now = Date.now()
  const hit = deviceAuthCache.get(key)
  if (isFresh(hit, now)) return hit.ok

  const [row] = await db
    .select({ id: devices.id })
    .from(devices)
    .where(
      and(
        eq(devices.generatedHashKey, generatedHashKey),
        eq(devices.apiTokenId, tokenId),
        eq(devices.status, 'active'),
      ),
    )
    .limit(1)

  const ok = !!row
  deviceAuthCache.set(key, { at: now, ok })
  return ok
}
