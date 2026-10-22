import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@workspace/ui/components/item"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { PageHead } from "@/components/layout/page-head"
import { HeatStrip } from "@/components/shared/heatmap"
import { GOALS_PATH, HABITS_PATH } from "@/config/routes"
import { HabitDialog } from "@/features/habits/components/habit-dialog"
import { getGoals } from "@/features/goals/queries"
import { getCheckIns, getHabits } from "@/features/habits/queries"
import { groupByHabit, habitRowData } from "@/features/habits/rows"
import {
  consistency,
  indexByDate,
  scheduleLabel,
} from "@/features/habits/stats"
import { getCalendar } from "@/features/settings/queries"
import { getToday } from "@/lib/clock"
import { requirePermission } from "@/lib/dal"
import { addDays } from "@/lib/dates"

import { HabitsActivityMap, HabitsMetrics } from "./_components/habits-overview"

export const metadata: Metadata = { title: "Habits" }

async function HabitList() {
  await requirePermission("dashboard:view")
  const habitsPromise = getHabits()
  const goalsPromise = getGoals()
  // May reject before Promise.all attaches; marked handled, still awaited below.
  habitsPromise.catch(() => {})
  goalsPromise.catch(() => {})
  const { timezone } = await getCalendar()
  const today = await getToday(timezone)
  const [habits, checkIns, goals] = await Promise.all([
    habitsPromise,
    getCheckIns(addDays(today, -29), today),
    goalsPromise,
  ])

  if (habits.length === 0) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyTitle>No habits yet</EmptyTitle>
          <EmptyDescription>
            Start with one small thing you can do even on a bad day.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <HabitDialog
            label="Create your first habit"
            goals={goals.filter((goal) => goal.status === "active")}
          />
        </EmptyContent>
      </Empty>
    )
  }

  const grouped = groupByHabit(checkIns)
  // Principle 9: habits sit under the goal they serve; the ones without a goal come last.
  const sections = [
    ...goals.map((goal) => ({
      key: goal.id,
      title: goal.becoming ?? goal.name,
      href: `${GOALS_PATH}/${goal.id}`,
      habits: habits.filter((habit) => habit.goalId === goal.id),
    })),
    {
      key: "none",
      title: "No goal",
      href: undefined,
      habits: habits.filter(
        (habit) => !goals.some((goal) => goal.id === habit.goalId)
      ),
    },
  ].filter((section) => section.habits.length > 0)
  const showTitles = sections.length > 1 || sections[0]?.key !== "none"
  return (
    <div className="flex max-w-3xl flex-col gap-8">
      {sections.map((section) => (
        <section key={section.key} className="flex flex-col gap-3">
          {showTitles ? (
            <h2 className="font-mono text-sm font-medium tracking-wide uppercase">
              {section.href ? (
                <Link href={section.href} className="hover:underline">
                  {section.title}
                </Link>
              ) : (
                section.title
              )}
            </h2>
          ) : null}
          <ItemGroup role="none" className="gap-2">
            {section.habits.map((habit) => {
              const mine = grouped.get(habit.id) ?? []
              const row = habitRowData(habit, mine, today)
              const rate = consistency(habit, indexByDate(mine), today)
              return (
                <Item
                  key={habit.id}
                  variant="outline"
                  size="sm"
                  render={
                    <Link href={`${HABITS_PATH}/${habit.id}`} prefetch />
                  }
                >
                  <ItemContent>
                    <ItemTitle>{habit.name}</ItemTitle>
                    <ItemDescription>
                      {scheduleLabel(habit, today)}
                      {row.streak > 0 ? ` · ${row.streak} in a row` : ""}
                      {rate !== null
                        ? ` · ${Math.round(rate * 100)}% this month`
                        : ""}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <HeatStrip cells={row.strip} className="max-sm:hidden" />
                  </ItemActions>
                </Item>
              )
            })}
          </ItemGroup>
        </section>
      ))}
    </div>
  )
}

async function NewHabit() {
  await requirePermission("dashboard:view")
  const goals = await getGoals()
  return (
    <HabitDialog
      label="New habit"
      goals={goals.filter((goal) => goal.status === "active")}
    />
  )
}

export default function HabitsPage() {
  return (
    <>
      <PageHead label="Habits" title="Habits" hint="habit">
        Small promises, kept on a schedule you choose.
      </PageHead>
      <div className="h-8">
        <Suspense fallback={null}>
          <NewHabit />
        </Suspense>
      </div>
      <Suspense fallback={<Skeleton className="h-14" />}>
        <HabitsMetrics />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-40 max-w-3xl" />}>
        <HabitList />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-40" />}>
        <HabitsActivityMap />
      </Suspense>
    </>
  )
}
