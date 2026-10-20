"use client"

import { useSidebar } from "@workspace/ui/components/sidebar"
import { cn } from "@workspace/ui/lib/utils"

import { useHotkey } from "@/hooks/use-hotkey"
import { useThemeToggle } from "@/hooks/use-theme-toggle"

/** `[X] LABEL` command (design system §7–8): the key is always shown, the label from lg. */
export function HeaderCommand({
  hotkey,
  label,
  pressed,
  onClick,
  className,
}: {
  hotkey: string
  label: string
  pressed?: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label={`[${hotkey.toUpperCase()}] ${label}`}
      aria-pressed={pressed}
      aria-keyshortcuts={hotkey}
      onClick={onClick}
      className={cn(
        "group/cmd font-mono text-xs tracking-wide whitespace-nowrap text-ink-2 uppercase transition-colors duration-150 hover:text-foreground aria-pressed:text-foreground",
        className
      )}
    >
      <span className="text-ink-3 transition-colors duration-150 group-hover/cmd:text-ink-2">
        [{hotkey.toUpperCase()}]
      </span>
      <span className="ml-1.5 max-lg:hidden">{label}</span>
    </button>
  )
}

/** `[B] SIDEBAR`: shadcn's toggle (Cmd/Ctrl+B also works), plus the bare `b` key. */
export function SidebarCommand({ className }: { className?: string }) {
  const { state, toggleSidebar } = useSidebar()
  useHotkey("b", toggleSidebar)
  return (
    <HeaderCommand
      hotkey="b"
      label="Sidebar"
      pressed={state === "expanded"}
      onClick={toggleSidebar}
      className={className}
    />
  )
}

/** `[D] THEME`: the `d` key itself is bound once, in ThemeProvider. */
export function ThemeCommand({ className }: { className?: string }) {
  const toggleTheme = useThemeToggle()
  return (
    <HeaderCommand
      hotkey="d"
      label="Theme"
      onClick={toggleTheme}
      className={className}
    />
  )
}
