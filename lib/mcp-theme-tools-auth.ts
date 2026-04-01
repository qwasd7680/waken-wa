import 'server-only'

import { randomBytes } from 'node:crypto'

import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { systemSecrets } from '@/lib/drizzle-schema'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'

const MCP_THEME_TOOLS_SECRET_KEY = 'mcp_theme_tools_key_bcrypt'

type GuardOk = { ok: true }
type GuardFail = { ok: false; response: NextResponse }

type VerifyResult = { ok: true } | { ok: false; error: string; status: number }

export async function verifyMcpThemeToolsKey(key: string): Promise<VerifyResult> {
  const cfg = await getSiteConfigMemoryFirst()
  if (cfg?.mcpThemeToolsEnabled !== true) {
    return { ok: false, error: 'Not found', status: 404 }
  }

  if (!key) {
    return { ok: false, error: '未授权', status: 401 }
  }

  const [row] = await db
    .select({ value: systemSecrets.value })
    .from(systemSecrets)
    .where(eq(systemSecrets.key, MCP_THEME_TOOLS_SECRET_KEY))
    .limit(1)

  const stored = row?.value?.trim()
  if (!stored) {
    return { ok: false, error: 'MCP key 未初始化（请先在后台设置）', status: 503 }
  }

  const ok = await bcrypt.compare(key, stored)
  if (!ok) {
    return { ok: false, error: '未授权', status: 401 }
  }

  return { ok: true }
}

export async function requireMcpThemeToolsEnabledAndKey(
  request: NextRequest,
): Promise<GuardOk | GuardFail> {
  const key = new URL(request.url).searchParams.get('key') ?? ''
  const result = await verifyMcpThemeToolsKey(key)
  if (!result.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      ),
    }
  }
  return { ok: true }
}

export async function setMcpThemeToolsKeyBcryptHash(plainKey: string): Promise<void> {
  const trimmed = String(plainKey ?? '').trim()
  if (!trimmed) {
    throw new Error('Empty MCP key')
  }
  if (trimmed.length > 200) {
    throw new Error('MCP key too long')
  }

  const hash = await bcrypt.hash(trimmed, 12)
  await db
    .insert(systemSecrets)
    .values({ key: MCP_THEME_TOOLS_SECRET_KEY, value: hash })
    .onConflictDoUpdate({ target: systemSecrets.key, set: { value: hash } })
}

export async function hasMcpThemeToolsKeyConfigured(): Promise<boolean> {
  const [row] = await db
    .select({ value: systemSecrets.value })
    .from(systemSecrets)
    .where(eq(systemSecrets.key, MCP_THEME_TOOLS_SECRET_KEY))
    .limit(1)
  return typeof row?.value === 'string' && row.value.trim().length > 0
}

export async function rotateMcpThemeToolsKey(): Promise<string> {
  const plain = randomBytes(32).toString('base64url')
  await setMcpThemeToolsKeyBcryptHash(plain)
  return plain
}

