'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

/** Max tilt in degrees (subtle parallax). */
const MAX_ROTATE_DEG = 4.5
const PERSPECTIVE_PX = 1400
/** Higher = snappier follow. */
const LERP = 0.12

const ADMIN_PREFIX = '/admin'

export function GlobalMouseTilt({
  children,
  enabled,
}: {
  children: React.ReactNode
  /** When false, no tilt (default in site config). */
  enabled: boolean
}) {
  const pathname = usePathname()
  const wrapRef = useRef<HTMLDivElement>(null)
  const targetRef = useRef({ rx: 0, ry: 0 })
  const currentRef = useRef({ rx: 0, ry: 0 })
  const rafRef = useRef(0)

  const skipAdmin = pathname?.startsWith(ADMIN_PREFIX) ?? false

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return

    if (skipAdmin || !enabled) {
      el.style.transform = ''
      el.style.willChange = 'auto'
      currentRef.current = { rx: 0, ry: 0 }
      targetRef.current = { rx: 0, ry: 0 }
      return
    }

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mq.matches) {
      el.style.transform = ''
      el.style.willChange = 'auto'
      return
    }

    el.style.willChange = 'transform'

    const onMove = (e: MouseEvent) => {
      const w = window.innerWidth || 1
      const h = window.innerHeight || 1
      const nx = (e.clientX / w) * 2 - 1
      const ny = (e.clientY / h) * 2 - 1
      targetRef.current.rx = -ny * MAX_ROTATE_DEG
      targetRef.current.ry = nx * MAX_ROTATE_DEG
    }

    const resetTarget = () => {
      targetRef.current.rx = 0
      targetRef.current.ry = 0
    }

    const tick = () => {
      const cur = currentRef.current
      const tgt = targetRef.current
      cur.rx += (tgt.rx - cur.rx) * LERP
      cur.ry += (tgt.ry - cur.ry) * LERP
      el.style.transform = `perspective(${PERSPECTIVE_PX}px) rotateX(${cur.rx}deg) rotateY(${cur.ry}deg) translateZ(0)`
      rafRef.current = requestAnimationFrame(tick)
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    document.documentElement.addEventListener('mouseleave', resetTarget)
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('mousemove', onMove)
      document.documentElement.removeEventListener('mouseleave', resetTarget)
      cancelAnimationFrame(rafRef.current)
      el.style.transform = ''
      el.style.willChange = 'auto'
      currentRef.current = { rx: 0, ry: 0 }
      targetRef.current = { rx: 0, ry: 0 }
    }
  }, [skipAdmin, enabled])

  return (
    <div
      ref={wrapRef}
      className="min-h-dvh w-full [transform-style:preserve-3d]"
    >
      {children}
    </div>
  )
}
