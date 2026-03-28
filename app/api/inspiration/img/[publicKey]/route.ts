import { sql } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { inspirationAssets } from '@/lib/drizzle-schema'
import { parseDataImagePayload } from '@/lib/inspiration-inline-images'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ publicKey: string }> },
) {
  try {
    const { publicKey: rawKey } = await context.params
    const publicKey = decodeURIComponent(rawKey || '').trim().toLowerCase()
    if (!UUID_RE.test(publicKey)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const [row] = await db
      .select()
      .from(inspirationAssets)
      .where(
        sql`lower(cast(${inspirationAssets.publicKey} as text)) = ${publicKey}`,
      )
      .limit(1)

    if (!row?.imageDataUrl) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const parsed = parseDataImagePayload(row.imageDataUrl)
    if (!parsed) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return new NextResponse(new Uint8Array(parsed.buffer), {
      status: 200,
      headers: {
        'Content-Type': parsed.mime,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('inspiration image GET failed:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
