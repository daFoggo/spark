import { addDays, formatDay, type LocalDate } from "@/lib/dates"

import type { HabitRowData } from "./components/habit-row"
import type { CheckIn, Habit } from "./schemas"
import { currentStreak, habitCells, indexByDate } from "./stats"

/** Everything a Today row needs, computed from the habit and its check-ins (pure). */
export function habitRowData(
  habit: Habit,
  checkIns: readonly CheckIn[],
  today: LocalDate,
  /** The day being checked in (AC-10); streak and strip stay relative to today. */
  day: LocalDate = today,
  goalName: string | null = null
): HabitRowData {
  const byDate = indexByDate(checkIns)
  const cells = habitCells(
    habit,
    byDate,
    addDays(today, -6),
    today,
    (date, state) => `${formatDay(date)} · ${state}`
  )
  return {
    id: habit.id,
    name: habit.name,
    cue: habit.cue,
    minimumVersion: habit.minimumVersion,
    goalName,
    streak: currentStreak(habit, byDate, today),
    level: byDate.get(day)?.level ?? null,
    strip: Object.values(cells).filter((cell) => cell !== undefined),
  }
}

/** Check-ins grouped by habit id. */
export function groupByHabit(
  checkIns: readonly CheckIn[]
): Map<string, CheckIn[]> {
  const groups = new Map<string, CheckIn[]>()
  for (const checkIn of checkIns) {
    groups.set(checkIn.habitId, [
      ...(groups.get(checkIn.habitId) ?? []),
      checkIn,
    ])
  }
  return groups
}
