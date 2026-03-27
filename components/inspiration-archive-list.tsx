'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Loader2 } from 'lucide-react'
import type { InspirationHomeItem } from '@/components/inspiration-home-section'
import { inspirationPlainPreview } from '@/lib/inspiration-preview'

const PAGE = 10

export function InspirationArchiveList() {
  const [items, setItems] = useState<InspirationHomeItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [initialDone, setInitialDone] = useState(false)

  const itemsRef = useRef<InspirationHomeItem[]>([])
  const totalRef = useRef(0)
  const loadingLock = useRef(false)
  const doneRef = useRef(false)

  itemsRef.current = items
  totalRef.current = total

  const loadNext = useCallback(async () => {
    if (loadingLock.current) return
    if (doneRef.current) return
    const len = itemsRef.current.length
    const t = totalRef.current
    if (t > 0 && len >= t) {
      doneRef.current = true
      return
    }

    loadingLock.current = true
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: String(PAGE), offset: String(len) })
      const res = await fetch(`/api/inspiration/entries?${params}`)
      const data = await res.json()
      if (!data?.success) {
        doneRef.current = true
        return
      }

      const batch: InspirationHomeItem[] = (data.data || []).map(
        (row: { createdAt: string | Date; [k: string]: unknown }) => ({
          ...row,
          createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date(row.createdAt).toISOString(),
        })
      )
      const nextTotal = data.pagination?.total ?? 0
      setTotal(nextTotal)

      if (batch.length === 0) {
        doneRef.current = true
        return
      }

      setItems((prev) => {
        const merged = [...prev, ...batch]
        if (merged.length >= nextTotal) doneRef.current = true
        return merged
      })
    } finally {
      loadingLock.current = false
      setLoading(false)
      setInitialDone(true)
    }
  }, [])

  useEffect(() => {
    void loadNext()
  }, [loadNext])

  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadNext()
      },
      { rootMargin: '160px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [loadNext])

  if (!initialDone && items.length === 0 && loading) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" aria-label="Loading" />
      </div>
    )
  }

  if (initialDone && items.length === 0) {
    return <p className="text-center text-sm text-muted-foreground py-12">暂无随想记录</p>
  }

  return (
    <div className="space-y-5">
      {items.map((entry) => {
        const href = `/inspiration/${entry.id}`
        const { text: teaser } = inspirationPlainPreview(entry.content, 160)
        return (
          <article
            key={entry.id}
            className="border border-border rounded-md overflow-hidden bg-card/80 backdrop-blur-sm"
          >
            {entry.imageDataUrl ? (
              <Link href={href} className="block border-b border-border/60 bg-muted/30">
                <img
                  src={entry.imageDataUrl}
                  alt=""
                  className="w-full max-h-44 object-cover object-center"
                />
              </Link>
            ) : null}
            <div className="p-4 space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link href={href} className="text-sm font-medium hover:text-primary transition-colors">
                  {entry.title?.trim() ? entry.title : '（无标题）'}
                </Link>
                <time className="text-xs text-muted-foreground tabular-nums">
                  {format(new Date(entry.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                </time>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-3">{teaser}</p>
              <Link href={href} className="text-xs font-medium text-primary hover:underline">
                打开全文
              </Link>
            </div>
          </article>
        )
      })}

      <div ref={sentinelRef} className="h-4 w-full shrink-0" aria-hidden />

      {loading ? (
        <div className="flex justify-center py-4 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" aria-label="Loading more" />
        </div>
      ) : null}
    </div>
  )
}
