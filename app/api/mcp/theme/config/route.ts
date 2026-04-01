import { NextRequest, NextResponse } from 'next/server'

import { requireMcpThemeToolsEnabledAndKey } from '@/lib/mcp-theme-tools-auth'
import { safeSiteConfigUpsert } from '@/lib/safe-site-config-upsert'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import { getThemePresetCss, normalizeCustomCss } from '@/lib/theme-css'
import { parseThemeCustomSurface } from '@/lib/theme-custom-surface'

export const dynamic = 'force-dynamic'
export const revalidate = 0
const THEME_CONFIG_ALLOWED_KEYS = new Set(['themeCustomSurface', 'customCss'])

export async function PATCH(request: NextRequest) {
  const guard = await requireMcpThemeToolsEnabledAndKey(request)
  if (!guard.ok) return guard.response

  const bodyRaw = await request.json().catch(() => ({}))
  const body =
    bodyRaw && typeof bodyRaw === 'object' && !Array.isArray(bodyRaw)
      ? (bodyRaw as Record<string, unknown>)
      : {}
  const unknownKeys = Object.keys(body).filter((key) => !THEME_CONFIG_ALLOWED_KEYS.has(key))
  if (unknownKeys.length > 0) {
    return NextResponse.json(
      {
        success: false,
        error: `仅允许修改主题字段: ${[...THEME_CONFIG_ALLOWED_KEYS].join(', ')}`,
        unknownKeys,
      },
      { status: 400 },
    )
  }

  const existing = await getSiteConfigMemoryFirst()
  if (!existing) {
    return NextResponse.json({ success: false, error: '站点配置不存在' }, { status: 500 })
  }

  const nextThemeCustomSurface =
    body.themeCustomSurface === undefined
      ? existing.themeCustomSurface
      : parseThemeCustomSurface(body.themeCustomSurface)

  const nextCustomCss =
    body.customCss === undefined
      ? String(existing.customCss ?? '')
      : normalizeCustomCss(body.customCss)
  const createPayload = {
    ...existing,
    id: 1,
    themePreset: 'customSurface',
    themeCustomSurface: nextThemeCustomSurface,
    customCss: nextCustomCss,
  }

  await safeSiteConfigUpsert({
    where: { id: 1 },
    update: {
      themePreset: 'customSurface',
      themeCustomSurface: nextThemeCustomSurface,
      customCss: nextCustomCss,
    },
    create: createPayload,
  })

  const cfg = await getSiteConfigMemoryFirst()
  if (!cfg) {
    return NextResponse.json({ success: false, error: '站点配置不存在' }, { status: 500 })
  }

  const presetCss = getThemePresetCss(cfg.themePreset, cfg.themeCustomSurface)
  const customCss = String(cfg.customCss ?? '')
  const themeCss = `${presetCss}\n${customCss}`.trim()

  return NextResponse.json({
    success: true,
    data: {
      themePreset: cfg.themePreset,
      themeCustomSurface: cfg.themeCustomSurface,
      customCss: cfg.customCss ?? '',
      themeCss,
      parts: {
        presetCss,
        customCss,
      },
    },
  })
}

