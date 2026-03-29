import 'server-only'

import { buildCustomSurfaceCss, sanitizeCssUrls } from '@/lib/theme-custom-surface'
import { readBuiltInThemePresetCss } from '@/lib/theme-preset-load'
import type { ThemePreset } from '@/types/theme'

export type { ThemePreset } from '@/types/theme'

export function getThemePresetCss(
  presetRaw: string | null | undefined,
  themeCustomSurface?: unknown,
): string {
  const preset = (presetRaw || 'basic') as ThemePreset

  if (preset === 'customSurface') {
    return buildCustomSurfaceCss(themeCustomSurface)
  }

  if (preset === 'basic') {
    return ''
  }

  return readBuiltInThemePresetCss(preset)
}

export function normalizeCustomCss(input: unknown): string {
  let s = String(input ?? '').slice(0, 20000)
  s = s
    .replace(/[<>]/g, '')
    .replace(/@import/gi, '')
    .replace(/expression\s*\(/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/behavior\s*:/gi, '')
  s = sanitizeCssUrls(s)
  return s
}
