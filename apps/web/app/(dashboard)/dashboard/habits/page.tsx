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
import { HabitDialog } from "@/features/habits/components/habit-dialog"
import { getGoals } from "@/features/goals/queries"
import { getCheckIns, getHabits } from "@/features/habits/queries"
import { groupByHabit, habitRowData } from "@/features/habits/rows"
import {
  consistency,
  indexByDate,
  scheduleLabel,
} from "@/features/habits/stats"
import { getSettings } from "@/features/settings/queries"
import { getToday } from "@/lib/clock"
import { requirePermission } from "@/lib/dal"
import { addDays } from "@/lib/dates"

export const metadata: Metadata = { title: "Habits" }

async function HabitList() {
  await requirePermission("dashboard:view")
  const goalsPromise = getGoals()
  const settings = await getSettings()
  const today = await getToday(settings.timezone)
  const [habits, checkIns, goals] = await Promise.all([
    getHabits(),
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
  return (
    <ItemGroup className="max-w-3xl gap-2">
      {habits.map((habit) => {
        const mine = grouped.get(habit.id) ?? []
        const row = habitRowData(habit, mine, today)
        const rate = consistency(habit, indexByDate(mine), today)
        return (
          <Item
            key={habit.id}
            variant="outline"
            size="sm"
            render={<Link href={`/dashboard/habits/${habit.id}`} />}
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
      <PageHead label="Habits" title="Habits">
        Small promises, kept on a schedule you choose.
      </PageHead>
      <div className="h-8">
        <Suspense fallback={null}>
          <NewHabit />
        </Suspense>
      </div>
      <Suspense fallback={<Skeleton className="h-40 max-w-3xl" />}>
        <HabitList />
      </Suspense>
    </>
  )
}
