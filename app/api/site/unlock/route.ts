import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

import { createSiteLockSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { siteConfig } from '@/lib/drizzle-schema'
import { verifyHCaptchaIfEnabled } from '@/lib/hcaptcha'

export async function POST(request: NextRequest) {
  try {
    const { password, hcaptchaToken } = await request.json()
    const rawPassword = String(password ?? '')
    if (!rawPassword) {
      return NextResponse.json({ success: false, error: '请输入访问密码' }, { status: 400 })
    }

    const [config] = await db.select().from(siteConfig).where(eq(siteConfig.id, 1)).limit(1)
    if (!config?.pageLockEnabled) {
      return NextResponse.json({ success: true })
    }

    const captchaOk = await verifyHCaptchaIfEnabled(hcaptchaToken)
    if (!captchaOk) {
      return NextResponse.json(
        { success: false, error: '人机验证失败，请重试' },
        { status: 403 },
      )
    }

    const hash = String(config.pageLockPasswordHash || '')
    const ok = !!hash && (await bcrypt.compare(rawPassword, hash))
    if (!ok) {
      return NextResponse.json({ success: false, error: '访问密码错误' }, { status: 401 })
    }

    const token = await createSiteLockSession()
    const cookieStore = await cookies()
    cookieStore.set('site_lock', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('解锁主页失败:', error)
    return NextResponse.json({ success: false, error: '解锁失败' }, { status: 500 })
  }
}
