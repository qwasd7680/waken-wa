import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import {
  inspirationInlineImageUrl,
  validateInlineImageDataUrl,
} from '@/lib/inspiration-inline-images'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function validateApiToken(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return false

  const token = authHeader.slice(7)
  const result = await prisma.apiToken.findFirst({
    where: { token, isActive: true },
  })

  if (!result) return false

  await prisma.apiToken.update({
    where: { id: result.id },
    data: { lastUsedAt: new Date() },
  })

  return true
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  const tokenOk = await validateApiToken(request)

  if (!session && !tokenOk) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const imageDataUrlRaw = body?.imageDataUrl ?? body?.dataUrl
    const imageDataUrl =
      typeof imageDataUrlRaw === 'string' && imageDataUrlRaw.trim().length > 0
        ? imageDataUrlRaw.trim()
        : ''

    if (!imageDataUrl) {
      return NextResponse.json({ success: false, error: '缺少 imageDataUrl' }, { status: 400 })
    }

    const check = validateInlineImageDataUrl(imageDataUrl)
    if (!check.ok) {
      return NextResponse.json({ success: false, error: check.error }, { status: 400 })
    }

    const row = await (prisma as any).inspirationAsset.create({
      data: {
        imageDataUrl,
        inspirationEntryId: null,
      },
    })

    const url = inspirationInlineImageUrl(row.publicKey)

    return NextResponse.json(
      {
        success: true,
        data: {
          publicKey: row.publicKey,
          url,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('inspiration asset upload failed:', error)
    return NextResponse.json({ success: false, error: '上传失败' }, { status: 500 })
  }
}
