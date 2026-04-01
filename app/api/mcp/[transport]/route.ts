import { createMcpHandler } from 'mcp-handler'
import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { verifyMcpThemeToolsKey } from '@/lib/mcp-theme-tools-auth'
import { safeSiteConfigUpsert } from '@/lib/safe-site-config-upsert'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import { normalizeCustomCss } from '@/lib/theme-css'
import {
  THEME_CUSTOM_SURFACE_DEFAULTS,
  buildCustomSurfaceCss,
  parseThemeCustomSurface,
} from '@/lib/theme-custom-surface'

export const dynamic = 'force-dynamic'
export const revalidate = 0
const THEME_TOOL_ALLOWED_KEYS = new Set([
  'background',
  'bodyBackground',
  'animatedBg',
  'primary',
  'foreground',
  'card',
  'border',
  'mutedForeground',
  'radius',
  'hideFloatingOrbs',
  'transparentAnimatedBg',
  'customCss',
])

function resolveSurface(cfg: Awaited<ReturnType<typeof getSiteConfigMemoryFirst>>) {
  const surface = parseThemeCustomSurface(cfg?.themeCustomSurface)
  const d = THEME_CUSTOM_SURFACE_DEFAULTS
  return {
    background: surface.background ?? d.background,
    bodyBackground: surface.bodyBackground ?? d.bodyBackground,
    animatedBg: surface.animatedBg ?? d.animatedBg,
    primary: surface.primary ?? d.primary,
    foreground: surface.foreground ?? d.foreground,
    card: surface.card ?? d.card,
    border: surface.border ?? d.border,
    mutedForeground: surface.mutedForeground ?? d.mutedForeground,
    radius: surface.radius ?? d.radius,
    hideFloatingOrbs: surface.hideFloatingOrbs ?? d.hideFloatingOrbs,
    transparentAnimatedBg: surface.transparentAnimatedBg ?? false,
  }
}

// createMcpHandler's 2nd param is ServerOptions (no auth hooks) —
// auth is enforced by the wrapper below instead.
const mcpHandler = createMcpHandler(
  (server) => {
    server.registerTool(
      'read_custom_surface',
      {
        title: 'Read Custom Surface Config',
        description:
          'Read all Custom Surface theme fields and custom CSS. Returns each field with its current value (falling back to default) and the generated CSS.',
        inputSchema: {},
      },
      async () => {
        const cfg = await getSiteConfigMemoryFirst()
        if (!cfg) {
          return { content: [{ type: 'text', text: 'Error: site config not found' }] }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  themePreset: cfg.themePreset,
                  customSurface: resolveSurface(cfg),
                  customCss: cfg.customCss ?? '',
                  generatedCss: buildCustomSurfaceCss(cfg.themeCustomSurface),
                },
                null,
                2,
              ),
            },
          ],
        }
      },
    )

    server.registerTool(
      'write_custom_surface',
      {
        title: 'Write Custom Surface Config',
        description:
          'Patch any Custom Surface theme fields and/or custom CSS. Only the fields you provide will be updated; all others remain unchanged. Automatically sets themePreset to "customSurface".',
        inputSchema: {
          background: z
            .string()
            .optional()
            .describe('Page surface color (CSS color). e.g. "oklch(0.97 0.018 85)".'),
          bodyBackground: z
            .string()
            .optional()
            .describe(
              'Full-page body background (CSS background: color, gradient or url()). Empty string = use animatedBg instead.',
            ),
          animatedBg: z
            .string()
            .optional()
            .describe('Animated background gradient/image (CSS background value).'),
          primary: z.string().optional().describe('Primary accent color (CSS color).'),
          foreground: z.string().optional().describe('Main text color (CSS color).'),
          card: z
            .string()
            .optional()
            .describe('Card/popover surface color, typically with transparency (CSS color).'),
          border: z
            .string()
            .optional()
            .describe('Border and input outline color (CSS color).'),
          mutedForeground: z
            .string()
            .optional()
            .describe('Secondary/muted text color (CSS color).'),
          radius: z.string().optional().describe('Global border radius. e.g. "0.875rem".'),
          hideFloatingOrbs: z
            .boolean()
            .optional()
            .describe('Whether to hide the floating orb decorations.'),
          transparentAnimatedBg: z
            .boolean()
            .optional()
            .describe(
              'Whether to make animatedBg transparent (body background shows through instead).',
            ),
          customCss: z
            .string()
            .optional()
            .describe('Custom CSS injected after the theme preset CSS.'),
        },
      },
      async (input) => {
        const payload =
          input && typeof input === 'object' && !Array.isArray(input)
            ? (input as Record<string, unknown>)
            : {}
        const unknownKeys = Object.keys(payload).filter((key) => !THEME_TOOL_ALLOWED_KEYS.has(key))
        if (unknownKeys.length > 0) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: only theme fields are allowed. Unknown keys: ${unknownKeys.join(', ')}`,
              },
            ],
          }
        }
        const {
          background,
          bodyBackground,
          animatedBg,
          primary,
          foreground,
          card,
          border,
          mutedForeground,
          radius,
          hideFloatingOrbs,
          transparentAnimatedBg,
          customCss,
        } = payload
        const existing = await getSiteConfigMemoryFirst()
        if (!existing) {
          return { content: [{ type: 'text', text: 'Error: site config not found' }] }
        }

        // Merge: patch provided fields onto existing, then re-sanitize
        const existingSurface = parseThemeCustomSurface(existing.themeCustomSurface)
        const merged = parseThemeCustomSurface({
          background: background !== undefined ? background : existingSurface.background,
          bodyBackground:
            bodyBackground !== undefined ? bodyBackground : existingSurface.bodyBackground,
          animatedBg: animatedBg !== undefined ? animatedBg : existingSurface.animatedBg,
          primary: primary !== undefined ? primary : existingSurface.primary,
          foreground: foreground !== undefined ? foreground : existingSurface.foreground,
          card: card !== undefined ? card : existingSurface.card,
          border: border !== undefined ? border : existingSurface.border,
          mutedForeground:
            mutedForeground !== undefined ? mutedForeground : existingSurface.mutedForeground,
          radius: radius !== undefined ? radius : existingSurface.radius,
          hideFloatingOrbs:
            hideFloatingOrbs !== undefined ? hideFloatingOrbs : existingSurface.hideFloatingOrbs,
          transparentAnimatedBg:
            transparentAnimatedBg !== undefined
              ? transparentAnimatedBg
              : existingSurface.transparentAnimatedBg,
        })

        const nextCss =
          customCss === undefined
            ? String(existing.customCss ?? '')
            : normalizeCustomCss(customCss)
        const createPayload = {
          ...existing,
          id: 1,
          themePreset: 'customSurface',
          themeCustomSurface: merged,
          customCss: nextCss,
        }

        await safeSiteConfigUpsert({
          where: { id: 1 },
          update: {
            themePreset: 'customSurface',
            themeCustomSurface: merged,
            customCss: nextCss,
          },
          create: createPayload,
        })

        const cfg = await getSiteConfigMemoryFirst()
        if (!cfg) {
          return { content: [{ type: 'text', text: 'Error: site config not found after save' }] }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  themePreset: cfg.themePreset,
                  customSurface: resolveSurface(cfg),
                  customCss: cfg.customCss ?? '',
                  generatedCss: buildCustomSurfaceCss(cfg.themeCustomSurface),
                },
                null,
                2,
              ),
            },
          ],
        }
      },
    )
  },
  {},
  {
    basePath: '/api/mcp',
    maxDuration: 60,
  },
)

async function handler(request: NextRequest): Promise<Response> {
  // CORS preflight is handled by proxy.ts middleware — 405 here is fine for OPTIONS.
  // Enforce Bearer token auth (createMcpHandler has no auth hook).
  const authHeader = request.headers.get('authorization') ?? ''
  const key = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  const authResult = await verifyMcpThemeToolsKey(key)
  if (!authResult.ok) {
    return new Response(JSON.stringify({ error: authResult.error }), {
      status: authResult.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Return mcpHandler's response directly — do NOT wrap/copy the body,
  // as it may be a streaming response and wrapping breaks the stream.
  return mcpHandler(request)
}

export { handler as DELETE, handler as GET, handler as OPTIONS, handler as POST }
