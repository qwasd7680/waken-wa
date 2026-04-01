import { lexicalTextContent } from '@/lib/inspiration-lexical'

/** Heuristic: whether plain text should be interpreted as markdown. */
export function inspirationLooksLikeMarkdown(text: string): boolean {
  const value = text.trim()
  if (!value) return false
  return (
    /^#{1,6}\s/m.test(value) ||
    /^\s*[-*+]\s+/m.test(value) ||
    /^\s*\d+\.\s+/m.test(value) ||
    /```[\s\S]*```/.test(value) ||
    /`[^`]+`/.test(value) ||
    /\[([^\]]+)\]\(([^)]+)\)/.test(value) ||
    /!\[([^\]]*)\]\(([^)]+)\)/.test(value) ||
    /(^|\s)(\*\*|__)[^*_\n]+(\*\*|__)(?=\s|$)/.test(value) ||
    /(^|\s)(\*|_)[^*_\n]+(\*|_)(?=\s|$)/.test(value)
  )
}

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

export function inspirationPlainPreviewAny(
  markdown: string,
  contentLexical: string | null | undefined,
  maxLen: number,
): { text: string; truncated: boolean } {
  const lexicalText = lexicalTextContent(contentLexical)
  if (!lexicalText) return inspirationPlainPreview(markdown, maxLen)
  if (lexicalText.length <= maxLen) {
    return { text: lexicalText || '（附图或格式内容）', truncated: false }
  }
  return { text: `${lexicalText.slice(0, maxLen).trim()}…`, truncated: true }
}

export function inspirationNeedsFullPageAny(
  markdown: string,
  contentLexical: string | null | undefined,
  maxInlineChars = 220,
): boolean {
  const lexicalText = lexicalTextContent(contentLexical)
  if (lexicalText) {
    if (lexicalText.length > maxInlineChars) return true
    if (lexicalText.includes('\n\n')) return true
    return false
  }
  return inspirationNeedsFullPage(markdown, maxInlineChars)
}
