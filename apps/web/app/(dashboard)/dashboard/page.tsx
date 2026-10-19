import type { Metadata } from "next"
import { Suspense } from "react"

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { PageHead } from "@/components/layout/page-head"
import { Heatmap, HeatmapLegend } from "@/components/shared/heatmap"
import { Metric, Metrics } from "@/components/shared/metrics"
import { getSettings } from "@/features/settings/queries"
import { getToday } from "@/lib/clock"
import { requirePermission } from "@/lib/dal"

export const metadata: Metadata = { title: "Today" }

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

async function Today() {
  await requirePermission("dashboard:view")
  const settings = await getSettings()
  const today = await getToday(settings.timezone)
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${today}T00:00:00Z`))

  return (
    <>
      <PageHead label={label} title="Today">
        Habits, tasks and your log will gather here.
      </PageHead>
      <Metrics>
        <Metric label="Timezone">{settings.timezone}</Metric>
        <Metric label="Week starts">{WEEKDAYS[settings.weekStart]}</Metric>
        <Metric label="Companion">{settings.petName}</Metric>
      </Metrics>
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyTitle>Nothing to check in yet</EmptyTitle>
          <EmptyDescription>
            Habits arrive in the next step. Your activity will fill the map
            below.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
      <section className="flex flex-col gap-5">
        <h2 className="font-mono text-sm font-medium tracking-wide uppercase">
          Activity
        </h2>
        <Heatmap
          end={today}
          weeks={26}
          weekStart={settings.weekStart}
          cells={{}}
        />
        <HeatmapLegend />
      </section>
    </>
  )
}

function TodaySkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <Skeleton className="h-20" />
      <Skeleton className="h-14" />
      <Skeleton className="h-40" />
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<TodaySkeleton />}>
      <Today />
    </Suspense>
  )
}
