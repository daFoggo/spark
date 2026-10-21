import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"

import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@workspace/ui/components/item"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { PageHead } from "@/components/layout/page-head"
import { getActivities } from "@/features/activities/queries"
import { GoalBoard } from "@/features/goals/components/goal-board"
import { GoalNew } from "@/features/goals/components/goal-new"
import { getGoals } from "@/features/goals/queries"
import {
  ACTIVE_LIMIT,
  checkpointProgress,
  groupGoals,
} from "@/features/goals/rules"
import type { Goal } from "@/features/goals/schemas"
import { getSettings } from "@/features/settings/queries"
import { getToday } from "@/lib/clock"
import { requirePermission } from "@/lib/dal"
import { addDays } from "@/lib/dates"

export const metadata: Metadata = { title: "Goals" }

function GoalGroup({
  title,
  count,
  goals,
  logged,
  empty,
}: {
  title: string
  count?: string
  goals: Goal[]
  logged: Map<string, number>
  empty?: string
}) {
  return (
    <section className="flex max-w-3xl flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-mono text-sm font-medium tracking-wide uppercase">
          {title}
        </h2>
        {count ? (
          <span className="font-mono text-xs text-ink-3">{count}</span>
        ) : null}
      </div>
      {goals.length === 0 ? (
        empty ? (
          <p className="text-ink-2">{empty}</p>
        ) : null
      ) : (
        <ItemGroup className="gap-2">
          {goals.map((goal) => {
            const progress = checkpointProgress(goal.checkpoints)
            return (
              <Item
                key={goal.id}
                variant="outline"
                size="sm"
                render={<Link href={`/dashboard/goals/${goal.id}`} prefetch />}
              >
                <ItemContent>
                  <ItemTitle>{goal.name}</ItemTitle>
                  <ItemDescription>
                    {logged.get(goal.id) ?? 0} logged
                    {progress
                      ? ` · ${progress.done}/${progress.total} checkpoints`
                      : ""}
                    {goal.targetDate ? ` · by ${goal.targetDate}` : ""}
                  </ItemDescription>
                </ItemContent>
              </Item>
            )
          })}
        </ItemGroup>
      )}
    </section>
  )
}

async function GoalLists() {
  await requirePermission("dashboard:view")
  const goalsPromise = getGoals()
  const settings = await getSettings()
  const today = await getToday(settings.timezone)
  const [goals, activities] = await Promise.all([
    goalsPromise,
    getActivities(addDays(today, -182), today),
  ])
  const logged = new Map<string, number>()
  for (const activity of activities) {
    if (activity.goalId) {
      logged.set(activity.goalId, (logged.get(activity.goalId) ?? 0) + 1)
    }
  }
  const groups = groupGoals(goals)

  const board = [...groups.active, ...groups.someday].map((goal) => {
    const progress = checkpointProgress(goal.checkpoints)
    return {
      id: goal.id,
      name: goal.name,
      status:
        goal.status === "active" ? ("active" as const) : ("someday" as const),
      detail: [
        `${logged.get(goal.id) ?? 0} logged`,
        progress ? `${progress.done}/${progress.total} checkpoints` : "",
        goal.targetDate ? `by ${goal.targetDate}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
    }
  })

  return (
    <>
      <GoalNew />
      <GoalBoard goals={board} activeLimit={ACTIVE_LIMIT} />
      {groups.done.length > 0 ? (
        <GoalGroup title="Done" goals={groups.done} logged={logged} />
      ) : null}
    </>
  )
}

export default function GoalsPage() {
  return (
    <>
      <PageHead label="Where you're headed" title="Goals" hint="goal">
        A name is enough to start. Keep three or fewer active.
      </PageHead>
      <Suspense fallback={<Skeleton className="h-64 max-w-3xl" />}>
        <GoalLists />
      </Suspense>
    </>
  )
}
