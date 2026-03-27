import { NextResponse } from 'next/server'
import { getActivityFeedData } from '@/lib/activity-feed'
import { isSiteLockSatisfied } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

function toSseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export async function GET() {
  if (!(await isSiteLockSatisfied())) {
    return NextResponse.json({ success: false, error: '页面已锁定' }, { status: 403 })
  }

  const encoder = new TextEncoder()
  let timer: ReturnType<typeof setInterval> | null = null
  let closed = false

  const cleanup = () => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    closed = true
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const safeEnqueue = (chunk: Uint8Array): boolean => {
        if (closed) return false
        try {
          controller.enqueue(chunk)
          return true
        } catch {
          cleanup()
          return false
        }
      }

      const push = async () => {
        if (closed) return
        try {
          const payload = await getActivityFeedData(50)
          safeEnqueue(
            encoder.encode(
              toSseEvent('activity', { success: true, data: payload })
            )
          )
        } catch (error) {
          if (closed) return
          console.error('[activity stream] push failed:', error)
          safeEnqueue(
            encoder.encode(
              toSseEvent('error', {
                success: false,
                error: 'stream update failed',
              })
            )
          )
        }
      }

      void push()
      timer = setInterval(() => {
        void push()
      }, 5000)
    },
    cancel() {
      cleanup()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
