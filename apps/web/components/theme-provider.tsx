"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

import "@/lib/zod-config"
import { useHotkey } from "@/hooks/use-hotkey"
import { useThemeToggle } from "@/hooks/use-theme-toggle"

function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      <ThemeHotkey />
      {children}
    </NextThemesProvider>
  )
}

function ThemeHotkey() {
  useHotkey("d", useThemeToggle())
  return null
}

export { ThemeProvider }
