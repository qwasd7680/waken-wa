import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

async function requireAdmin() {
  const session = await getSession()
  return session ?? null
}

export async function GET() {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }

  try {
    const config = await (prisma as any).siteConfig.findUnique({ where: { id: 1 } })
    return NextResponse.json({ success: true, data: config })
  } catch (error) {
    console.error('读取站点配置失败:', error)
    return NextResponse.json({ success: false, error: '读取失败' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const userName = String(body.userName ?? '').trim()
    const userBio = String(body.userBio ?? '').trim()
    const avatarUrl = String(body.avatarUrl ?? '').trim()
    const userNote = String(body.userNote ?? '').trim()
    const currentlyText = String(body.currentlyText ?? '').trim() || 'currently'
    const earlierText = String(body.earlierText ?? '').trim() || 'earlier'
    const updatesText =
      String(body.updatesText ?? '').trim() || 'updates every 30 seconds'
    const adminText = String(body.adminText ?? '').trim() || 'admin'
    const parsedWindow = Number(body.historyWindowMinutes ?? 120)
    const historyWindowMinutes = Number.isFinite(parsedWindow)
      ? Math.min(Math.max(Math.round(parsedWindow), 10), 24 * 60)
      : 120

    if (!userName || !userBio || !avatarUrl) {
      return NextResponse.json(
        { success: false, error: '请填写首页必填信息' },
        { status: 400 }
      )
    }

    const config = await (prisma as any).siteConfig.upsert({
      where: { id: 1 },
      update: {
        userName,
        userBio,
        avatarUrl,
        userNote,
        historyWindowMinutes,
        currentlyText,
        earlierText,
        updatesText,
        adminText,
      },
      create: {
        id: 1,
        userName,
        userBio,
        avatarUrl,
        userNote,
        historyWindowMinutes,
        currentlyText,
        earlierText,
        updatesText,
        adminText,
      },
    })

    return NextResponse.json({ success: true, data: config })
  } catch (error) {
    console.error('更新站点配置失败:', error)
    return NextResponse.json({ success: false, error: '更新失败' }, { status: 500 })
  }
}
