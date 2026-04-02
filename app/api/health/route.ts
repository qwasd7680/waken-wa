import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import { resolveActiveApiTokenFromPlainSecret } from '@/lib/api-token-secret'
import { getSession, isSiteLockSatisfied } from '@/lib/auth'
import { db } from '@/lib/db'
import { clearDeviceAuthCache } from '@/lib/device-auth-cache'
import { devices } from '@/lib/drizzle-schema'
import {
  findActiveDeviceByHash,
  getLatestHealthSummary,
  healthUploadSchema,
  insertHealthSample,
} from '@/lib/health-data'
import { buildDeviceApprovalUrl } from '@/lib/public-request-url'
import { isRateLimited } from '@/lib/rate-limit'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import { sqlTimestamp } from '@/lib/sql-timestamp'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_UPLOAD = 30

async function validateToken(request: NextRequest): Promise<{ id: number } | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  return resolveActiveApiTokenFromPlainSecret(authHeader.slice(7))
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const isPublicMode = searchParams.get('public') === '1'

    if (isPublicMode) {
      const lockOk = await isSiteLockSatisfied()
      if (!lockOk) {
        return NextResponse.json({ success: false, error: '请先解锁页面' }, { status: 403 })
      }
      const summary = await getLatestHealthSummary()
      return NextResponse.json({ success: true, data: summary })
    }

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
    }

    const summary = await getLatestHealthSummary()
    return NextResponse.json({ success: true, data: summary })
  } catch (error) {
    console.error('获取健康数据失败:', error)
    return NextResponse.json({ success: false, error: '获取健康数据失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const tokenInfo = await validateToken(request)
    if (!tokenInfo) {
      return NextResponse.json({ success: false, error: '无效的 API Token' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = healthUploadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: '请求体格式错误',
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 },
      )
    }

    const hasMetric =
      parsed.data.heartRate != null ||
      parsed.data.restingHeartRate != null ||
      parsed.data.bloodOxygen != null ||
      parsed.data.stepCount != null ||
      parsed.data.distanceMeters != null ||
      parsed.data.caloriesKcal != null ||
      parsed.data.sleepMinutes != null ||
      parsed.data.stressLevel != null ||
      parsed.data.payload != null
    if (!hasMetric) {
      return NextResponse.json(
        { success: false, error: '至少需要上传一个健康指标字段' },
        { status: 400 },
      )
    }

    const ip = getClientIp(request)
    const limited = await isRateLimited(
      `rl:health-upload:${tokenInfo.id}:${parsed.data.generatedHashKey}:${ip}`,
      RATE_LIMIT_MAX_UPLOAD,
      RATE_LIMIT_WINDOW_MS,
    )
    if (limited) {
      return NextResponse.json(
        { success: false, error: '上传过于频繁，请稍后再试' },
        { status: 429 },
      )
    }

    let deviceRecord = await findActiveDeviceByHash(parsed.data.generatedHashKey)
    const siteCfg = await getSiteConfigMemoryFirst()

    if (!deviceRecord) {
      const autoAccept = Boolean(siteCfg?.autoAcceptNewDevices)
      const now = sqlTimestamp()
      const [created] = await db
        .insert(devices)
        .values({
          generatedHashKey: parsed.data.generatedHashKey,
          displayName: parsed.data.device || 'Samsung Watch',
          status: autoAccept ? 'active' : 'pending',
          apiTokenId: tokenInfo.id,
          lastSeenAt: autoAccept ? now : null,
          updatedAt: now,
        })
        .returning()
      deviceRecord = created ?? null
      clearDeviceAuthCache()

      if (!autoAccept) {
        return NextResponse.json(
          {
            success: false,
            error: '设备待后台审核后可用',
            pending: true,
            approvalUrl: buildDeviceApprovalUrl(request, parsed.data.generatedHashKey),
          },
          { status: 202 },
        )
      }
    }

    if (!deviceRecord) {
      return NextResponse.json({ success: false, error: '设备初始化失败' }, { status: 500 })
    }

    if (deviceRecord.status === 'pending') {
      return NextResponse.json(
        {
          success: false,
          error: '设备待后台审核后可用',
          pending: true,
          approvalUrl: buildDeviceApprovalUrl(request, parsed.data.generatedHashKey),
        },
        { status: 202 },
      )
    }

    if (deviceRecord.status !== 'active') {
      return NextResponse.json({ success: false, error: '设备不可用或不存在' }, { status: 403 })
    }

    if (deviceRecord.apiTokenId && deviceRecord.apiTokenId !== tokenInfo.id) {
      return NextResponse.json({ success: false, error: '该设备未绑定当前 Token' }, { status: 403 })
    }

    await insertHealthSample({
      deviceId: deviceRecord.id,
      generatedHashKey: parsed.data.generatedHashKey,
      sample: parsed.data,
    })

    await db
      .update(devices)
      .set({
        displayName: parsed.data.device || deviceRecord.displayName,
        lastSeenAt: sqlTimestamp(),
        updatedAt: sqlTimestamp(),
      })
      .where(eq(devices.id, deviceRecord.id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('上传健康数据失败:', error)
    return NextResponse.json({ success: false, error: '上传健康数据失败' }, { status: 500 })
  }
}

