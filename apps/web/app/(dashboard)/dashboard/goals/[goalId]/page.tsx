import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { Skeleton } from "@workspace/ui/components/skeleton"

import { InfoHint } from "@/components/shared/info-hint"
import type { HelpKey } from "@/config/help"
import { PageHead } from "@/components/layout/page-head"
import { Heatmap, HeatmapLegend } from "@/components/shared/heatmap"
import { Metric, Metrics } from "@/components/shared/metrics"
import { getGoalActivity } from "@/features/activities/queries"
import { CheckpointList } from "@/features/goals/components/checkpoint-list"
import { GoalDialog } from "@/features/goals/components/goal-dialog"
import { GoalStatusActions } from "@/features/goals/components/goal-status"
import { getGoal } from "@/features/goals/queries"
import { canMarkDone, goalCells } from "@/features/goals/rules"
import { HabitDialog } from "@/features/habits/components/habit-dialog"
import { getCheckIns, getHabits } from "@/features/habits/queries"
import { groupByHabit } from "@/features/habits/rows"
import {
  consistency,
  currentStreak,
  indexByDate,
  scheduleLabel,
} from "@/features/habits/stats"
import { getSettings } from "@/features/settings/queries"
import { TaskRow } from "@/features/tasks/components/task-row"
import { getTasks } from "@/features/tasks/queries"
import { taskRowData } from "@/features/tasks/rows"
import { getToday } from "@/lib/clock"
import { requirePermission } from "@/lib/dal"
import { addDays, formatDay } from "@/lib/dates"

export const metadata: Metadata = { title: "Goal" }

function SectionTitle({
  children,
  hint,
}: {
  children: React.ReactNode
  hint?: HelpKey
}) {
  return (
    <div className="flex items-center gap-1">
      <h2 className="font-mono text-sm font-medium tracking-wide uppercase">
        {children}
      </h2>
      {hint ? <InfoHint topic={hint} /> : null}
    </div>
  )
}

async function GoalDetail({ params }: { params: Promise<{ goalId: string }> }) {
  await requirePermission("dashboard:view")
  const { goalId } = await params
  const goalPromise = getGoal(goalId)
  const habitsPromise = getHabits()
  const settings = await getSettings()
  const today = await getToday(settings.timezone)
  const goal = await goalPromise
  if (!goal) notFound()

  const from = addDays(today, -26 * 7)
  const [activity, habits, checkIns, todayTasks, laterTasks] =
    await Promise.all([
      getGoalActivity(goalId, from),
      habitsPromise,
      getCheckIns(addDays(today, -370), today),
      getTasks("today", today),
      getTasks("later", today),
    ])

  const linkedHabits = habits.filter((habit) => habit.goalId === goalId)
  const grouped = groupByHabit(checkIns)
  const habitRates = linkedHabits.flatMap((habit) => {
    const rate = consistency(
      habit,
      indexByDate(grouped.get(habit.id) ?? []),
      today
    )
    return rate === null ? [] : [rate]
  })
  const habitRate =
    habitRates.length === 0
      ? null
      : Math.round(
          (habitRates.reduce((sum, rate) => sum + rate, 0) /
            habitRates.length) *
            100
        )
  const openTasks = [...todayTasks, ...laterTasks].filter(
    (task) => task.goalId === goalId && task.doneOn === null
  )
  const lastWeek = activity.recent.filter(
    (a) => a.date >= addDays(today, -6)
  ).length
  const habitNames = new Map(habits.map((h) => [h.id, h.name]))

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHead label={goal.status} title={goal.name}>
          {goal.becoming ? `I'm becoming ${goal.becoming}. ` : ""}
          {goal.why ?? ""}
        </PageHead>
        <div className="flex flex-wrap items-center gap-2">
          {goal.status === "active" ? (
            <HabitDialog
              label="New habit"
              goals={[{ id: goal.id, name: goal.name }]}
              defaultGoalId={goal.id}
            />
          ) : null}
          <GoalDialog goal={goal} />
        </div>
      </div>
      <Metrics>
        <Metric label="Things done">{activity.total}</Metric>
        <Metric label="Last 7 days">{lastWeek}</Metric>
        <Metric label="Habits">
          {habitRate === null ? "–" : `${habitRate}%`}
        </Metric>
      </Metrics>
      <section className="grid max-w-3xl gap-8 sm:grid-cols-2">
        <div className="flex flex-col gap-5">
          <SectionTitle>Habits</SectionTitle>
          {linkedHabits.length === 0 ? (
            <p className="text-ink-2">
              None yet. Add one with New habit: a small thing you repeat to move
              this goal forward.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {linkedHabits.map((habit) => (
                <li key={habit.id}>
                  <Link
                    href={`/dashboard/habits/${habit.id}`}
                    prefetch
                    className="hover:underline"
                  >
                    {habit.name}
                  </Link>
                  <span className="block text-xs text-ink-3">
                    {scheduleLabel(habit, today)} ·{" "}
                    {currentStreak(
                      habit,
                      indexByDate(grouped.get(habit.id) ?? []),
                      today
                    )}{" "}
                    in a row
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-col gap-5">
          <SectionTitle>Open tasks</SectionTitle>
          {openTasks.length === 0 ? (
            <p className="text-ink-2">
              None open. On Today, type # and this goal&apos;s name in the task
              box to link one.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {openTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={taskRowData(task, today)}
                  today={today}
                />
              ))}
            </div>
          )}
        </div>
      </section>
      <section className="flex max-w-2xl flex-col gap-5">
        <SectionTitle hint="checkpoints">Checkpoints</SectionTitle>
        <CheckpointList goalId={goal.id} checkpoints={goal.checkpoints} />
      </section>
      <section className="flex flex-col gap-5">
        <SectionTitle>Activity</SectionTitle>
        <Heatmap
          end={today}
          weeks={26}
          weekStart={settings.weekStart}
          cells={goalCells(
            activity.recent.map((a) => a.date),
            from,
            today,
            (date, count) =>
              `${formatDay(date)} · ${count} ${count === 1 ? "thing" : "things"}`
          )}
        />
        <HeatmapLegend />
        {activity.recent.length === 0 ? (
          <p className="text-ink-2">
            Nothing yet. It fills in as you tick habits and finish tasks for
            this goal.
          </p>
        ) : (
          <ul className="flex max-w-2xl flex-col gap-2">
            {activity.recent.slice(0, 8).map((a) => (
              <li key={a.id} className="text-ink-2">
                <span className="font-mono text-xs text-ink-3">
                  {formatDay(a.date)}
                </span>{" "}
                {a.source === "habit"
                  ? (habitNames.get(a.habitId ?? "") ?? "Habit check-in")
                  : (a.note ?? "Task done")}
              </li>
            ))}
          </ul>
        )}
      </section>
      {goal.ifHardObstacle || goal.ifHardPlan ? (
        <section className="grid max-w-2xl gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs tracking-wider text-ink-3 uppercase">
              If it gets hard
            </span>
            <p className="text-ink-2">{goal.ifHardObstacle ?? "–"}</p>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs tracking-wider text-ink-3 uppercase">
              Then I will
            </span>
            <p className="text-ink-2">{goal.ifHardPlan ?? "–"}</p>
          </div>
        </section>
      ) : null}
      <GoalStatusActions
        goalId={goal.id}
        status={goal.status}
        canMarkDone={canMarkDone(goal)}
      />
    </>
  )
}

export default function GoalPage({
  params,
}: {
  params: Promise<{ goalId: string }>
}) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <GoalDetail params={params} />
    </Suspense>
  )
}
