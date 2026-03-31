import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { siteConfig } from '@/lib/drizzle-schema'

type SiteConfigValue = any | null

type SiteConfigCacheState = {
  loaded: boolean
  value: SiteConfigValue
}

declare global {
  var __wakenSiteConfigCache: SiteConfigCacheState | undefined
}

function getCacheState(): SiteConfigCacheState {
  if (!globalThis.__wakenSiteConfigCache) {
    globalThis.__wakenSiteConfigCache = { loaded: false, value: null }
  }
  return globalThis.__wakenSiteConfigCache
}

export function clearSiteConfigMemoryCache(): void {
  globalThis.__wakenSiteConfigCache = { loaded: false, value: null }
}

export function setSiteConfigMemoryCache(value: unknown): void {
  const state = getCacheState()
  state.loaded = true
  state.value = value && typeof value === 'object' ? value : null
}

export async function getSiteConfigMemoryFirst(): Promise<SiteConfigValue> {
  const state = getCacheState()
  if (state.loaded) {
    return state.value
  }

  const [row] = await db.select().from(siteConfig).where(eq(siteConfig.id, 1)).limit(1)
  setSiteConfigMemoryCache(row ?? null)
  return getCacheState().value
}
