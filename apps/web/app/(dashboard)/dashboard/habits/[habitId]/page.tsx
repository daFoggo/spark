import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { Progress } from "@workspace/ui/components/progress"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { PageHead } from "@/components/layout/page-head"
import { Heatmap, HeatmapLegend } from "@/components/shared/heatmap"
import { Metric, Metrics } from "@/components/shared/metrics"
import { HabitDialog } from "@/features/habits/components/habit-dialog"
import { HabitMenu } from "@/features/habits/components/habit-menu"
import { getGoals } from "@/features/goals/queries"
import { getCheckIns, getHabit } from "@/features/habits/queries"
import {
  bestStreak,
  consistency,
  currentStreak,
  habitCells,
  indexByDate,
  isPaused,
  scheduleLabel,
  toughestWeekday,
  weekdayRates,
} from "@/features/habits/stats"
import { getSettings } from "@/features/settings/queries"
import { getToday } from "@/lib/clock"
import { requirePermission } from "@/lib/dal"
import { addDays, formatDay } from "@/lib/dates"

export const metadata: Metadata = { title: "Habit" }

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

async function HabitDetail({
  params,
}: {
  params: Promise<{ habitId: string }>
}) {
  await requirePermission("dashboard:view")
  const { habitId } = await params
  const settings = await getSettings()
  const today = await getToday(settings.timezone)
  const [habit, checkIns, goals] = await Promise.all([
    getHabit(habitId),
    getCheckIns(addDays(today, -370), today, habitId),
    getGoals(),
  ])
  if (!habit) notFound()

  const byDate = indexByDate(checkIns)
  const rates = weekdayRates(habit, byDate, today)
  const toughest = toughestWeekday(rates, checkIns.length)
  const rate = consistency(habit, byDate, today)
  const notes = checkIns
    .filter((c) => c.note)
    .slice(-5)
    .reverse()
  const paused = isPaused(habit, today)

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHead label={scheduleLabel(habit, today)} title={habit.name}>
          {habit.cue
            ? `After I ${habit.cue}`
            : "Add a cue to anchor this habit."}
          {paused ? " · Paused" : ""}
        </PageHead>
        <div className="flex items-center gap-2">
          <HabitDialog
            habit={habit}
            goals={goals.filter((goal) => goal.status === "active")}
            label="Edit"
            variant="outline"
          />
          <HabitMenu habitId={habit.id} today={today} paused={paused} />
        </div>
      </div>
      <Metrics>
        <Metric label="Current streak">
          {currentStreak(habit, byDate, today)}
        </Metric>
        <Metric label="Best streak">{bestStreak(habit, byDate, today)}</Metric>
        <Metric label="Last 30 days">
          {rate === null ? "–" : `${Math.round(rate * 100)}%`}
        </Metric>
        <Metric label="Check-ins">{checkIns.length}</Metric>
      </Metrics>
      <section className="flex flex-col gap-5">
        <h2 className="font-mono text-sm font-medium tracking-wide uppercase">
          Last 52 weeks
        </h2>
        <Heatmap
          end={today}
          weeks={52}
          weekStart={settings.weekStart}
          cells={habitCells(
            habit,
            byDate,
            addDays(today, -370),
            today,
            (date, state) => `${formatDay(date)} · ${state}`
          )}
        />
        <HeatmapLegend rest />
      </section>
      <section className="flex max-w-2xl flex-col gap-5">
        <h2 className="font-mono text-sm font-medium tracking-wide uppercase">
          By weekday
        </h2>
        {toughest !== null ? (
          <p className="text-ink-2">
            {WEEKDAYS[toughest]} is your toughest day. A smaller plan for it
            might help.
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          {rates.map((r, day) => (
            <Progress
              key={day}
              value={r.due === 0 ? 0 : Math.round((r.done / r.due) * 100)}
            >
              <span className="w-12 font-mono text-xs text-ink-3">
                {WEEKDAYS[day]?.slice(0, 3)}
              </span>
            </Progress>
          ))}
        </div>
      </section>
      {notes.length > 0 ? (
        <section className="flex max-w-2xl flex-col gap-3">
          <h2 className="font-mono text-sm font-medium tracking-wide uppercase">
            Recent notes
          </h2>
          <ul className="flex flex-col gap-2">
            {notes.map((c) => (
              <li key={c.id} className="text-ink-2">
                <span className="font-mono text-xs text-ink-3">
                  {formatDay(c.date)}
                </span>{" "}
                {c.note}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  )
}

export default function HabitPage({
  params,
}: {
  params: Promise<{ habitId: string }>
}) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <HabitDetail params={params} />
    </Suspense>
  )
}
