import { count, eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { adminUsers } from '@/lib/drizzle-schema'

export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
  }

  const { id } = await params
  const userId = parseInt(id, 10)
  if (isNaN(userId)) {
    return NextResponse.json({ success: false, error: '无效的用户 ID' }, { status: 400 })
  }

  // 不能删除自己
  if (userId === session.userId) {
    return NextResponse.json({ success: false, error: '不能删除当前登录的账户' }, { status: 400 })
  }

  // 至少保留一个管理员
  const [cntRow] = await db.select({ c: count() }).from(adminUsers)
  const countVal = Number(cntRow?.c ?? 0)
  if (countVal <= 1) {
    return NextResponse.json({ success: false, error: '至少需要保留一个管理员账户' }, { status: 400 })
  }

  const [user] = await db.select().from(adminUsers).where(eq(adminUsers.id, userId)).limit(1)
  if (!user) {
    return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 })
  }

  await db.delete(adminUsers).where(eq(adminUsers.id, userId))

  return NextResponse.json({ success: true })
}
