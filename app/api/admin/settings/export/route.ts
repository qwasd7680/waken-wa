import { desc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { apiTokens, siteConfig } from '@/lib/drizzle-schema'
import {
  normalizeHitokotoCategories,
  normalizeHitokotoEncode,
} from '@/lib/hitokoto'
import {
  backfillCoursePeriodIdsFromTemplate,
  resolveSchedulePeriodTemplate,
} from '@/lib/schedule-courses'
import { resolveScheduleGridByWeekday } from '@/lib/schedule-grid-by-weekday'

async function requireAdmin() {
  const session = await getSession()
  return session ?? null
}

function getBaseUrl(request: Request): string {
  const envUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim()
  if (envUrl) return envUrl.replace(/\/+$/, '')
  const url = new URL(request.url)
  return `${url.protocol}//${url.host}`
}

export async function GET(request: Request) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }

  try {
    const [cfgRows, tokens] = await Promise.all([
      db.select().from(siteConfig).where(eq(siteConfig.id, 1)).limit(1),
      db
        .select({
          id: apiTokens.id,
          name: apiTokens.name,
          token: apiTokens.token,
          isActive: apiTokens.isActive,
          createdAt: apiTokens.createdAt,
          lastUsedAt: apiTokens.lastUsedAt,
        })
        .from(apiTokens)
        .orderBy(desc(apiTokens.createdAt)),
    ])
    const cfg = cfgRows[0]

    if (!cfg) {
      return NextResponse.json(
        { success: false, error: '未找到网页配置，请先完成初始化配置' },
        { status: 400 },
      )
    }

    const baseUrl = getBaseUrl(request)
    const schedulePeriodTemplate = resolveSchedulePeriodTemplate(cfg.schedulePeriodTemplate)
    const scheduleCoursesRaw = Array.isArray(cfg.scheduleCourses)
      ? cfg.scheduleCourses
      : []
    const scheduleCourses = backfillCoursePeriodIdsFromTemplate(
      scheduleCoursesRaw,
      schedulePeriodTemplate,
    ).courses

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      web: {
        pageTitle: cfg.pageTitle,
        userName: cfg.userName,
        userBio: cfg.userBio,
        avatarUrl: cfg.avatarUrl,
        userNote: cfg.userNote,
        userNoteHitokotoEnabled: Boolean(cfg.userNoteHitokotoEnabled),
        userNoteHitokotoCategories: normalizeHitokotoCategories(
          cfg.userNoteHitokotoCategories,
        ),
        userNoteHitokotoEncode: normalizeHitokotoEncode(cfg.userNoteHitokotoEncode),
        themePreset: cfg.themePreset,
        themeCustomSurface: cfg.themeCustomSurface,
        customCss: cfg.customCss,
        historyWindowMinutes: cfg.historyWindowMinutes,
        processStaleSeconds: cfg.processStaleSeconds ?? 500,
        appMessageRules: cfg.appMessageRules,
        appMessageRulesShowProcessName: cfg.appMessageRulesShowProcessName !== false,
        appBlacklist: cfg.appBlacklist,
        appWhitelist: cfg.appWhitelist,
        appFilterMode: cfg.appFilterMode,
        appNameOnlyList: cfg.appNameOnlyList,
        pageLockEnabled: cfg.pageLockEnabled,
        currentlyText: cfg.currentlyText,
        earlierText: cfg.earlierText,
        adminText: cfg.adminText,
        autoAcceptNewDevices: Boolean(cfg.autoAcceptNewDevices),
        inspirationAllowedDeviceHashes:
          cfg.inspirationAllowedDeviceHashes === null ||
          cfg.inspirationAllowedDeviceHashes === undefined
            ? null
            : cfg.inspirationAllowedDeviceHashes,
        scheduleSlotMinutes: cfg.scheduleSlotMinutes ?? 30,
        schedulePeriodTemplate,
        scheduleGridByWeekday: resolveScheduleGridByWeekday(
          cfg.scheduleGridByWeekday,
          cfg.scheduleSlotMinutes ?? 30,
        ),
        scheduleCourses,
        scheduleIcs: cfg.scheduleIcs ?? null,
        scheduleInClassOnHome: Boolean(cfg.scheduleInClassOnHome),
        scheduleHomeShowLocation: Boolean(cfg.scheduleHomeShowLocation),
        scheduleHomeShowTeacher: Boolean(cfg.scheduleHomeShowTeacher),
        scheduleHomeShowNextUpcoming: Boolean(cfg.scheduleHomeShowNextUpcoming),
        scheduleHomeAfterClassesLabel:
          typeof cfg.scheduleHomeAfterClassesLabel === 'string' &&
          cfg.scheduleHomeAfterClassesLabel.trim().length > 0
            ? cfg.scheduleHomeAfterClassesLabel.trim().slice(0, 40)
            : '正在摸鱼',
        globalMouseTiltEnabled: cfg.globalMouseTiltEnabled === true,
        hideActivityMedia: cfg.hideActivityMedia === true,
      },
      token: {
        reportEndpoint: `${baseUrl}/api/activity`,
        items: tokens.map((t: {
          id: number
          name: string
          isActive: boolean
          createdAt: Date
          lastUsedAt: Date | null
        }) => ({
          id: t.id,
          name: t.name,
          isActive: t.isActive,
          createdAt: t.createdAt,
          lastUsedAt: t.lastUsedAt,
          token: null,
        })),
      },
    }

    const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
    return NextResponse.json({ success: true, data: { encoded } })
  } catch (error) {
    console.error('导出配置失败:', error)
    return NextResponse.json({ success: false, error: '导出失败' }, { status: 500 })
  }
}
