import { cn } from "@workspace/ui/lib/utils"

import type { HeatCell } from "./heatmap"

const LEVEL_CLASS = [
  "bg-border/40",
  "bg-heat-1",
  "bg-heat-2",
  "bg-heat-3",
  "bg-heat-4",
] as const

export type WeekDay = {
  /** One letter under the cell. */
  initial: string
  cell: HeatCell
  today: boolean
  /** Days after today are drawn empty. */
  future: boolean
}

/** Seven cells for the current week, one column per day (inspector "This week"). Pure presentation. */
export function WeekStrip({ days }: { days: readonly WeekDay[] }) {
  return (
    <ol className="grid grid-cols-7 gap-1.5">
      {days.map((day, index) => {
        const level =
          day.future || day.cell.level === "rest" ? 0 : day.cell.level
        return (
          <li
            key={index}
            title={day.cell.label}
            className="flex flex-col items-center gap-1.5 font-mono text-xs text-ink-3"
          >
            <span
              className={cn(
                "aspect-square w-full",
                LEVEL_CLASS[level],
                day.today && "outline outline-offset-2 outline-foreground"
              )}
            />
            {day.initial}
          </li>
        )
      })}
    </ol>
  )
}
