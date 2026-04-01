import { count, desc, eq, or, sql } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import { ACTIVITY_FEED_DEFAULT_LIMIT } from '@/lib/activity-api-constants'
import { getActivityFeedData } from '@/lib/activity-feed'
import {
  ADMIN_LIST_DEFAULT_PAGE_SIZE,
  ADMIN_LIST_MAX_PAGE_SIZE,
} from '@/lib/admin-list-constants'
import { getBearerApiTokenRecord, getSession, isSiteLockSatisfied } from '@/lib/auth'
import { db } from '@/lib/db'
import { inspirationEntries, siteConfig } from '@/lib/drizzle-schema'
import { gateInspirationApiForDevice } from '@/lib/inspiration-device-allowlist'
import { linkInspirationAssetsToEntry, validateInlineImageDataUrl } from '@/lib/inspiration-inline-images'
import {
  lexicalHasVisibleText,
  lexicalTextContent,
  normalizeLexicalJsonString,
} from '@/lib/inspiration-lexical'
import { sqlTimestamp } from '@/lib/sql-timestamp'
import { normalizeTimezone } from '@/lib/timezone'

function formatStatusSnapshotFromStatuses(
  statuses: Array<{ statusText?: string; processName?: string; processTitle?: string | null }>,
): string | null {
  const lines = statuses
    .map((s: { statusText?: string; processName?: string; processTitle?: string | null }) => {
      const st = String(s?.statusText ?? '').trim()
      if (st) return st
      const pn = String(s?.processName ?? '').trim()
      const pt = s?.processTitle != null ? String(s.processTitle).trim() : ''
      if (pt && pn) return `${pt} | ${pn}`
      return pn || pt || ''
    })
    .filter(Boolean)
  if (lines.length === 0) return null
  return lines.join('\n')
}

// Force dynamic rendering, disable caching
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    if (!(await isSiteLockSatisfied())) {
      return NextResponse.json({ success: false, error: '页面已锁定' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(
      parseInt(searchParams.get('limit') || String(ADMIN_LIST_DEFAULT_PAGE_SIZE), 10),
      ADMIN_LIST_MAX_PAGE_SIZE,
    )
    const offset = parseInt(searchParams.get('offset') || '0')
    const q = searchParams.get('q')?.trim()

    const pattern = q ? `%${q}%` : null
    const searchCond =
      pattern &&
      or(
        sql`coalesce(lower(${inspirationEntries.title}), '') like lower(${pattern})`,
        sql`lower(${inspirationEntries.content}) like lower(${pattern})`,
        sql`coalesce(lower(${inspirationEntries.contentLexical}), '') like lower(${pattern})`,
        sql`coalesce(lower(${inspirationEntries.statusSnapshot}), '') like lower(${pattern})`,
      )

    const listBase = db.select().from(inspirationEntries).orderBy(desc(inspirationEntries.createdAt))
    const countBase = db.select({ c: count() }).from(inspirationEntries)

    const [items, [totalRow], [config]] = await Promise.all([
      (searchCond ? listBase.where(searchCond) : listBase).limit(limit).offset(offset),
      searchCond ? countBase.where(searchCond) : countBase,
      db.select({ displayTimezone: siteConfig.displayTimezone }).from(siteConfig).limit(1),
    ])
    const displayTimezone = normalizeTimezone(config?.displayTimezone)

    return NextResponse.json({
      success: true,
      data: items,
      displayTimezone,
      pagination: { limit, offset, total: Number(totalRow?.c ?? 0) },
    })
  } catch (error) {
    console.error('获取灵感条目失败:', error)
    return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  const apiToken = await getBearerApiTokenRecord(request.headers.get('authorization'))

  if (!session && !apiToken) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }

  try {
    const body = await request.json()
    if (!session && apiToken) {
      const gate = await gateInspirationApiForDevice(
        apiToken.id,
        request,
        body && typeof body === 'object' ? (body as Record<string, unknown>) : null,
      )
      if (!gate.ok) {
        return NextResponse.json({ success: false, error: gate.error }, { status: gate.status })
      }
    }
    const attachCurrentStatus = Boolean(body?.attachCurrentStatus)
    const attachStatusDeviceHashes = Array.isArray(body?.attachStatusDeviceHashes)
      ? body.attachStatusDeviceHashes
          .map((item: unknown) => String(item ?? '').trim().toLowerCase())
          .filter((item: string) => item.length > 0)
      : []

    if (attachCurrentStatus && !session) {
      return NextResponse.json(
        { success: false, error: '仅登录管理员可附带当前状态' },
        { status: 403 },
      )
    }

    const titleRaw = body?.title ?? body?.heading
    const title =
      typeof titleRaw === 'string' ? titleRaw.trim() : null
    const titleFinal = title && title.length > 0 ? title : null

    const contentRaw = body?.content ?? body?.text ?? body?.body
    const contentLexicalRaw = body?.contentLexical ?? body?.content_lexical
    const contentLexical = normalizeLexicalJsonString(contentLexicalRaw)
    const contentMarkdown =
      typeof contentRaw === 'string' ? contentRaw.trim() : ''
    const contentFromLexical = lexicalTextContent(contentLexical)
    const content = contentMarkdown || contentFromLexical
    const hasLexicalContent = lexicalHasVisibleText(contentLexical)
    if (!content && !hasLexicalContent) {
      return NextResponse.json({ success: false, error: '缺少 content' }, { status: 400 })
    }

    const imageDataUrlRaw = body?.imageDataUrl ?? body?.dataUrl ?? body?.image_data_url
    const imageDataUrl =
      typeof imageDataUrlRaw === 'string' && imageDataUrlRaw.trim().length > 0
        ? imageDataUrlRaw.trim()
        : null

    if (imageDataUrl) {
      const imgCheck = validateInlineImageDataUrl(imageDataUrl)
      if (!imgCheck.ok) {
        return NextResponse.json({ success: false, error: imgCheck.error }, { status: 400 })
      }
    }

    let statusSnapshot: string | null = null
    if (attachCurrentStatus && session) {
      const feed = await getActivityFeedData(ACTIVITY_FEED_DEFAULT_LIMIT, {
        includeGeneratedHashKey: attachStatusDeviceHashes.length > 0,
      })
      const statuses = attachStatusDeviceHashes.length
        ? (feed.activeStatuses as Array<{
            generatedHashKey?: string
            statusText?: string
            processName?: string
            processTitle?: string | null
          }>).filter((item) =>
            attachStatusDeviceHashes.includes(
              String(item.generatedHashKey ?? '').trim().toLowerCase(),
            ),
          )
        : feed.activeStatuses
      statusSnapshot = formatStatusSnapshotFromStatuses(statuses)
    }

    const now = sqlTimestamp()
    const [entry] = await db
      .insert(inspirationEntries)
      .values({
        title: titleFinal,
        content,
        contentLexical,
        imageDataUrl,
        statusSnapshot,
        updatedAt: now,
      })
      .returning()

    await linkInspirationAssetsToEntry(entry!.id, content, contentLexical)

    return NextResponse.json({ success: true, data: entry }, { status: 201 })
  } catch (error) {
    console.error('提交灵感条目失败:', error)
    return NextResponse.json({ success: false, error: '提交失败' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const idRaw = searchParams.get('id')
    const id = idRaw ? parseInt(idRaw) : NaN
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ success: false, error: '缺少有效的 id' }, { status: 400 })
    }

    await db.delete(inspirationEntries).where(eq(inspirationEntries.id, id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除灵感条目失败:', error)
    return NextResponse.json({ success: false, error: '删除失败' }, { status: 500 })
  }
}
