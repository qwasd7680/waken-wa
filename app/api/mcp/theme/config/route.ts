import { NextRequest, NextResponse } from 'next/server'

import { requireMcpThemeToolsEnabledAndKey } from '@/lib/mcp-theme-tools-auth'
import { safeSiteConfigUpsert } from '@/lib/safe-site-config-upsert'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import { getThemePresetCss, normalizeCustomCss } from '@/lib/theme-css'
import { parseThemeCustomSurface } from '@/lib/theme-custom-surface'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function PATCH(request: NextRequest) {
  const guard = await requireMcpThemeToolsEnabledAndKey(request)
  if (!guard.ok) return guard.response

  const body = await request.json().catch(() => ({}))

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

  await safeSiteConfigUpsert({
    where: { id: 1 },
    update: {
      themePreset: 'customSurface',
      themeCustomSurface: nextThemeCustomSurface,
      customCss: nextCustomCss,
    },
    create: {
      id: 1,
      themePreset: 'customSurface',
      themeCustomSurface: nextThemeCustomSurface,
      customCss: nextCustomCss,
    },
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

