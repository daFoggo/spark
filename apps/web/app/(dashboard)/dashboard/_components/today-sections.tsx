import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@workspace/ui/components/item"

import Link from "next/link"

import { InfoHint } from "@/components/shared/info-hint"
import type { HelpKey } from "@/config/help"
import { GOALS_PATH } from "@/config/routes"
import { HabitRow } from "@/features/habits/components/habit-row"
import { habitRowData } from "@/features/habits/rows"
import { isDue, isPaused } from "@/features/habits/stats"
import { TaskAdd } from "@/features/tasks/components/task-add"
import { TaskRow } from "@/features/tasks/components/task-row"
import { taskRowData } from "@/features/tasks/rows"
import { petState } from "@/features/pet/pet"
import { PetCard } from "@/features/pet/components/pet-card"

import { loadDashboard } from "../../_components/dashboard-data"
import { resolveDay } from "./day"

const TIMES = [
  ["morning", "Morning"],
  ["afternoon", "Afternoon"],
  ["evening", "Evening"],
] as const

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

/**
 * The active goals above the habits: the top of the model (principle 9). One line each, with how
 * many of its habits are done on the picked day. Hidden until a goal exists; Get started offers one.
 */
export async function TodayGoals({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>
}) {
  const { today, habits, goals, byHabit } = await loadDashboard()
  const day = await resolveDay(searchParams, today)
  const active = goals.filter((goal) => goal.status === "active")
  if (active.length === 0) return null
  return (
    <section className="flex max-w-3xl flex-col gap-5">
      <SectionTitle hint="goal">Active goals</SectionTitle>
      <ItemGroup className="gap-2">
        {active.map((goal) => {
          const due = habits.filter(
            (habit) => habit.goalId === goal.id && isDue(habit, day)
          )
          const done = due.filter((habit) => byHabit.get(habit.id)?.has(day))
          return (
            <Item
              key={goal.id}
              variant="outline"
              size="sm"
              render={<Link href={`${GOALS_PATH}/${goal.id}`} />}
            >
              <ItemContent>
                <ItemTitle>{goal.becoming ?? goal.name}</ItemTitle>
                <ItemDescription>
                  {goal.becoming ? `${goal.name} · ` : ""}
                  {due.length === 0
                    ? "No habits due"
                    : `${done.length}/${due.length} habits done`}
                </ItemDescription>
              </ItemContent>
            </Item>
          )
        })}
      </ItemGroup>
    </section>
  )
}

export async function TodayHabits({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>
}) {
  const { today, habits, grouped, goals } = await loadDashboard()
  const day = await resolveDay(searchParams, today)

  // With no habit yet, Get started above is the call to action.
  if (habits.length === 0) return null

  const due = habits.filter((habit) => isDue(habit, day))
  // AC-4: habits that are not due stay one tap away, collapsed. Paused ones stay out of the way.
  const extra = habits.filter(
    (habit) => !isDue(habit, day) && !isPaused(habit, day)
  )
  const goalNames = new Map(goals.map((goal) => [goal.id, goal.name]))
  const row = (habit: (typeof habits)[number]) =>
    habitRowData(
      habit,
      grouped.get(habit.id) ?? [],
      today,
      day,
      habit.goalId ? (goalNames.get(habit.goalId) ?? null) : null
    )

  return (
    <section className="flex max-w-3xl flex-col gap-5">
      <SectionTitle hint="minimum">Habits</SectionTitle>
      {due.length === 0 ? (
        <p className="text-ink-2">
          {day === today
            ? "Nothing is due today. Enjoy the rest."
            : "Nothing was due that day."}
        </p>
      ) : (
        TIMES.map(([key, label]) => {
          const group = due.filter((habit) => habit.timeOfDay === key)
          if (group.length === 0) return null
          return (
            <div key={key} className="flex flex-col gap-2">
              <span className="font-mono text-xs tracking-wider text-ink-3 uppercase">
                {label}
              </span>
              <ItemGroup className="gap-2">
                {group.map((habit) => (
                  <HabitRow
                    key={`${habit.id}-${day}`}
                    habit={row(habit)}
                    date={day}
                  />
                ))}
              </ItemGroup>
            </div>
          )
        })
      )}
      {extra.length > 0 ? (
        <Collapsible className="flex flex-col gap-2">
          <CollapsibleTrigger className="w-fit font-mono text-xs tracking-wider text-ink-3 uppercase hover:text-foreground">
            Not scheduled {day === today ? "today" : "that day"} ({extra.length}
            )
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ItemGroup className="gap-2">
              {extra.map((habit) => (
                <HabitRow
                  key={`${habit.id}-${day}`}
                  habit={row(habit)}
                  date={day}
                  extra
                />
              ))}
            </ItemGroup>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </section>
  )
}

export async function TodayTasks() {
  const { today, tasks, goals } = await loadDashboard()
  const goalNames = new Map(goals.map((goal) => [goal.id, goal.name]))
  return (
    <section className="flex max-w-3xl flex-col gap-5">
      <SectionTitle hint="carryOver">Tasks</SectionTitle>
      <TaskAdd goals={goals} placeholder="Add a task" />
      {tasks.length > 0 ? (
        <ItemGroup className="gap-2">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={taskRowData(task, today, goalNames)}
              today={today}
            />
          ))}
        </ItemGroup>
      ) : null}
    </section>
  )
}

export async function TodayPet() {
  const { settings, today, stats, week } = await loadDashboard()
  const state = petState({
    treats: stats.treats,
    lastActivity: stats.lastActivity,
    today,
    weekRate: week.done / Math.max(1, week.dueSoFar),
  })
  return <PetCard name={settings.petName} state={state} />
}
