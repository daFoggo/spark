import Link from "next/link"

import { AppLogo } from "@/components/shared/app-logo"

import { Burger } from "./burger"
import { DASHBOARD_PATH } from "@/config/routes"

/**
 * Left of the main header. Below md the sidebar is a Sheet, so the header carries the burger and
 * the logo; from md the sidebar (expanded or its icon rail) always shows the logo itself.
 */
export function MainHeaderStart({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Burger className="-ml-1.5 md:hidden" />
      <Link href={DASHBOARD_PATH} className="shrink-0 md:hidden">
        <AppLogo />
      </Link>
      <span aria-hidden className="font-mono text-sm text-ink-4 md:hidden">
        /
      </span>
      {children}
    </div>
  )
}
