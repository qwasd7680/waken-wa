import { redirect } from 'next/navigation'

import { SkillsOauthAuthorizeCard } from '@/components/admin/skills-oauth-authorize-card'
import { getSession } from '@/lib/auth'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SkillsAuthorizePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await getSession()
  if (!session) {
    redirect('/admin/login')
  }

  const cfg = await getSiteConfigMemoryFirst()
  if (!cfg?.skillsDebugEnabled) {
    return (
      <div className="mx-auto max-w-2xl p-6 space-y-3">
        <h1 className="text-lg font-semibold">Skills 授权</h1>
        <p className="text-sm text-muted-foreground">
          还未启用「允许AI使用Skills辅助调试修改」。请先到后台 Web 配置 → 进阶设置中启用。
        </p>
      </div>
    )
  }
  if (String(cfg.skillsAuthMode ?? '').toLowerCase() !== 'oauth') {
    return (
      <div className="mx-auto max-w-2xl p-6 space-y-3">
        <h1 className="text-lg font-semibold">Skills 授权</h1>
        <p className="text-sm text-muted-foreground">
          当前未选择 OAuth 模式。请到后台 Web 配置 → 进阶设置中将认证模式切换为 OAuth。
        </p>
      </div>
    )
  }
  const params = (await searchParams) ?? {}
  const aiParam = Array.isArray(params.ai) ? params.ai[0] : params.ai
  const aiClientId = String(aiParam ?? '').trim()
  if (!aiClientId) {
    return (
      <div className="mx-auto max-w-2xl p-6 space-y-3">
        <h1 className="text-lg font-semibold">Skills 授权</h1>
        <p className="text-sm text-muted-foreground">
          缺少 AI 标识。请使用包含 <code>?ai=your-ai-id</code> 的授权链接。
        </p>
      </div>
    )
  }
  const publicOrigin =
    (process.env.PUBLIC_APP_URL?.trim() || '').replace(/\/+$/, '') || ''

  return (
    <div className="min-h-screen bg-background">
      <SkillsOauthAuthorizeCard publicOrigin={publicOrigin} aiClientId={aiClientId} />
    </div>
  )
}

