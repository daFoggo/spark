import { DitherMeter } from "@/components/shared/dither-meter"
import { InfoHint } from "@/components/shared/info-hint"
import { WeekStrip, type WeekDay } from "@/components/shared/week-strip"
import type { HelpKey } from "@/config/help"
import { overallCells } from "@/features/habits/stats"
import { PetCard } from "@/features/pet/components/pet-card"
import { petState } from "@/features/pet/pet"
import {
  addDays,
  dateRange,
  formatDay,
  startOfWeek,
  weekday,
} from "@/lib/dates"

import { BACKDATE_DAYS } from "../dashboard/_components/day"
import { loadDashboard } from "./dashboard-data"
import { DASHBOARD_PATH } from "@/config/routes"

const INITIALS = ["S", "M", "T", "W", "T", "F", "S"]

function Block({
  title,
  hint,
  children,
}: {
  title: string
  hint?: HelpKey
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <h3 className="font-mono text-xs tracking-wider text-ink-3 uppercase">
          {title}
        </h3>
        {hint ? <InfoHint topic={hint} /> : null}
      </div>
      {children}
    </section>
  )
}

/** Inspector body: the pet, this week's rhythm and the tasks to do next. */
export async function InspectorContent() {
  const {
    settings,
    today,
    habits,
    byHabit,
    stats,
    tasks: todayTasks,
    week,
  } = await loadDashboard()
  const tasks = todayTasks.filter((task) => task.doneOn === null)

  const first = startOfWeek(today, settings.weekStart)
  const cells = overallCells(
    habits,
    byHabit,
    first,
    addDays(first, 6),
    (date, due, done) => `${formatDay(date)} · ${done}/${due} habits`
  )
  const days: WeekDay[] = dateRange(first, addDays(first, 6)).flatMap(
    (date) => {
      const cell = cells[date]
      return cell
        ? [
            {
              initial: INITIALS[weekday(date)] ?? "",
              cell,
              today: date === today,
              future: date > today,
              // AC-10: today and the days back to the back-dating limit open on Today.
              href:
                date > today || date < addDays(today, -BACKDATE_DAYS)
                  ? undefined
                  : date === today
                    ? DASHBOARD_PATH
                    : `${DASHBOARD_PATH}?day=${date}`,
            },
          ]
        : []
    }
  )

  const pet = petState({
    treats: stats.treats,
    lastActivity: stats.lastActivity,
    today,
    weekRate: week.done / Math.max(1, week.dueSoFar),
  })

  return (
    <>
      <Block title="Companion" hint="pet">
        <PetCard name={settings.petName} state={pet} />
      </Block>
      <Block title="This week" hint="weeklyTarget">
        <WeekStrip days={days} />
        <p className="text-ink-2">
          {week.due === 0
            ? "No habits are due this week."
            : `${week.done} of ${week.due} habit check-ins done.`}
        </p>
        {week.due > 0 ? (
          <DitherMeter
            label="Weekly target"
            value={(week.done / Math.max(1, week.target)) * 100}
          />
        ) : null}
      </Block>
      <Block title="Up next" hint="upNext">
        {tasks.length === 0 ? (
          <p className="text-ink-2">No tasks for today.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {tasks.slice(0, 5).map((task) => (
              <li key={task.id} className="flex gap-2 text-ink-2">
                <span aria-hidden className="text-ink-3">
                  □
                </span>
                {task.title}
              </li>
            ))}
          </ul>
        )}
        {tasks.length > 5 ? (
          <p className="text-xs text-ink-3">+{tasks.length - 5} more</p>
        ) : null}
      </Block>
    </>
  )
}
