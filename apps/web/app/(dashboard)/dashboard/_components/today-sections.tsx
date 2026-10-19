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

import { Heatmap, HeatmapLegend } from "@/components/shared/heatmap"
import { Metric, Metrics } from "@/components/shared/metrics"
import { LogForm } from "@/features/activities/components/log-form"
import { LogList } from "@/features/activities/components/log-list"
import { getActivities } from "@/features/activities/queries"
import { HabitDialog } from "@/features/habits/components/habit-dialog"
import { HabitRow } from "@/features/habits/components/habit-row"
import { habitRowData } from "@/features/habits/rows"
import { isDue, isPaused, overallCells } from "@/features/habits/stats"
import { TaskAdd } from "@/features/tasks/components/task-add"
import { TaskRow } from "@/features/tasks/components/task-row"
import { taskRowData } from "@/features/tasks/rows"
import { petState } from "@/features/pet/pet"
import { PetCard } from "@/features/pet/components/pet-card"
import { addDays, formatDay } from "@/lib/dates"

import { loadDashboard } from "../../_components/dashboard-data"

const TIMES = [
  ["morning", "Morning"],
  ["afternoon", "Afternoon"],
  ["evening", "Evening"],
] as const

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-mono text-sm font-medium tracking-wide uppercase">
      {children}
    </h2>
  )
}

export async function TodayMetrics() {
  const { stats, week } = await loadDashboard()
  const remaining = Math.max(0, week.target - week.done)
  return (
    <Metrics>
      <Metric label="Done today">{stats.doneToday}</Metric>
      <Metric label="This week">
        {week.done}/{week.due}
      </Metric>
      <Metric label="Weekly target">
        {week.due === 0
          ? "–"
          : remaining === 0
            ? "Reached"
            : `${remaining} to go`}
      </Metric>
      <Metric label="Treats">{stats.treats}</Metric>
    </Metrics>
  )
}

export async function TodayHabits() {
  const { today, habits, grouped, goals } = await loadDashboard()

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

  const due = habits.filter((habit) => isDue(habit, today))
  // AC-4: habits that are not due stay one tap away, collapsed. Paused ones stay out of the way.
  const extra = habits.filter(
    (habit) => !isDue(habit, today) && !isPaused(habit, today)
  )
  const row = (habit: (typeof habits)[number]) =>
    habitRowData(habit, grouped.get(habit.id) ?? [], today)

  return (
    <section className="flex max-w-3xl flex-col gap-5">
      <SectionTitle>Habits</SectionTitle>
      {due.length === 0 ? (
        <p className="text-ink-2">Nothing is due today. Enjoy the rest.</p>
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
                  <HabitRow key={habit.id} habit={row(habit)} date={today} />
                ))}
              </ItemGroup>
            </div>
          )
        })
      )}
      {extra.length > 0 ? (
        <Collapsible className="flex flex-col gap-2">
          <CollapsibleTrigger className="w-fit font-mono text-xs tracking-wider text-ink-3 uppercase hover:text-foreground">
            Not scheduled today ({extra.length})
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ItemGroup className="gap-2">
              {extra.map((habit) => (
                <HabitRow
                  key={habit.id}
                  habit={row(habit)}
                  date={today}
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
      <SectionTitle>Tasks</SectionTitle>
      <TaskAdd
        goals={goals}
        placeholder="Add a task. #goal links it to a goal"
      />
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

export async function TodayLog() {
  const { today, goals } = await loadDashboard()
  const logs = await getActivities(addDays(today, -3), today, "log")
  return (
    <section className="flex flex-col gap-5">
      <SectionTitle>Log</SectionTitle>
      <LogForm
        today={today}
        goals={goals.filter((goal) => goal.status === "active")}
      />
      {logs.length > 0 ? (
        <LogList
          entries={logs.slice(0, 5).map((log) => ({
            id: log.id,
            day: log.date === today ? "Today" : formatDay(log.date),
            note: log.note ?? "",
            meta: [log.hours ? `${log.hours} h` : "", log.topic ?? ""]
              .filter(Boolean)
              .join(" · "),
          }))}
        />
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

export async function TodayActivityMap() {
  const { settings, today, habits, byHabit } = await loadDashboard()
  return (
    <section className="flex flex-col gap-5">
      <SectionTitle>Activity</SectionTitle>
      <Heatmap
        end={today}
        weeks={26}
        weekStart={settings.weekStart}
        cells={overallCells(
          habits,
          byHabit,
          addDays(today, -26 * 7),
          today,
          (date, due, done) =>
            `${formatDay(date)} · ${done}/${due} ${due === 1 ? "habit" : "habits"}`
        )}
      />
      <HeatmapLegend />
    </section>
  )
}
