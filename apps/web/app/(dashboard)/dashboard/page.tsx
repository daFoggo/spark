import type { Metadata } from "next"
import { Suspense } from "react"

import { Skeleton } from "@workspace/ui/components/skeleton"

import { PageHead } from "@/components/layout/page-head"
import { Metric, Metrics } from "@/components/shared/metrics"
import { SpecItem, SpecList } from "@/components/shared/spec-list"
import { authConfig } from "@/lib/auth/config"
import { permissionsOf } from "@/lib/auth/permissions"
import { requirePermission } from "@/lib/dal"

export const metadata: Metadata = { title: "Overview" }

async function Overview() {
  const session = await requirePermission("dashboard:view")
  const permissions = permissionsOf(session.role)
  return (
    <>
      <Metrics>
        <Metric label="Role">{session.role}</Metric>
        <Metric label="Permissions">{permissions.length}</Metric>
        <Metric label="Provider">{authConfig.AUTH_PROVIDER}</Metric>
      </Metrics>
      <section className="flex flex-col gap-5">
        <h2 className="font-mono text-sm font-medium tracking-wide uppercase">
          Granted to your role
        </h2>
        <SpecList>
          {permissions.map((permission) => (
            <SpecItem
              key={permission}
              label={permission.split(":")[0] ?? permission}
            >
              <code className="font-mono">{permission}</code>
            </SpecItem>
          ))}
        </SpecList>
      </section>
    </>
  )
}

function OverviewSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
      <Skeleton className="h-14" />
      <Skeleton className="h-14" />
      <Skeleton className="h-14" />
    </div>
  )
}

export default function DashboardPage() {
  return (
    <>
      <PageHead label="Dashboard" title="Overview">
        Your session, role and what it lets you do.
      </PageHead>
      <Suspense fallback={<OverviewSkeleton />}>
        <Overview />
      </Suspense>
    </>
  )
}
