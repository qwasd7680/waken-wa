import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { SiteLockForm } from '@/components/site-lock-form'
import { verifySiteLockSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { siteConfig } from '@/lib/drizzle-schema'
import { getHCaptchaPublicConfig } from '@/lib/hcaptcha'
import { getThemePresetCss } from '@/lib/theme-css'

export default async function InspirationLayout({ children }: { children: React.ReactNode }) {
  const [config] = await db.select().from(siteConfig).limit(1)
  if (!config) {
    redirect('/admin/setup')
  }

  if (config.pageLockEnabled) {
    const cookieStore = await cookies()
    const token = cookieStore.get('site_lock')?.value
    const unlocked = token ? await verifySiteLockSession(token) : null
    if (!unlocked) {
      const hcaptcha = await getHCaptchaPublicConfig()
      return <SiteLockForm hcaptchaEnabled={hcaptcha.enabled} hcaptchaSiteKey={hcaptcha.siteKey} />
    }
  }

  const themePresetCss = getThemePresetCss(config.themePreset, config.themeCustomSurface)
  const customCss = String(config.customCss ?? '')
  const themeCss = `${themePresetCss}\n${customCss}`.trim()

  return (
    <>
      {themeCss ? (
        <style id="site-theme-override" dangerouslySetInnerHTML={{ __html: themeCss }} />
      ) : null}
      <div className="animated-bg">
        <div className="floating-orb floating-orb-1" />
        <div className="floating-orb floating-orb-2" />
        <div className="floating-orb floating-orb-3" />
      </div>
      {children}
    </>
  )
}
