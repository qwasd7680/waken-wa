'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type UnsavedChangesBarProps = {
  open: boolean
  saving?: boolean
  onSave: () => void | Promise<void>
  onRevert: () => void
  saveLabel?: string
  revertLabel?: string
  message?: string
  className?: string
  /** Alert when confirming revert (Chinese admin copy). */
  revertDialogTitle?: string
  revertDialogDescription?: string
  revertDialogConfirm?: string
}

const ANIM_MS = 300

/**
 * Fixed bottom bar for forms with explicit save; portals to document.body so
 * position:fixed is viewport-relative (not trapped by transformed ancestors).
 * Enter/exit use tw-animate; portal stays mounted until exit animation finishes.
 * Stays below dialogs (z-50).
 */
export function UnsavedChangesBar({
  open,
  saving = false,
  onSave,
  onRevert,
  saveLabel = '保存',
  revertLabel = '撤销',
  message = '有未保存的更改',
  className,
  revertDialogTitle = '放弃未保存的更改？',
  revertDialogDescription = '本地修改尚未写入站点配置，确定要撤销吗？',
  revertDialogConfirm = '确定放弃',
}: UnsavedChangesBarProps) {
  const [revertDialogOpen, setRevertDialogOpen] = useState(false)
  const [rendered, setRendered] = useState(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const openRafRef = useRef<number | null>(null)

  useEffect(() => {
    if (open) {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }
      openRafRef.current = requestAnimationFrame(() => {
        openRafRef.current = null
        setRendered(true)
      })
      return () => {
        if (openRafRef.current != null) {
          cancelAnimationFrame(openRafRef.current)
          openRafRef.current = null
        }
      }
    }
    return undefined
  }, [open])

  useEffect(() => {
    if (open || !rendered) return
    if (typeof window === 'undefined') return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ms = reduced ? 0 : ANIM_MS
    closeTimerRef.current = setTimeout(() => {
      setRendered(false)
      closeTimerRef.current = null
    }, ms)
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }
    }
  }, [open, rendered])

  if (!rendered || typeof document === 'undefined') return null

  return createPortal(
    <>
      <div
        className={cn(
          'fixed bottom-4 left-1/2 z-40 w-[min(100%-1.5rem,28rem)] -translate-x-1/2 px-1 pb-[env(safe-area-inset-bottom,0)]',
          className,
        )}
        role="status"
        aria-live="polite"
        aria-label="Unsaved changes: save or revert"
      >
        <div
          className={cn(
            'flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 bg-card/95 px-3 py-2.5 shadow-lg backdrop-blur-md sm:px-4',
            'duration-300 motion-reduce:animate-none motion-reduce:opacity-100',
            open
              ? 'animate-in fade-in-0 slide-in-from-bottom-6'
              : 'animate-out fade-out-0 slide-out-to-bottom',
          )}
        >
          <span className="text-xs text-muted-foreground sm:text-sm">{message}</span>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRevertDialogOpen(true)}
              disabled={saving}
            >
              {revertLabel}
            </Button>
            <Button type="button" size="sm" onClick={() => void onSave()} disabled={saving}>
              {saving ? '保存中…' : saveLabel}
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={revertDialogOpen} onOpenChange={setRevertDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{revertDialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>{revertDialogDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">取消</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              onClick={() => {
                onRevert()
              }}
            >
              {revertDialogConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>,
    document.body,
  )
}
