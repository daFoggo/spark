import Link from "next/link"
import { IconArrowRight } from "@tabler/icons-react"

import { buttonVariants } from "@workspace/ui/components/button"

import { DASHBOARD_PATH } from "@/config/routes"

/**
 * Rendered by `forbidden()` (403), e.g. from `requirePermission` in lib/dal.ts. It renders inside
 * the layouts of the route that threw (the dashboard shell), so it carries no page frame.
 */
export default function Forbidden() {
  return (
    <div className="flex flex-col items-start gap-5">
      <span className="font-mono text-xs tracking-wider text-ink-3 uppercase">
        403 · Forbidden
      </span>
      <h1 className="text-3xl leading-tight font-medium md:text-4xl">
        You don&apos;t have access to this page.
      </h1>
      <p className="max-w-2xl text-ink-2">
        Your role does not include the permission this page needs. Ask an admin
        if you think it should.
      </p>
      <Link href={DASHBOARD_PATH} className={buttonVariants({ size: "lg" })}>
        Back to overview
        <IconArrowRight
          data-icon="inline-end"
          aria-hidden
          className="motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-safe:group-hover/button:translate-x-1"
        />
      </Link>
    </div>
  )
}
