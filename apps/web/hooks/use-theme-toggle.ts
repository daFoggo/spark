"use client"

import { useCallback } from "react"
import { useTheme } from "next-themes"

/** Flips between dark and light; shared by the `d` hotkey and the `[D]` command. */
export function useThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  return useCallback(
    () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
    [resolvedTheme, setTheme]
  )
}
