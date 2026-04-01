import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { siteConfig } from '@/lib/drizzle-schema'
import {
  hasMcpThemeToolsKeyConfigured,
  rotateMcpThemeToolsKey,
} from '@/lib/mcp-theme-tools-auth'
import { clearSiteConfigCaches, getSiteConfigMemoryFirst } from '@/lib/site-config-cache'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function requireAdmin() {
  const session = await getSession()
  return session ?? null
}

export async function GET() {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }

  const cfg = await getSiteConfigMemoryFirst()
  return NextResponse.json({
    success: true,
    data: {
      enabled: cfg?.mcpThemeToolsEnabled === true,
      keyConfigured: await hasMcpThemeToolsKeyConfigured(),
    },
  })
}

export async function PATCH(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))

    const enableInBody = body.enabled !== undefined && body.enabled !== null
    const enabled = enableInBody ? Boolean(body.enabled) : undefined
    const rotateKey = body.rotateKey === true
    let generatedKey: string | null = null

    if (rotateKey) {
      generatedKey = await rotateMcpThemeToolsKey()
    }

    if (enabled !== undefined) {
      const existing = await getSiteConfigMemoryFirst()
      if (!existing) {
        return NextResponse.json(
          { success: false, error: '请先完成站点初始化配置，再启用 MCP 工具' },
          { status: 400 },
        )
      }
      await db.update(siteConfig).set({ mcpThemeToolsEnabled: enabled }).where(eq(siteConfig.id, 1))
      await clearSiteConfigCaches()
    }

    const cfgAfterToggle = await getSiteConfigMemoryFirst()
    const currentEnabled = enabled === undefined ? cfgAfterToggle?.mcpThemeToolsEnabled === true : enabled
    let keyConfigured = await hasMcpThemeToolsKeyConfigured()
    if (currentEnabled && !keyConfigured) {
      generatedKey = await rotateMcpThemeToolsKey()
      keyConfigured = true
    }

    const cfg = await getSiteConfigMemoryFirst()
    return NextResponse.json({
      success: true,
      data: {
        enabled: cfg?.mcpThemeToolsEnabled === true,
        keyConfigured,
        generatedKey,
      },
    })
  } catch (error) {
    console.error('更新 MCP 主题工具设置失败:', error)
    return NextResponse.json({ success: false, error: '更新失败' }, { status: 500 })
  }
}

