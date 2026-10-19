"use client"

import { useSyncExternalStore } from "react"

/** Live `matchMedia` result. `false` on the server and during hydration, so markup must not depend on it. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const list = window.matchMedia(query)
      list.addEventListener("change", notify)
      return () => list.removeEventListener("change", notify)
    },
    () => window.matchMedia(query).matches,
    () => false
  )
}
