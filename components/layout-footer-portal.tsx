'use client'

import { useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'

import { LayoutFooter } from '@/components/layout-footer'

const PORTAL_ID = 'site-footer-portal'

const subscribe = () => () => {}

function getPortalEl(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  return document.getElementById(PORTAL_ID)
}

/** Renders footer into #site-footer-portal so tilt on main content does not skew the footer. */
export function LayoutFooterPortal({ adminText }: { adminText: string }) {
  const el = useSyncExternalStore(subscribe, getPortalEl, () => null)
  if (!el) return null
  return createPortal(<LayoutFooter adminText={adminText} />, el)
}
