'use client'

import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { ImageCropDialog } from '@/components/admin/image-crop-dialog'
import { createLexicalTextContent, LexicalEditor } from '@/components/admin/lexical-editor'
import { MarkdownContent } from '@/components/admin/markdown-content'
import { LexicalContent } from '@/components/lexical-content'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { appendParagraphTextToLexical, lexicalTextContent } from '@/lib/inspiration-lexical'
import {
  inspirationLooksLikeMarkdown,
  inspirationPlainPreviewAny,
} from '@/lib/inspiration-preview'
import { DEFAULT_TIMEZONE, formatDateTimeShort, normalizeTimezone } from '@/lib/timezone'

interface InspirationEntry {
  id: number
  title: string | null
  content: string
  contentLexical?: string | null
  imageDataUrl: string | null
  statusSnapshot: string | null
  createdAt: string
}

/** Server page size; keep small so tall markdown cards do not overflow the viewport. */
const INSPIRATION_LIST_PAGE_SIZE = 8
/** Max scroll height for the entry list inside the card (viewport-relative). */
const INSPIRATION_LIST_MAX_HEIGHT = 'min(75vh,56rem)'
/** Max long edge (px) for cropped PNG DataURL (cover + inline body images). */
const INSPIRATION_MAX_OUTPUT_EDGE = 1200
/** Local draft storage key for admin inspiration form. */
const INSPIRATION_DRAFT_STORAGE_KEY = 'waken:admin:inspiration-draft:v1'

type InspirationDraft = {
  title: string
  content: string
  contentLexical: string
  imageDataUrl: string
  attachCurrentStatus: boolean
  attachStatusDeviceHashes: string[]
}

export function InspirationManager() {
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<InspirationEntry[]>([])
  const [displayTimezone, setDisplayTimezone] = useState(DEFAULT_TIMEZONE)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [contentLexical, setContentLexical] = useState(() => createLexicalTextContent(''))
  const [imageDataUrl, setImageDataUrl] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [attachCurrentStatus, setAttachCurrentStatus] = useState(false)
  const [attachStatusDeviceHashes, setAttachStatusDeviceHashes] = useState<string[]>([])
  const [inspirationDevices, setInspirationDevices] = useState<
    Array<{ id: number; displayName: string; generatedHashKey: string; status: string }>
  >([])
  const [previewEntry, setPreviewEntry] = useState<InspirationEntry | null>(null)
  const [bodyImageBusy, setBodyImageBusy] = useState(false)

  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null)
  const [cropDialogOpen, setCropDialogOpen] = useState(false)
  const [cropTarget, setCropTarget] = useState<'cover' | 'body'>('cover')
  const bodyImageInputRef = useRef<HTMLInputElement>(null)
  const [draftReady, setDraftReady] = useState(false)

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / INSPIRATION_LIST_PAGE_SIZE)),
    [total],
  )

  useEffect(() => {
    if (loading || total <= 0) return
    const maxPage = Math.max(0, Math.ceil(total / INSPIRATION_LIST_PAGE_SIZE) - 1)
    if (page > maxPage) setPage(maxPage)
  }, [loading, total, page])

  useEffect(() => {
    return () => {
      if (cropSourceUrl) URL.revokeObjectURL(cropSourceUrl)
    }
  }, [cropSourceUrl])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(INSPIRATION_DRAFT_STORAGE_KEY)
      if (!raw) return
      const draft = JSON.parse(raw) as Partial<InspirationDraft>
      const nextTitle = typeof draft.title === 'string' ? draft.title : ''
      const nextImage = typeof draft.imageDataUrl === 'string' ? draft.imageDataUrl : ''
      const nextAttach = draft.attachCurrentStatus === true
      const nextDeviceHashes = Array.isArray(draft.attachStatusDeviceHashes)
        ? draft.attachStatusDeviceHashes.filter((v): v is string => typeof v === 'string')
        : []
      const nextContentLexical =
        typeof draft.contentLexical === 'string' && draft.contentLexical.trim()
          ? draft.contentLexical
          : createLexicalTextContent(typeof draft.content === 'string' ? draft.content : '')
      const nextContent =
        typeof draft.content === 'string' ? draft.content : lexicalTextContent(nextContentLexical)

      setTitle(nextTitle)
      setImageDataUrl(nextImage)
      setAttachCurrentStatus(nextAttach)
      setAttachStatusDeviceHashes(nextAttach ? nextDeviceHashes : [])
      setContentLexical(nextContentLexical)
      setContent(nextContent)
    } catch {
      // Ignore broken local draft payload.
    } finally {
      setDraftReady(true)
    }
  }, [])

  useEffect(() => {
    if (!draftReady) return

    const lexicalPlain = lexicalTextContent(contentLexical).trim()
    const hasDraft =
      title.trim().length > 0 ||
      content.trim().length > 0 ||
      lexicalPlain.length > 0 ||
      imageDataUrl.trim().length > 0 ||
      attachCurrentStatus ||
      attachStatusDeviceHashes.length > 0

    if (!hasDraft) {
      localStorage.removeItem(INSPIRATION_DRAFT_STORAGE_KEY)
      return
    }

    const payload: InspirationDraft = {
      title,
      content,
      contentLexical,
      imageDataUrl,
      attachCurrentStatus,
      attachStatusDeviceHashes,
    }
    localStorage.setItem(INSPIRATION_DRAFT_STORAGE_KEY, JSON.stringify(payload))
  }, [
    attachCurrentStatus,
    attachStatusDeviceHashes,
    content,
    contentLexical,
    draftReady,
    imageDataUrl,
    title,
  ])

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: String(INSPIRATION_LIST_PAGE_SIZE),
        offset: String(page * INSPIRATION_LIST_PAGE_SIZE),
      })
      if (q.trim()) params.set('q', q.trim())

      const res = await fetch(`/api/inspiration/entries?${params}`)
      const data = await res.json()
      if (data.success) {
        setEntries(data.data || [])
        setTotal(data.pagination?.total || 0)
        setDisplayTimezone(normalizeTimezone(data.displayTimezone))
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [page, q])

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/devices?limit=200')
        const data = await res.json()
        if (data?.success && Array.isArray(data.data)) {
          setInspirationDevices(
            data.data.map((row: Record<string, unknown>) => ({
              id: Number(row.id),
              displayName: String(row.displayName ?? ''),
              generatedHashKey: String(row.generatedHashKey ?? ''),
              status: String(row.status ?? 'active'),
            })),
          )
        }
      } catch {
        // ignore
      }
    })()
  }, [])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const openCropForFile = (file: File | undefined, target: 'cover' | 'body') => {
    if (!file) return
    setCropTarget(target)
    if (cropSourceUrl) URL.revokeObjectURL(cropSourceUrl)
    const objectUrl = URL.createObjectURL(file)
    setCropSourceUrl(objectUrl)
    setCropDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const res = await fetch('/api/inspiration/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || undefined,
          content: content.trim(),
          contentLexical,
          imageDataUrl: imageDataUrl.trim() || undefined,
          attachCurrentStatus,
          attachStatusDeviceHashes,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data?.success) {
        toast.error(typeof data?.error === 'string' ? data.error : '提交失败')
        return
      }

      setTitle('')
      setContent('')
      setContentLexical(createLexicalTextContent(''))
      setImageDataUrl('')
      setAttachCurrentStatus(false)
      setAttachStatusDeviceHashes([])
      localStorage.removeItem(INSPIRATION_DRAFT_STORAGE_KEY)
      toast.success('灵感已提交')
      setPage(0)
      setTimeout(() => void fetchEntries(), 0)
    } catch {
      toast.error('网络错误，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/inspiration/entries?id=${id}`, { method: 'DELETE' })
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string }
      if (!res.ok || !data?.success) {
        toast.error(typeof data?.error === 'string' ? data.error : '删除失败')
        return
      }
      toast.success('灵感已删除')
      setTimeout(() => void fetchEntries(), 0)
    } catch {
      toast.error('网络错误，删除失败')
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">灵感随想录</h3>
              <p className="text-sm text-muted-foreground">
                正文使用 Lexical 富文本编辑；正文配图经裁剪后上传到服务器。
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="insp-title">标题（可选）</Label>
                <Input
                  id="insp-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例如：某次灵感 / 片段标题"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="insp-file">图片（可选，裁剪后写入）</Label>
                <Input
                  id="insp-file"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    openCropForFile(e.target.files?.[0], 'cover')
                    e.target.value = ''
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  长边上限约 {INSPIRATION_MAX_OUTPUT_EDGE}px，比例可任意调整
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm font-normal cursor-pointer">
                <Checkbox
                  checked={attachCurrentStatus}
                  onCheckedChange={(v) => {
                    const on = v === true
                    setAttachCurrentStatus(on)
                    if (!on) setAttachStatusDeviceHashes([])
                  }}
                />
                <span>附上提交时首页「当前」状态快照</span>
              </label>
            </div>
            {attachCurrentStatus ? (
              <div className="space-y-2 rounded-md border border-border/60 bg-muted/10 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">可选快照设备（默认全设备）</p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() =>
                        setAttachStatusDeviceHashes(inspirationDevices.map((d) => d.generatedHashKey))
                      }
                    >
                      全选
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setAttachStatusDeviceHashes([])}
                    >
                      清空
                    </Button>
                  </div>
                </div>
                <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
                  {inspirationDevices.length === 0 ? (
                    <p className="text-xs text-muted-foreground">暂无设备，快照将按全设备生成。</p>
                  ) : (
                    inspirationDevices.map((d) => (
                      <label
                        key={d.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-colors hover:bg-muted/30"
                      >
                        <Checkbox
                          checked={attachStatusDeviceHashes.includes(d.generatedHashKey)}
                          onCheckedChange={(v) => {
                            const checked = v === true
                            setAttachStatusDeviceHashes((prev) =>
                              checked
                                ? Array.from(new Set([...prev, d.generatedHashKey]))
                                : prev.filter((k) => k !== d.generatedHashKey),
                            )
                          }}
                        />
                        <span className="min-w-0 flex-1 truncate">{d.displayName}</span>
                        {d.status !== 'active' ? (
                          <span className="text-amber-600">({d.status})</span>
                        ) : null}
                      </label>
                    ))
                  )}
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="insp-content">正文（Lexical，必填）</Label>
              <Tabs defaultValue="edit" className="w-full">
                <TabsList className="mb-2">
                  <TabsTrigger value="edit">编辑</TabsTrigger>
                  <TabsTrigger value="preview">预览</TabsTrigger>
                </TabsList>
                <TabsContent value="edit" className="mt-0 space-y-2">
                  <input
                    ref={bodyImageInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      openCropForFile(e.target.files?.[0], 'body')
                      e.target.value = ''
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={bodyImageBusy || submitting}
                    onClick={() => bodyImageInputRef.current?.click()}
                  >
                    {bodyImageBusy ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <ImagePlus className="h-4 w-4 mr-1" />
                    )}
                    插入正文配图
                  </Button>
                  <LexicalEditor
                    value={contentLexical}
                    onChange={(next) => setContentLexical(next)}
                    onPlainTextChange={(plain) => setContent(plain)}
                    placeholder="支持基础富文本：加粗、斜体、列表、代码等"
                  />
                </TabsContent>
                <TabsContent value="preview" className="mt-0">
                  <div className="rounded-md border border-border bg-muted/20 p-3 min-h-[220px] max-h-[360px] overflow-y-auto">
                    {content.trim() ? (
                      inspirationLooksLikeMarkdown(content) ? (
                        <MarkdownContent
                          markdown={content}
                          className="text-sm text-muted-foreground"
                          imageClassName="max-h-72 w-auto rounded-md border border-border my-2"
                        />
                      ) : (
                        <LexicalContent content={contentLexical} className="text-sm text-muted-foreground" />
                      )
                    ) : (
                      <p className="text-sm text-muted-foreground">暂无内容</p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {imageDataUrl.trim() ? (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground mb-2">图片预览</p>
                <Image
                  src={imageDataUrl.trim()}
                  alt="inspiration preview"
                  width={800}
                  height={600}
                  className="max-h-56 w-auto rounded-md border bg-background"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setImageDataUrl('')}
                >
                  移除图片
                </Button>
              </div>
            ) : null}

            <div className="flex items-center gap-3 flex-wrap">
              <Button type="submit" disabled={submitting || !content.trim()}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    提交中...
                  </>
                ) : (
                  '提交灵感'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={() => {
                  setTitle('')
                  setContent('')
                  setContentLexical(createLexicalTextContent(''))
                  setImageDataUrl('')
                  setAttachCurrentStatus(false)
                  setAttachStatusDeviceHashes([])
                  localStorage.removeItem(INSPIRATION_DRAFT_STORAGE_KEY)
                }}
              >
                清空
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <ImageCropDialog
        open={cropDialogOpen}
        onOpenChange={(open) => {
          setCropDialogOpen(open)
          if (!open) {
            setCropSourceUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev)
              return null
            })
          }
        }}
        sourceUrl={cropSourceUrl}
        aspectMode="free"
        outputSize={INSPIRATION_MAX_OUTPUT_EDGE}
        title={cropTarget === 'body' ? '裁剪正文配图' : '裁剪封面配图'}
        description="拖动选区或边角调整范围，确认后导出 PNG。"
        onComplete={(dataUrl) => {
          if (cropTarget === 'cover') {
            setImageDataUrl(dataUrl)
            return
          }
          void (async () => {
            setBodyImageBusy(true)
            try {
              const res = await fetch('/api/inspiration/assets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageDataUrl: dataUrl }),
                credentials: 'include',
              })
              const data = await res.json().catch(() => ({}))
              if (!res.ok || !data?.success || !data?.data?.url) {
                toast.error(typeof data?.error === 'string' ? data.error : '正文配图上传失败')
                return
              }
              const url = String(data.data.url)
              setContentLexical((prev) => {
                const next = appendParagraphTextToLexical(prev, `![](${url})`)
                setContent(lexicalTextContent(next))
                return next
              })
              toast.success('正文配图已插入')
            } catch {
              toast.error('正文配图上传失败')
            } finally {
              setBodyImageBusy(false)
            }
          })()
        }}
      />

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold">API 提交（可从脚本/设备直接上报）</h3>
          <p className="text-sm text-muted-foreground">
            使用与「活动上报」相同的 `API Token`。字段 `contentLexical` 为 Lexical JSON，`content` 可选作为兼容纯文本；
            `imageDataUrl` 为可选封面图 DataURL。正文内嵌图请先 `POST /api/inspiration/assets`（JSON 字段
            `imageDataUrl`），再在正文中插入返回 `url`；提交条目后会自动绑定到该条记录。
            若在「网站设置」中开启了「仅允许所选设备提交随想录」，请在两个请求上都加请求头{' '}
            <code className="rounded bg-muted px-1">X-Device-Key: {'<设备身份牌>'}</code>
            （与设备管理中的值一致）。
          </p>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
            {`# If site setting restricts inspiration by device, add:
#   -H "X-Device-Key: YOUR_DEVICE_GENERATED_HASH_KEY"

curl -X POST /api/inspiration/assets \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"imageDataUrl":"data:image/png;base64,..."}'

curl -X POST /api/inspiration/entries \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"可选","contentLexical":{"root":{"type":"root","children":[...]}},"imageDataUrl":null}'`}
          </pre>
        </CardContent>
      </Card>

      <div className="mt-8 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">搜索记录</h3>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[220px] space-y-2">
            <Label htmlFor="insp-search">关键字</Label>
            <Input
              id="insp-search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(0)
              }}
              placeholder="搜索标题、正文或状态快照"
            />
          </div>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-52" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">暂无灵感记录</div>
          ) : (
            <div
              className="divide-y overflow-y-auto overscroll-contain"
              style={{ maxHeight: INSPIRATION_LIST_MAX_HEIGHT }}
            >
              {entries.map((entry) => (
                <div key={entry.id} className="p-4 sm:p-5 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-foreground truncate max-w-[420px]">
                          {entry.title ? entry.title : '（无标题）'}
                        </h4>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTimeShort(entry.createdAt, displayTimezone)}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                        {
                          inspirationPlainPreviewAny(
                            entry.content,
                            entry.contentLexical,
                            140,
                          ).text
                        }
                      </div>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="mt-1 h-auto px-0 text-xs"
                        onClick={() => setPreviewEntry(entry)}
                      >
                        查看更多
                      </Button>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>确认删除</AlertDialogTitle>
                          <AlertDialogDescription>
                            确定要删除这条灵感吗？此操作无法撤销。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(entry.id)}>
                            删除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  {entry.imageDataUrl ? (
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <Image
                        src={entry.imageDataUrl}
                        alt="inspiration"
                        width={800}
                        height={600}
                        className="max-h-64 w-auto rounded-md border bg-background"
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          <span>
            共 {total} 条
            {entries.length > 0 ? (
              <>
                {' '}
                · 本页 {page * INSPIRATION_LIST_PAGE_SIZE + 1}–
                {page * INSPIRATION_LIST_PAGE_SIZE + entries.length}
              </>
            ) : null}
          </span>
          {total > INSPIRATION_LIST_PAGE_SIZE ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page <= 0}
              >
                上一页
              </Button>
              <span className="tabular-nums text-sm">
                {page + 1} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages - 1}
              >
                下一页
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <Dialog open={Boolean(previewEntry)} onOpenChange={(open) => !open && setPreviewEntry(null)}>
        <DialogContent className="max-w-2xl max-h-[min(90vh,56rem)] overflow-y-auto">
          {previewEntry?.imageDataUrl ? (
            <div className="-mx-6 -mt-6 mb-4 overflow-hidden rounded-t-lg border-b border-border/60 bg-muted/20">
              <Image
                src={previewEntry.imageDataUrl}
                alt="preview header image"
                width={1200}
                height={800}
                className="h-auto max-h-[min(42vh,18rem)] w-full object-cover object-center"
              />
            </div>
          ) : null}
          <DialogHeader>
            <DialogTitle>{previewEntry?.title?.trim() || '（无标题）'}</DialogTitle>
            <DialogDescription>
              {previewEntry
                ? formatDateTimeShort(previewEntry.createdAt, displayTimezone)
                : ''}
            </DialogDescription>
          </DialogHeader>
          {previewEntry?.statusSnapshot ? (
            <div className="rounded-md border border-dashed border-border/70 bg-muted/15 px-2 py-1.5 text-xs text-muted-foreground whitespace-pre-wrap">
              {previewEntry.statusSnapshot}
            </div>
          ) : null}
          {previewEntry?.contentLexical ? (
            inspirationLooksLikeMarkdown(previewEntry.content) ? (
              <MarkdownContent
                markdown={previewEntry.content}
                className="text-sm text-muted-foreground"
                imageClassName="max-h-56 w-auto rounded-md border border-border my-2"
              />
            ) : (
              <LexicalContent content={previewEntry.contentLexical} className="text-sm text-muted-foreground" />
            )
          ) : previewEntry ? (
            <MarkdownContent
              markdown={previewEntry.content}
              className="text-sm text-muted-foreground"
              imageClassName="max-h-56 w-auto rounded-md border border-border my-2"
            />
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPreviewEntry(null)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
