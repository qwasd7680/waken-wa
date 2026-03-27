'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { ChevronRight } from 'lucide-react'
import { MarkdownContent } from '@/components/admin/markdown-content'
import { inspirationNeedsFullPage, inspirationPlainPreview } from '@/lib/inspiration-preview'

export type InspirationHomeItem = {
  id: number
  title: string | null
  content: string
  imageDataUrl: string | null
  statusSnapshot: string | null
  createdAt: string
}

const PREVIEW_CHARS = 220

export function InspirationHomeSection({
  entries,
  showArchiveLink,
}: {
  entries: InspirationHomeItem[]
  /** True when there are more entries than shown on the home page */
  showArchiveLink?: boolean
}) {
  if (entries.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8 text-sm">暂无随想记录</div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-5">
        {entries.map((entry) => {
          const detailHref = `/inspiration/${entry.id}`
          const needFull = inspirationNeedsFullPage(entry.content)
          const { text: previewText } = inspirationPlainPreview(entry.content, PREVIEW_CHARS)

          return (
            <article
              key={entry.id}
              className="border border-border rounded-md overflow-hidden bg-card/80 backdrop-blur-sm hover:border-foreground/20 transition-colors"
            >
              {entry.imageDataUrl ? (
                <Link href={detailHref} className="block border-b border-border/60 bg-muted/30">
                  <img
                    src={entry.imageDataUrl}
                    alt=""
                    className="w-full max-h-52 sm:max-h-60 object-cover object-center"
                  />
                </Link>
              ) : null}

              <div className="p-4 sm:p-5 space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link
                    href={detailHref}
                    className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                  >
                    {entry.title?.trim() ? entry.title : '（无标题）'}
                  </Link>
                  <time className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {format(new Date(entry.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                  </time>
                </div>

                {entry.statusSnapshot ? (
                  <div className="rounded-md border border-dashed border-border/80 bg-muted/20 px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap max-h-28 overflow-y-auto">
                    {entry.statusSnapshot}
                  </div>
                ) : null}

                {needFull ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {previewText}
                    </p>
                    <Link
                      href={detailHref}
                      className="inline-flex items-center gap-0.5 text-sm font-medium text-primary hover:underline"
                    >
                      查看全文
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </div>
                ) : (
                  <MarkdownContent
                    markdown={entry.content}
                    className="text-sm text-muted-foreground"
                    imageClassName="max-h-64 w-auto rounded-md border border-border/60 my-3"
                  />
                )}
              </div>
            </article>
          )
        })}
      </div>

      {showArchiveLink ? (
        <div className="flex justify-center pt-1">
          <Link
            href="/inspiration"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            查看更多随想录
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      ) : null}
    </div>
  )
}
