"use client"

import { useEffect } from "react"

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  )
}

/** Single-key shortcut (`[D]`, `[B]`), ignored while typing or with a modifier held. */
export function useHotkey(key: string, onPress: () => void) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      // Browser autofill dispatches keydown events without a `key`.
      if ((event.key as string | undefined)?.toLowerCase() !== key) return
      if (isTypingTarget(event.target)) return
      onPress()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [key, onPress])
}
