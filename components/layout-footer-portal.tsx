'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { LayoutFooter } from '@/components/layout-footer'

const PORTAL_ID = 'site-footer-portal'

/**
 * Renders {@link LayoutFooter} into {@link PORTAL_ID} (sibling of GlobalMouseTilt in body)
 * so the footer is not affected by the page tilt transform.
 */
export function LayoutFooterPortal({ adminText }: { adminText: string }) {
  const [el, setEl] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setEl(document.getElementById(PORTAL_ID))
  }, [])

  if (!el) return null
  return createPortal(<LayoutFooter adminText={adminText} />, el)
}
