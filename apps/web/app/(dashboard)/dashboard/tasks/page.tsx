import type { Metadata } from "next"
import { Suspense } from "react"

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { ItemGroup } from "@workspace/ui/components/item"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { PageHead } from "@/components/layout/page-head"
import { getGoals } from "@/features/goals/queries"
import { getSettings } from "@/features/settings/queries"
import { TaskAdd } from "@/features/tasks/components/task-add"
import { TaskRow } from "@/features/tasks/components/task-row"
import { TaskTabs } from "@/features/tasks/components/task-tabs"
import { getTasks } from "@/features/tasks/queries"
import { taskRowData } from "@/features/tasks/rows"
import { TASK_TABS, type TaskTab } from "@/features/tasks/schemas"
import { getToday } from "@/lib/clock"
import { requirePermission } from "@/lib/dal"

export const metadata: Metadata = { title: "Tasks" }

const EMPTY: Record<TaskTab, { title: string; description: string }> = {
  today: {
    title: "Nothing on your list",
    description: "Add what you want to get done today.",
  },
  later: {
    title: "Nothing waiting",
    description: "Tasks you are not ready for yet wait here, without a date.",
  },
  done: {
    title: "Nothing finished yet",
    description: "Finished tasks stay here for 30 days.",
  },
}

const asTab = (value: string | undefined): TaskTab =>
  TASK_TABS.find((tab) => tab === value) ?? "today"

async function TaskList({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  await requirePermission("dashboard:view")
  const goalsPromise = getGoals()
  const tab = asTab((await searchParams).tab)
  const settings = await getSettings()
  const today = await getToday(settings.timezone)
  const [tasks, goals] = await Promise.all([getTasks(tab, today), goalsPromise])
  const goalNames = new Map(goals.map((goal) => [goal.id, goal.name]))

  return (
    <>
      <TaskTabs value={tab} />
      {tab === "done" ? null : (
        <TaskAdd
          list={tab}
          goals={goals}
          placeholder={
            tab === "today" ? "Add a task for today" : "Add a task for later"
          }
        />
      )}
      {tasks.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyTitle>{EMPTY[tab].title}</EmptyTitle>
            <EmptyDescription>{EMPTY[tab].description}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ItemGroup className="max-w-3xl gap-2">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={taskRowData(task, today, goalNames)}
              today={today}
            />
          ))}
        </ItemGroup>
      )}
    </>
  )
}

export default function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  return (
    <>
      <PageHead label="Tasks" title="Tasks">
        Things to get done, written as they come. No dates, no pressure.
      </PageHead>
      <Suspense fallback={<Skeleton className="h-64 max-w-3xl" />}>
        <TaskList searchParams={searchParams} />
      </Suspense>
    </>
  )
}
