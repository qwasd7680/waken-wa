import { NextResponse } from 'next/server'

import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const cfg = await getSiteConfigMemoryFirst()
  const enabled = cfg?.skillsDebugEnabled === true
  const modeRaw = String(cfg?.skillsAuthMode ?? '').trim().toLowerCase()
  const authMode = modeRaw === 'oauth' || modeRaw === 'apikey' ? modeRaw : 'unconfigured'

  const md = [
    '# Waken Skills (Admin debug channel)',
    '',
    'This document defines how the AI should use the **Skills** channel to assist debugging and configuration changes.',
    '',
    '## Entry points',
    `- skills.md (this file): \`GET /api/admin/skills/md\``,
    `- direct check: \`GET /api/admin/skills/direct?mode=...&token=...\``,
    '',
    '## Required headers',
    'All Skills-channel requests MUST use headers prefixed with **LLM-Skills-**:',
    '',
    '```',
    'LLM-Skills-Mode: oauth | apikey',
    'LLM-Skills-Token: <token>',
    'LLM-Skills-AI: <unique-ai-id>',
    'LLM-Skills-Scope: feature | theme | content',
    'LLM-Skills-Request-Id: <any-id>',
    '```',
    '',
    '## Mode selection (read from backend settings)',
    `- skillsEnabled: **${enabled ? 'true' : 'false'}**`,
    `- authMode: **${authMode}**`,
    '',
    '## OAuth flow (NO silent authorization)',
    '- The AI MUST send the user an authorize link with AI ID: `/admin/skills-authorize?ai=<unique-ai-id>`',
    '- The user will see a confirmation dialog; **only after user clicks “Allow”** will the token be issued.',
    '- Token is bound to the AI ID and multiple valid tokens can coexist for the same AI.',
    '- If not authorized / expired, the AI MUST stop and only return guidance.',
    '',
    '## APIKEY flow (NO second confirmation)',
    '- The AI should first check its own environment variable for an API key.',
    '- If missing, check backend configured status via admin UI.',
    '- If still missing, instruct the user to configure APIKEY first (do not proceed).',
    '- If key is available, execute immediately (no extra confirmation).',
    '',
    '## Deny list (AI Skills must NOT modify these settings)',
    '- Redis config: `useNoSqlAsCacheRedis`, `redisCacheTtlSeconds`',
    '- Activity update config: `activityUpdateMode`, `processStaleSeconds`, `historyWindowMinutes`',
    '- Steam Web API key: `steamApiKey`',
    '- Device auto accept / restrictions: `autoAcceptNewDevices`, `inspirationAllowedDeviceHashes`',
    '- Page lock: `pageLockEnabled`, `pageLockPassword`',
    '- hCaptcha: `hcaptchaEnabled`, `hcaptchaSiteKey`, `hcaptchaSecretKey`',
    '',
    '## If user did not configure Skills',
    '- Tell the user to open: Web 配置 → 进阶设置 → “允许AI使用Skills辅助调试修改”',
    '- Then select OAuth or APIKEY mode and complete authorization/key generation.',
    '',
  ].join('\n')

  return new NextResponse(md, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

