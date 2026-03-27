import prisma from '@/lib/prisma'

export interface HCaptchaConfig {
  enabled: boolean
  siteKey: string | null
}

/** Public config safe to send to the client (no secret key). */
export async function getHCaptchaPublicConfig(): Promise<HCaptchaConfig> {
  const config = await (prisma as any).siteConfig.findUnique({ where: { id: 1 } })
  if (!config?.hcaptchaEnabled || !config.hcaptchaSiteKey || !config.hcaptchaSecretKey) {
    return { enabled: false, siteKey: null }
  }
  return { enabled: true, siteKey: config.hcaptchaSiteKey }
}

/** Verify hCaptcha response token server-side. Returns true if valid or captcha is disabled. */
export async function verifyHCaptchaIfEnabled(responseToken: string | undefined): Promise<boolean> {
  const config = await (prisma as any).siteConfig.findUnique({ where: { id: 1 } })
  if (!config?.hcaptchaEnabled || !config.hcaptchaSiteKey || !config.hcaptchaSecretKey) {
    return true
  }

  if (!responseToken) return false

  try {
    const res = await fetch('https://api.hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: config.hcaptchaSecretKey,
        response: responseToken,
      }),
    })
    const data = await res.json()
    return data?.success === true
  } catch (err) {
    console.error('[hcaptcha] verification request failed:', err)
    return false
  }
}
