import { NextRequest, NextResponse } from 'next/server'

import { requireMcpThemeToolsEnabledAndKey } from '@/lib/mcp-theme-tools-auth'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import { getThemePresetCss } from '@/lib/theme-css'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const guard = await requireMcpThemeToolsEnabledAndKey(request)
  if (!guard.ok) return guard.response

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
      themeCss,
      parts: {
        preset: cfg.themePreset,
        presetCss,
        customCss,
      },
    },
  })
}

