import { and, eq, inArray } from 'drizzle-orm'

import { db } from '@/lib/db'
import { devices } from '@/lib/drizzle-schema'
import {
  fetchSteamPlayersByIds,
  isValidSteamId,
  type SteamNowPlayingInfo,
  type SteamPlayerStatus,
  steamPlayerToNowPlaying,
} from '@/lib/steam'

const BATCH_CACHE_TTL_MS = 60_000

type BatchCacheEntry = {
  at: number
  bySteamId: Map<string, SteamPlayerStatus>
}

let batchCache: { key: string; entry: BatchCacheEntry } | null = null

function cacheKeyForSteamIds(ids: string[]): string {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))].sort().join(',')
}

async function fetchPlayersCached(steamIds: string[], apiKey: string): Promise<Map<string, SteamPlayerStatus>> {
  const key = cacheKeyForSteamIds(steamIds)
  if (!key) return new Map()

  const now = Date.now()
  if (
    batchCache &&
    batchCache.key === key &&
    now - batchCache.entry.at < BATCH_CACHE_TTL_MS
  ) {
    return batchCache.entry.bySteamId
  }

  const bySteamId = await fetchSteamPlayersByIds(steamIds, apiKey)
  batchCache = { key, entry: { at: now, bySteamId } }
  return bySteamId
}

/**
 * Resolve Steam now-playing for device hashes that opted in (`showSteamNowPlaying`).
 * Uses the site-wide Steam ID from settings (single account).
 */
export async function getSteamNowPlayingByDeviceHashes(
  deviceHashes: string[],
  options: { steamEnabled: boolean; apiKey: string; siteSteamId: string },
): Promise<Map<string, SteamNowPlayingInfo>> {
  const out = new Map<string, SteamNowPlayingInfo>()
  const uniqueHashes = [...new Set(deviceHashes.map((h) => h.trim()).filter(Boolean))]
  if (uniqueHashes.length === 0 || !options.steamEnabled) return out

  const apiKey = options.apiKey.trim()
  const siteId = options.siteSteamId.trim()
  if (!apiKey || !siteId || !isValidSteamId(siteId)) return out

  const rows = await db
    .select({ generatedHashKey: devices.generatedHashKey })
    .from(devices)
    .where(
      and(inArray(devices.generatedHashKey, uniqueHashes), eq(devices.showSteamNowPlaying, true)),
    )
  if (rows.length === 0) return out

  const players = await fetchPlayersCached([siteId], apiKey)
  const player = players.get(siteId)
  const playing = player ? steamPlayerToNowPlaying(player) : null
  if (!playing) return out

  for (const d of rows) {
    out.set(d.generatedHashKey, playing)
  }

  return out
}
