import { NextRequest, NextResponse } from 'next/server'

import { getSession } from '@/lib/auth'
import { normalizeAiClientId, rotateSkillsOauthToken } from '@/lib/skills-auth'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function requireAdmin() {
  const session = await getSession()
  return session ?? null
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }

  const cfg = await getSiteConfigMemoryFirst()
  if (!cfg?.skillsDebugEnabled) {
    return NextResponse.json(
      { success: false, error: 'Skills 未启用，请先在进阶设置中启用' },
      { status: 400 },
    )
  }
  if (String(cfg.skillsAuthMode ?? '').toLowerCase() !== 'oauth') {
    return NextResponse.json(
      { success: false, error: '当前不是 OAuth 模式，请先在进阶设置中切换' },
      { status: 400 },
    )
  }

  const body = await request.json().catch(() => ({}))
  const aiClientId = normalizeAiClientId(body?.aiClientId)
  if (body?.confirm !== true) {
    return NextResponse.json(
      { success: false, error: '用户未确认授权' },
      { status: 400 },
    )
  }
  if (!aiClientId) {
    return NextResponse.json(
      { success: false, error: '缺少 AI 标识（aiClientId）' },
      { status: 400 },
    )
  }

  const { token, expiresAt } = await rotateSkillsOauthToken(60 * 60_000, aiClientId)
  return NextResponse.json({
    success: true,
    data: {
      token,
      aiClientId,
      expiresAt: expiresAt.toISOString(),
      headerPrefix: 'LLM-Skills-',
    },
  })
}

