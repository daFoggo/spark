import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { ItemGroup } from "@workspace/ui/components/item"

import { InfoHint } from "@/components/shared/info-hint"
import type { HelpKey } from "@/config/help"
import { LogDialog } from "@/features/activities/components/log-dialog"
import { HabitDialog } from "@/features/habits/components/habit-dialog"
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

export async function TodayHabits({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>
}) {
  const { today, habits, grouped, goals } = await loadDashboard()
  const day = await resolveDay(searchParams, today)

  if (habits.length === 0) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyTitle>Nothing to check in yet</EmptyTitle>
          <EmptyDescription>
            Create a habit and it will show up here on the days it is due.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <HabitDialog
            label="New habit"
            goals={goals.filter((goal) => goal.status === "active")}
          />
        </EmptyContent>
      </Empty>
    )
  }

  const due = habits.filter((habit) => isDue(habit, day))
  // AC-4: habits that are not due stay one tap away, collapsed. Paused ones stay out of the way.
  const extra = habits.filter(
    (habit) => !isDue(habit, day) && !isPaused(habit, day)
  )
  const row = (habit: (typeof habits)[number]) =>
    habitRowData(habit, grouped.get(habit.id) ?? [], today, day)

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

export async function TodayLog({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>
}) {
  const { today, goals } = await loadDashboard()
  const day = await resolveDay(searchParams, today)
  return (
    <LogDialog
      day={day}
      goals={goals.filter((goal) => goal.status === "active")}
    />
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
