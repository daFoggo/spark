import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"

import { Skeleton } from "@workspace/ui/components/skeleton"

import { PageHead } from "@/components/layout/page-head"
import { DASHBOARD_PATH } from "@/config/routes"
import { getCalendar } from "@/features/settings/queries"
import { getToday } from "@/lib/clock"
import { requirePermission } from "@/lib/dal"

import { GetStarted } from "./_components/get-started"
import { resolveDay } from "./_components/day"
import {
  TodayGoals,
  TodayHabits,
  TodayPet,
  TodayTasks,
} from "./_components/today-sections"

export const metadata: Metadata = { title: "Today" }

type Search = Promise<{ day?: string }>

async function TodayHead({ searchParams }: { searchParams: Search }) {
  await requirePermission("dashboard:view")
  const { timezone } = await getCalendar()
  const today = await getToday(timezone)
  const day = await resolveDay(searchParams, today)
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${day}T00:00:00Z`))
  return (
    <PageHead label={label} title={day === today ? "Today" : "Earlier"}>
      {day === today ? (
        "Check in what you did and keep your companion fed."
      ) : (
        <>
          Filling in a day you missed. Only the last 3 days can change.{" "}
          <Link href={DASHBOARD_PATH} className="underline underline-offset-4">
            Back to today
          </Link>
        </>
      )}
    </PageHead>
  )
}

export default function DashboardPage({
  searchParams,
}: {
  searchParams: Search
}) {
  return (
    <>
      <Suspense fallback={<Skeleton className="h-28" />}>
        <TodayHead searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={null}>
        <GetStarted />
      </Suspense>
      <Suspense fallback={null}>
        <TodayGoals searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-64 max-w-3xl" />}>
        <TodayHabits searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-40 max-w-3xl" />}>
        <TodayTasks />
      </Suspense>
      {/* The inspector shows the pet from xl; below that it lives here. */}
      <div className="xl:hidden">
        <Suspense fallback={<Skeleton className="h-64" />}>
          <TodayPet />
        </Suspense>
      </div>
    </>
  )
}
