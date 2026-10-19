import {
  addDays,
  dateRange,
  daysBetween,
  weekday,
  type LocalDate,
} from "@/lib/dates"
import type { HeatCell } from "@/components/shared/heatmap"

import type { CheckIn, Habit, ScheduleRow } from "./schemas"

/** Pure habit rules (spec HB-2…HB-5, MT-1…MT-7). Dates are local dates; callers pass `today`. */

type CheckInIndex = ReadonlyMap<LocalDate, CheckIn>

export function indexByDate(checkIns: readonly CheckIn[]): CheckInIndex {
  return new Map(checkIns.map((checkIn) => [checkIn.date, checkIn]))
}

/** HB-4: the latest schedule row whose `validFrom` is on or before `date`. */
function scheduleOn(
  schedules: readonly ScheduleRow[],
  date: LocalDate
): ScheduleRow | undefined {
  let found: ScheduleRow | undefined
  for (const row of schedules) {
    if (row.validFrom <= date && (!found || row.validFrom > found.validFrom)) {
      found = row
    }
  }
  return found
}

/** HB-5: paused days are "not scheduled". */
export function isPaused(habit: Habit, date: LocalDate): boolean {
  return (
    habit.pausedFrom !== null &&
    habit.pausedFrom <= date &&
    (habit.pausedUntil === null || date <= habit.pausedUntil)
  )
}

/** HB-2, HB-3, HB-5: is the habit scheduled on `date`? */
export function isDue(habit: Habit, date: LocalDate): boolean {
  if (date < habit.startsOn || isPaused(habit, date)) return false
  const schedule = scheduleOn(habit.schedules, date)
  if (!schedule) return false
  return schedule.kind === "days"
    ? schedule.weekdays.includes(weekday(date))
    : daysBetween(habit.startsOn, date) % schedule.everyN === 0
}

/** Due dates from `from` to `to`, oldest first. */
function dueDates(habit: Habit, from: LocalDate, to: LocalDate): LocalDate[] {
  return dateRange(from < habit.startsOn ? habit.startsOn : from, to).filter(
    (date) => isDue(habit, date)
  )
}

/** MT-1: walk back over due dates; one miss is forgiven, two in a row end the run. Today only counts once done. */
export function currentStreak(
  habit: Habit,
  checkIns: CheckInIndex,
  today: LocalDate
): number {
  let streak = 0
  let misses = 0
  for (const date of dueDates(habit, habit.startsOn, today).reverse()) {
    if (checkIns.has(date)) {
      streak += 1
      misses = 0
    } else if (date !== today) {
      misses += 1
      if (misses >= 2) break
    }
  }
  return streak
}

/** MT-2: the longest MT-1 run in the habit's history. */
export function bestStreak(
  habit: Habit,
  checkIns: CheckInIndex,
  today: LocalDate
): number {
  let run = 0
  let best = 0
  let misses = 0
  for (const date of dueDates(habit, habit.startsOn, today)) {
    if (checkIns.has(date)) {
      run += 1
      misses = 0
      best = Math.max(best, run)
    } else if (date !== today) {
      misses += 1
      if (misses >= 2) {
        run = 0
        misses = 0
      }
    }
  }
  return best
}

/** MT-3: check-ins on due dates over due dates in the last `days` days (30 by default); `null` when nothing was due. */
export function consistency(
  habit: Habit,
  checkIns: CheckInIndex,
  today: LocalDate,
  days = 30
): number | null {
  const due = dueDates(habit, addDays(today, -(days - 1)), today)
  if (due.length === 0) return null
  return due.filter((date) => checkIns.has(date)).length / due.length
}

export type WeekdayRate = { due: number; done: number }

/** MT-6: per weekday (0 = Sunday), done / due over the last 364 days. */
export function weekdayRates(
  habit: Habit,
  checkIns: CheckInIndex,
  today: LocalDate
): WeekdayRate[] {
  const rates = Array.from({ length: 7 }, () => ({ due: 0, done: 0 }))
  for (const date of dueDates(habit, addDays(today, -363), today)) {
    const rate = rates[weekday(date)]
    if (!rate) continue
    rate.due += 1
    if (checkIns.has(date)) rate.done += 1
  }
  return rates
}

/** MT-6: the weekday with the lowest rate, only once the habit has at least 10 check-ins. */
export function toughestWeekday(
  rates: readonly WeekdayRate[],
  totalCheckIns: number
): number | null {
  if (totalCheckIns < 10) return null
  let worst: number | null = null
  let worstRate = 1
  rates.forEach((rate, index) => {
    if (rate.due < 3) return
    const value = rate.done / rate.due
    if (value < worstRate) {
      worst = index
      worstRate = value
    }
  })
  return worst
}

/** MT-7 (habit): missed 0, minimum 2, full 4, not scheduled "rest"; a check-in off schedule is marked extra. */
export function habitCells(
  habit: Habit,
  checkIns: CheckInIndex,
  from: LocalDate,
  to: LocalDate,
  describe: (date: LocalDate, state: string) => string
): Partial<Record<LocalDate, HeatCell>> {
  const cells: Partial<Record<LocalDate, HeatCell>> = {}
  for (const date of dateRange(from, to)) {
    const checkIn = checkIns.get(date)
    const due = isDue(habit, date)
    if (checkIn) {
      const level = checkIn.level === "full" ? 4 : 2
      cells[date] = {
        level,
        extra: !due,
        label: describe(
          date,
          due
            ? checkIn.level === "full"
              ? "Done"
              : "Minimum"
            : "Extra session"
        ),
      }
    } else if (due) {
      cells[date] = { level: 0, label: describe(date, "Missed") }
    } else {
      cells[date] = { level: "rest", label: describe(date, "Not scheduled") }
    }
  }
  return cells
}

export type DayTotals = { date: LocalDate; due: number; score: number }

/** MT-7 (overall): sum of habit values (full 2, minimum 1) over 2 × due habits, bucketed 0…4. */
export function overallLevel(due: number, score: number): 0 | 1 | 2 | 3 | 4 {
  if (due === 0 || score === 0) return 0
  const ratio = score / (2 * due)
  if (ratio < 0.3) return 1
  if (ratio < 0.6) return 2
  if (ratio < 0.85) return 3
  return 4
}

export function overallCells(
  habits: readonly Habit[],
  byHabit: ReadonlyMap<string, CheckInIndex>,
  from: LocalDate,
  to: LocalDate,
  describe: (date: LocalDate, due: number, done: number) => string
): Partial<Record<LocalDate, HeatCell>> {
  const cells: Partial<Record<LocalDate, HeatCell>> = {}
  for (const date of dateRange(from, to)) {
    let due = 0
    let done = 0
    let score = 0
    for (const habit of habits) {
      const checkIn = byHabit.get(habit.id)?.get(date)
      if (isDue(habit, date)) due += 1
      if (checkIn) {
        done += 1
        score += checkIn.level === "full" ? 2 : 1
      }
    }
    // Extra sessions still count as effort for the day (AC-4): they raise the score, not the due count.
    cells[date] = {
      level:
        due === 0 && done === 0 ? 0 : overallLevel(Math.max(due, done), score),
      label: describe(date, due, done),
    }
  }
  return cells
}

export type WeekProgress = {
  /** Due check-ins in the whole week. */
  due: number
  /** Due dates up to and including today. */
  dueSoFar: number
  /** Check-ins on due dates this week. */
  done: number
  /** MT-4: 80% of the week's due check-ins, rounded up. */
  target: number
}

/** MT-4: this week's numbers across habits. */
export function weekProgress(
  habits: readonly Habit[],
  byHabit: ReadonlyMap<string, CheckInIndex>,
  weekStartDate: LocalDate,
  today: LocalDate
): WeekProgress {
  let due = 0
  let dueSoFar = 0
  let done = 0
  for (const date of dateRange(weekStartDate, addDays(weekStartDate, 6))) {
    for (const habit of habits) {
      if (!isDue(habit, date)) continue
      due += 1
      if (date <= today) dueSoFar += 1
      if (byHabit.get(habit.id)?.has(date)) done += 1
    }
  }
  return { due, dueSoFar, done, target: Math.ceil(due * 0.8) }
}

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

/** "Mon, Wed, Fri" / "Every 3 days" / "Every day" for the schedule in force on `date`. */
export function scheduleLabel(habit: Habit, date: LocalDate): string {
  const schedule = scheduleOn(habit.schedules, date) ?? habit.schedules.at(-1)
  if (!schedule) return "No schedule"
  if (schedule.kind === "every") return `Every ${schedule.everyN} days`
  const days = [...schedule.weekdays].sort((a, b) => a - b)
  return days.length === 7
    ? "Every day"
    : days.map((day) => WEEKDAY_NAMES[day]).join(", ")
}

/** RV-2: done and due check-ins of one habit from `from` through `to` (extra sessions do not count). */
export function habitWeek(
  habit: Habit,
  checkIns: CheckInIndex,
  from: LocalDate,
  to: LocalDate
): { done: number; due: number } {
  const due = dueDates(habit, from, to)
  return { due: due.length, done: due.filter((d) => checkIns.has(d)).length }
}
