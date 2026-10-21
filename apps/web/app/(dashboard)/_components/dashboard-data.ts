import { cache } from "react"

import { getActivityStats } from "@/features/activities/queries"
import { getGoals } from "@/features/goals/queries"
import { getCheckIns, getHabits } from "@/features/habits/queries"
import { groupByHabit } from "@/features/habits/rows"
import { indexByDate, weekProgress } from "@/features/habits/stats"
import { getCalendar, getSettings } from "@/features/settings/queries"
import { getTasks } from "@/features/tasks/queries"
import { getToday } from "@/lib/clock"
import { requirePermission } from "@/lib/dal"
import { addDays, startOfWeek } from "@/lib/dates"

/** Days of check-ins the dashboard reads: enough for streaks and the 26-week map. */
const HISTORY_DAYS = 370

/**
 * Everything the Today sections and the inspector need, loaded once per request
 * (`React.cache`, data-fetching §4.3): the sections that call it share one promise instead of
 * each starting their own reads. Reads that do not need today's date start first (§4.2), and
 * everything that does runs in parallel once it is known.
 */
export const loadDashboard = cache(async () => {
  await requirePermission("dashboard:view")
  const habitsPromise = getHabits()
  const goalsPromise = getGoals()
  const settingsPromise = getSettings()
  const { timezone, weekStart, adoptedOn } = await getCalendar()
  const today = await getToday(timezone)
  const [habits, checkIns, stats, tasks, goals, settings] = await Promise.all([
    habitsPromise,
    getCheckIns(addDays(today, -HISTORY_DAYS), today),
    getActivityStats(adoptedOn, today),
    getTasks("today", today),
    goalsPromise,
    settingsPromise,
  ])
  const grouped = groupByHabit(checkIns)
  const byHabit = new Map(
    habits.map((habit) => [habit.id, indexByDate(grouped.get(habit.id) ?? [])])
  )
  const week = weekProgress(
    habits,
    byHabit,
    startOfWeek(today, weekStart),
    today
  )
  return {
    settings,
    today,
    habits,
    grouped,
    byHabit,
    stats,
    tasks,
    week,
    goals,
  }
})
