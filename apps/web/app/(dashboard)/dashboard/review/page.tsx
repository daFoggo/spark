import type { Metadata } from "next"
import { Suspense } from "react"

import { Skeleton } from "@workspace/ui/components/skeleton"

import { PageHead } from "@/components/layout/page-head"
import { getActivities } from "@/features/activities/queries"
import { getGoals } from "@/features/goals/queries"
import { getCheckIns, getHabits } from "@/features/habits/queries"
import { groupByHabit } from "@/features/habits/rows"
import { consistency, habitWeek, indexByDate } from "@/features/habits/stats"
import {
  ReviewFlow,
  type ReviewData,
} from "@/features/reviews/components/review-flow"
import { getReview } from "@/features/reviews/queries"
import { suggestEasier } from "@/features/reviews/rules"
import { getCalendar } from "@/features/settings/queries"
import { getTasks } from "@/features/tasks/queries"
import { getToday } from "@/lib/clock"
import { requirePermission } from "@/lib/dal"
import { addDays, formatDay, startOfWeek } from "@/lib/dates"

export const metadata: Metadata = { title: "Weekly review" }

async function Review() {
  await requirePermission("dashboard:view")
  const habitsPromise = getHabits()
  const goalsPromise = getGoals()
  // May reject before Promise.all attaches; marked handled, still awaited below.
  habitsPromise.catch(() => {})
  goalsPromise.catch(() => {})
  const calendar = await getCalendar()
  const today = await getToday(calendar.timezone)
  const weekStart = startOfWeek(today, calendar.weekStart)

  const [
    review,
    habits,
    checkIns,
    activities,
    done,
    todayTasks,
    laterTasks,
    goals,
  ] = await Promise.all([
    getReview(weekStart),
    habitsPromise,
    getCheckIns(addDays(today, -370), today),
    getActivities(weekStart, today),
    getTasks("done", today),
    getTasks("today", today),
    getTasks("later", today),
    goalsPromise,
  ])

  const grouped = groupByHabit(checkIns)
  const reviewHabits = habits.map((habit) => {
    const byDate = indexByDate(grouped.get(habit.id) ?? [])
    const week = habitWeek(habit, byDate, weekStart, today)
    const rate14 = consistency(habit, byDate, today, 14)
    return {
      id: habit.id,
      name: habit.name,
      done: week.done,
      due: week.due,
      rate14,
      suggestEasier: suggestEasier(rate14),
    }
  })
  const goalNames = new Map(goals.map((goal) => [goal.id, goal.name]))
  const hours = activities.reduce((sum, a) => sum + (a.hours ?? 0), 0)

  const data: ReviewData = {
    weekStart,
    totals: {
      checkIns: `${reviewHabits.reduce((n, h) => n + h.done, 0)}/${reviewHabits.reduce((n, h) => n + h.due, 0)}`,
      logged: activities.filter((a) => a.source === "log").length,
      tasksDone: done.filter((task) => (task.doneOn ?? "") >= weekStart).length,
      hours: hours.toFixed(1),
    },
    habits: reviewHabits,
    tasks: [...todayTasks, ...laterTasks]
      .filter((task) => task.doneOn === null)
      .map((task) => ({
        id: task.id,
        title: task.title,
        goalName: task.goalId ? (goalNames.get(task.goalId) ?? null) : null,
      })),
    initial: {
      reflection: review?.reflection ?? "",
      choices: review?.habitChoices ?? {},
      focus: review?.focusTaskIds ?? [],
    },
    saved: review?.completedAt != null,
  }

  return (
    <>
      <PageHead
        label={`Week of ${formatDay(weekStart)}`}
        title="Weekly review"
        hint="review"
      >
        Five minutes to see what worked and set up next week.
      </PageHead>
      <ReviewFlow key={weekStart} data={data} />
    </>
  )
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 max-w-3xl" />}>
      <Review />
    </Suspense>
  )
}
