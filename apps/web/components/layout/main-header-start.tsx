"use client"

import Link from "next/link"

import { useSidebar } from "@workspace/ui/components/sidebar"
import { cn } from "@workspace/ui/lib/utils"

import { AppLogo } from "@/components/shared/app-logo"

import { Burger } from "./burger"

/**
 * Left of the main header: burger below md; the logo whenever the sidebar (which holds it)
 * is not on screen, i.e. below md or collapsed with `[B]`.
 */
export function MainHeaderStart({ children }: { children: React.ReactNode }) {
  const { state } = useSidebar()
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Burger className="-ml-1.5 md:hidden" />
      <Link
        href="/"
        className={cn("shrink-0", state === "expanded" && "md:hidden")}
      >
        <AppLogo />
      </Link>
      <span
        aria-hidden
        className={cn(
          "font-mono text-sm text-ink-4",
          state === "expanded" && "md:hidden"
        )}
      >
        /
      </span>
      {children}
    </div>
  )
}
