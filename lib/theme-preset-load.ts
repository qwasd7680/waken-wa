import 'server-only'

import fs from 'node:fs'
import path from 'node:path'

import type { ThemePreset } from '@/types/theme'

/** Presets backed by files under styles/theme-presets/<name>.css */
const FILE_BASED_PRESETS = new Set<ThemePreset>([
  'midnight',
  'forest',
  'sakura',
  'obsidian',
  'ocean',
  'amber',
  'lavender',
  'mono',
  'nord',
])

const cache = new Map<string, string>()

export function readBuiltInThemePresetCss(preset: ThemePreset): string {
  if (!FILE_BASED_PRESETS.has(preset)) return ''

  const hit = cache.get(preset)
  if (hit !== undefined) return hit

  const file = path.join(process.cwd(), 'styles', 'theme-presets', `${preset}.css`)
  try {
    const css = fs.readFileSync(file, 'utf8')
    cache.set(preset, css)
    return css
  } catch {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[theme] missing or unreadable preset file: ${file}`)
    }
    cache.set(preset, '')
    return ''
  }
}
