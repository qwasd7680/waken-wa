'use client'

import { useEffect } from 'react'

const HOME_SCROLLBAR_HIDDEN_CLASS = 'home-scrollbar-hidden'

export function HomeScrollbarHider() {
  useEffect(() => {
    document.documentElement.classList.add(HOME_SCROLLBAR_HIDDEN_CLASS)
    return () => {
      document.documentElement.classList.remove(HOME_SCROLLBAR_HIDDEN_CLASS)
    }
  }, [])

  return null
}

