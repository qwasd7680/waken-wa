import { type NextRequest,NextResponse } from 'next/server'

import { isRateLimited } from '@/lib/rate-limit'

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_AUTH = 10

const RATE_LIMITED_PATHS = new Set([
  '/api/auth/login',
  '/api/site/unlock',
  '/api/admin/change-password',
  '/api/health',
])

const ADMIN_API_PREFIX = '/api/admin/'
const ADMIN_SETUP_PREFIX = '/api/admin/setup'
const SKILLS_HEADER_PREFIX = 'llm-skills-'
const ADMIN_SKILLS_DIRECT_PATH = '/api/admin/skills/direct'
const ADMIN_SKILLS_MD_PATH = '/api/admin/skills/md'

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()',
  )
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    )
  }
  return response
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (RATE_LIMITED_PATHS.has(pathname) && request.method === 'POST') {
    const ip = getClientIp(request)
    if (
      await isRateLimited(`rl:${pathname}:${ip}`, RATE_LIMIT_MAX_AUTH, RATE_LIMIT_WINDOW_MS)
    ) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: '请求过于频繁，请稍后再试' },
          { status: 429 },
        ),
      )
    }
  }

  // Defense-in-depth: reject admin API calls that lack a session cookie.
  // The actual JWT verification still happens inside each route handler.
  if (
    pathname.startsWith(ADMIN_API_PREFIX) &&
    !pathname.startsWith(ADMIN_SETUP_PREFIX)
  ) {
    const isSkillsDirect = pathname === ADMIN_SKILLS_DIRECT_PATH
    const isSkillsMd = pathname === ADMIN_SKILLS_MD_PATH
    const hasSkillsHeaders = (() => {
      for (const [k] of request.headers.entries()) {
        if (k.toLowerCase().startsWith(SKILLS_HEADER_PREFIX)) return true
      }
      return false
    })()

    const sessionCookie = request.cookies.get('session')
    if (!sessionCookie?.value && !hasSkillsHeaders && !isSkillsDirect && !isSkillsMd) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: '未授权' },
          { status: 401 },
        ),
      )
    }
  }

  return addSecurityHeaders(NextResponse.next())
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
