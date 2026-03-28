'use client'

import { useEffect, useState } from 'react'

/** Updates periodically so “ongoing” durations can use stable state instead of Date.now() in render. */
export function useTickingMs(intervalMs = 30_000): number | null {
  const [ms, setMs] = useState<number | null>(null)
  useEffect(() => {
    const tick = () => setMs(Date.now())
    tick()
    const id = setInterval(tick, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return ms
}
