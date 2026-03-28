'use client'

import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

/** Client-only gate without useEffect + setState (avoids cascading render lint). */
export function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false)
}
