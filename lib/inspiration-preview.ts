/** Plain-text teaser for home list; keeps markdown out of truncated display. */
export function inspirationPlainPreview(markdown: string, maxLen: number): { text: string; truncated: boolean } {
  const text = markdown
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= maxLen) return { text: text || '（附图或格式内容）', truncated: false }
  return { text: `${text.slice(0, maxLen).trim()}…`, truncated: true }
}

/** Whether home should offer “full article” instead of inline full markdown. */
export function inspirationNeedsFullPage(markdown: string, maxInlineChars = 220): boolean {
  if (markdown.length > maxInlineChars) return true
  if (markdown.includes('\n\n')) return true
  if (/!\[[^\]]*\]\(/.test(markdown)) return true
  return false
}
