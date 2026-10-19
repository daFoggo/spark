import { cn } from "@workspace/ui/lib/utils"
import { ScrollArea, ScrollBar } from "@workspace/ui/components/scroll-area"

import { addDays, dateRange, startOfWeek, type LocalDate } from "@/lib/dates"

/** 0 = nothing logged, 1-4 = more activity, "rest" = not scheduled (shown as a dashed outline). */
export type HeatLevel = 0 | 1 | 2 | 3 | 4 | "rest"

export type HeatCell = {
  level: HeatLevel
  /** Shown as the cell's tooltip, e.g. "Mon, Oct 19 · 3/5 habits". */
  label: string
  /** A session on a day the habit was not scheduled (spec AC-4): drawn with a dot. */
  extra?: boolean
}

const LEVEL_CLASS: Record<Exclude<HeatLevel, "rest">, string> = {
  0: "bg-border/40",
  1: "bg-heat-1",
  2: "bg-heat-2",
  3: "bg-heat-3",
  4: "bg-heat-4",
}

/** Same ramp as a legend: pass `rest` to include the "not scheduled" key. */
export function HeatmapLegend({ rest = false }: { rest?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs text-ink-3">
      Less
      {([0, 1, 2, 3, 4] as const).map((level) => (
        <span key={level} className={cn("size-3", LEVEL_CLASS[level])} />
      ))}
      More
      {rest ? (
        <span className="ml-auto flex items-center gap-1.5">
          <span className="size-3 border border-dashed border-border" />
          Not scheduled
        </span>
      ) : null}
    </div>
  )
}

/**
 * GitHub-style activity grid: one column per week, one row per weekday, newest week on the right.
 * Pure presentation: callers decide each day's level and tooltip. `weekStart` is 0 (Sun) .. 6 (Sat).
 */
export function Heatmap({
  end,
  weeks,
  weekStart,
  cells,
  label = "Activity",
  className,
}: {
  end: LocalDate
  weeks: number
  weekStart: number
  cells: Partial<Record<LocalDate, HeatCell>>
  /** Names the grid for screen readers, e.g. "Activity". */
  label?: string
  className?: string
}) {
  const first = startOfWeek(addDays(end, -(weeks * 7 - 1)), weekStart)
  const days = dateRange(first, end)
  const rows = Array.from({ length: Math.ceil(days.length / 7) }, (_, w) =>
    days.slice(w * 7, w * 7 + 7)
  )
  const activeDays = days.filter((date) => {
    const level = cells[date]?.level
    return level !== undefined && level !== 0 && level !== "rest"
  }).length
  const months = rows.map((week, index) => {
    const month = week[0]?.slice(5, 7)
    const previous = rows[index - 1]?.[0]?.slice(5, 7)
    return month && month !== previous ? month : null
  })

  return (
    <ScrollArea className={cn("w-full", className)}>
      <div
        className="flex w-max flex-col gap-1.5 pb-3"
        role="img"
        aria-label={`${label} heatmap, last ${weeks} weeks: ${activeDays} active ${activeDays === 1 ? "day" : "days"}`}
      >
        <div className="flex gap-0.75 font-mono text-xs text-ink-3">
          {months.map((month, index) => (
            <span key={rows[index]?.[0]} className="w-3 overflow-visible">
              {month ? MONTHS[Number(month) - 1] : ""}
            </span>
          ))}
        </div>
        <div className="flex gap-0.75">
          {rows.map((week) => (
            <div key={week[0]} className="flex flex-col gap-0.75">
              {week.map((date) => (
                <Cell key={date} cell={cells[date]} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

function Cell({ cell }: { cell: HeatCell | undefined }) {
  const level = cell?.level ?? 0
  return (
    <span
      title={cell?.label}
      className={cn(
        "relative size-3",
        level === "rest"
          ? "border border-dashed border-border"
          : LEVEL_CLASS[level]
      )}
    >
      {cell?.extra ? (
        <span className="absolute inset-0 m-auto size-1 bg-background" />
      ) : null}
    </span>
  )
}

/** A short row of cells (e.g. the last 7 days) for list rows. Same levels and tooltips as `Heatmap`. */
export function HeatStrip({
  cells,
  className,
}: {
  cells: readonly HeatCell[]
  className?: string
}) {
  return (
    <span className={cn("flex gap-0.75", className)} aria-hidden>
      {cells.map((cell, index) => (
        <Cell key={index} cell={cell} />
      ))}
    </span>
  )
}
