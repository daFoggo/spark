import { Heatmap, HeatmapLegend } from "@/components/shared/heatmap"
import { InfoHint } from "@/components/shared/info-hint"
import { Metric, Metrics } from "@/components/shared/metrics"
import { overallCells } from "@/features/habits/stats"
import { addDays, formatDay } from "@/lib/dates"

import { loadDashboard } from "../../../_components/dashboard-data"

/** This week's numbers (MT-4). They live here, not on Today, which only shows what to do. */
export async function HabitsMetrics() {
  const { stats, week } = await loadDashboard()
  const remaining = Math.max(0, week.target - week.done)
  return (
    <Metrics>
      <Metric label="Done today">{stats.doneToday}</Metric>
      <Metric label="This week">
        {week.done}/{week.due}
      </Metric>
      <Metric label="Weekly target" hint="weeklyTarget">
        {week.due === 0
          ? "–"
          : remaining === 0
            ? "Reached"
            : `${remaining} to go`}
      </Metric>
    </Metrics>
  )
}

/** The overall activity map (MT-7), 26 weeks. */
export async function HabitsActivityMap() {
  const { settings, today, habits, byHabit } = await loadDashboard()
  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-center gap-1">
        <h2 className="font-mono text-sm font-medium tracking-wide uppercase">
          Activity
        </h2>
        <InfoHint topic="heatmap" />
      </div>
      <Heatmap
        end={today}
        weeks={26}
        weekStart={settings.weekStart}
        cells={overallCells(
          habits,
          byHabit,
          addDays(today, -26 * 7),
          today,
          (date, due, done) =>
            `${formatDay(date)} · ${done}/${due} ${due === 1 ? "habit" : "habits"}`
        )}
      />
      <HeatmapLegend />
    </section>
  )
}
