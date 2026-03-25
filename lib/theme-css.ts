export type ThemePreset = 'basic' | 'midnight' | 'forest' | 'sakura'

export function getThemePresetCss(presetRaw: string | null | undefined): string {
  const preset = (presetRaw || 'basic') as ThemePreset

  if (preset === 'midnight') {
    return `
:root {
  --background: oklch(0.16 0.01 260);
  --foreground: oklch(0.96 0.01 260);
  --card: oklch(0.2 0.01 260);
  --primary: oklch(0.72 0.14 260);
  --accent: oklch(0.76 0.12 220);
  --border: oklch(0.32 0.02 260);
  --online: oklch(0.76 0.18 160);
}
.animated-bg {
  background:
    radial-gradient(ellipse 70% 50% at 50% -20%, rgba(90, 110, 220, 0.25), transparent),
    radial-gradient(ellipse 60% 40% at 100% 100%, rgba(120, 90, 220, 0.2), transparent),
    radial-gradient(ellipse 50% 30% at 0% 80%, rgba(80, 140, 230, 0.15), transparent);
}
`
  }

  if (preset === 'forest') {
    return `
:root {
  --background: oklch(0.965 0.012 150);
  --foreground: oklch(0.24 0.03 150);
  --card: oklch(0.985 0.01 150);
  --primary: oklch(0.48 0.12 150);
  --accent: oklch(0.68 0.12 140);
  --border: oklch(0.88 0.02 150);
  --online: oklch(0.62 0.16 145);
}
`
  }

  if (preset === 'sakura') {
    return `
:root {
  --background: oklch(0.98 0.01 20);
  --foreground: oklch(0.27 0.02 20);
  --card: oklch(0.995 0.008 20);
  --primary: oklch(0.62 0.16 10);
  --accent: oklch(0.78 0.12 20);
  --border: oklch(0.9 0.015 20);
  --online: oklch(0.64 0.16 150);
}
`
  }

  // basic: keep default CSS as-is.
  return ''
}

export function normalizeCustomCss(input: unknown): string {
  const value = String(input ?? '')
  // Keep overrides bounded to avoid accidental huge payloads.
  return value.slice(0, 20000)
}
