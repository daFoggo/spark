"use client"

import { useSidebar } from "@workspace/ui/components/sidebar"
import { cn } from "@workspace/ui/lib/utils"

const bar =
  "h-0.5 w-5 bg-foreground motion-safe:transition motion-safe:duration-300 motion-safe:ease-out"

/** Design-system burger: three 2px bars that turn into an X while the mobile sidebar is open. */
export function Burger({ className }: { className?: string }) {
  const { openMobile, toggleSidebar } = useSidebar()
  return (
    <button
      type="button"
      aria-label={openMobile ? "Close navigation" : "Open navigation"}
      aria-expanded={openMobile}
      onClick={toggleSidebar}
      className={cn(
        "group/burger flex size-8 shrink-0 flex-col items-center justify-center gap-1",
        className
      )}
    >
      <span
        className={cn(
          bar,
          "group-aria-expanded/burger:translate-y-1.5 group-aria-expanded/burger:rotate-45"
        )}
      />
      <span className={cn(bar, "group-aria-expanded/burger:opacity-0")} />
      <span
        className={cn(
          bar,
          "group-aria-expanded/burger:-translate-y-1.5 group-aria-expanded/burger:-rotate-45"
        )}
      />
    </button>
  )
}
