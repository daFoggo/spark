import type { Metadata } from "next"
import { Suspense } from "react"

import { Skeleton } from "@workspace/ui/components/skeleton"

import { PageHead } from "@/components/layout/page-head"
import { getSettings } from "@/features/settings/queries"
import { getToday } from "@/lib/clock"
import { requirePermission } from "@/lib/dal"

import {
  TodayActivityMap,
  TodayHabits,
  TodayLog,
  TodayMetrics,
  TodayPet,
  TodayTasks,
} from "./_components/today-sections"

export const metadata: Metadata = { title: "Today" }

async function TodayHead() {
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
    <PageHead label={label} title="Today">
      Check in, log what you did, and keep your companion fed.
    </PageHead>
  )
}

export default function DashboardPage() {
  return (
    <>
      <Suspense fallback={<Skeleton className="h-28" />}>
        <TodayHead />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-14" />}>
        <TodayMetrics />
      </Suspense>
      {/* The inspector shows the pet from xl; below that it lives here. */}
      <div className="xl:hidden">
        <Suspense fallback={<Skeleton className="h-64" />}>
          <TodayPet />
        </Suspense>
      </div>
      <Suspense fallback={<Skeleton className="h-64 max-w-3xl" />}>
        <TodayHabits />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-40 max-w-3xl" />}>
        <TodayTasks />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-40 max-w-2xl" />}>
        <TodayLog />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-40" />}>
        <TodayActivityMap />
      </Suspense>
    </>
  )
}
