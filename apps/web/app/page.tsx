import Link from "next/link"

import { buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

export default function Page() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center p-6 text-center">
      <div className="flex max-w-lg flex-col items-center gap-6">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Next-Mono-Base
          </span>
          <h1 className="text-3xl font-bold tracking-tight">Project Ready</h1>
          <p className="text-sm text-muted-foreground">
            A production-ready foundation with Next.js 16.4, Turborepo, Cache Components,
            Data Access Layer (DAL), and an integrated authentication reference feature.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/dashboard" className={cn(buttonVariants({ variant: "default" }))}>
            Go to Dashboard
          </Link>
          <Link href="/sign-in" className={cn(buttonVariants({ variant: "outline" }))}>
            Sign In
          </Link>
          <Link href="/sign-up" className={cn(buttonVariants({ variant: "ghost" }))}>
            Sign Up
          </Link>
        </div>

        <div className="font-mono text-xs text-muted-foreground">
          Press <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs">d</kbd> to toggle dark mode
        </div>
      </div>
    </main>
  )
}
