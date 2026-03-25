import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'
import { createSiteLockSession } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()
    const rawPassword = String(password ?? '')
    if (!rawPassword) {
      return NextResponse.json({ success: false, error: '请输入访问密码' }, { status: 400 })
    }

    const config = await (prisma as any).siteConfig.findUnique({ where: { id: 1 } })
    if (!config?.pageLockEnabled) {
      return NextResponse.json({ success: true })
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
