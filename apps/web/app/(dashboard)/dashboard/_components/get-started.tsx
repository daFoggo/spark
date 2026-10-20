import { IconCircle, IconCircleCheck } from "@tabler/icons-react"
import Link from "next/link"

import { Button } from "@workspace/ui/components/button"

import { GOALS_PATH, GUIDE_PATH } from "@/config/routes"
import { HabitDialog } from "@/features/habits/components/habit-dialog"
import { getTasks } from "@/features/tasks/queries"

import { loadDashboard } from "../../_components/dashboard-data"

const LINK = "underline underline-offset-4"

/**
 * First-run checklist on Today. It is derived from the user's data, so nothing is stored: it
 * shows until the first habit, check-in and task exist, then disappears for good.
 */
export async function GetStarted() {
  const { today, habits, stats, tasks, goals } = await loadDashboard()
  // Today's list is already loaded; look at the other lists only when it is empty.
  const hasTask =
    tasks.length > 0 ||
    (
      await Promise.all([getTasks("later", today), getTasks("done", today)])
    ).some((list) => list.length > 0)
  const activeGoals = goals.filter((goal) => goal.status === "active")
  const steps = [
    {
      label: "Set a goal",
      hint: "Who you want to become. A name is enough.",
      done: goals.length > 0,
      action: (
        <Button
          size="sm"
          nativeButton={false}
          render={<Link href={GOALS_PATH} />}
        >
          Set a goal
        </Button>
      ),
    },
    {
      label: "Create a habit",
      hint: "A small thing you repeat for that goal.",
      done: habits.length > 0,
      action: (
        <HabitDialog
          label="New habit"
          size="sm"
          variant={goals.length === 0 ? "outline" : "default"}
          goals={activeGoals}
        />
      ),
    },
    {
      label: "Tick it",
      hint: "Tap its checkbox under Habits when you have done it.",
      done: stats.treats > 0,
    },
    {
      label: "Add a task",
      hint: "Type in the Tasks box below. Add #goal to link it.",
      done: hasTask,
    },
  ]
  if (steps.every((step) => step.done)) return null
  return (
    <section
      aria-labelledby="get-started"
      className="flex max-w-3xl flex-col gap-3 border border-dashed p-4"
    >
      <h2
        id="get-started"
        className="font-mono text-sm font-medium tracking-wide uppercase"
      >
        Get started
      </h2>
      <ol className="flex flex-col gap-3">
        {steps.map((step) => (
          <li key={step.label} className="flex items-start gap-2">
            {step.done ? (
              <IconCircleCheck
                aria-hidden
                className="mt-0.5 size-4 text-primary"
              />
            ) : (
              <IconCircle aria-hidden className="mt-0.5 size-4 text-ink-3" />
            )}
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col">
                <span
                  className={step.done ? "text-ink-3 line-through" : undefined}
                >
                  {step.label}
                  {step.done ? <span className="sr-only"> (done)</span> : null}
                </span>
                {step.done ? null : (
                  <span className="text-xs text-ink-3">{step.hint}</span>
                )}
              </div>
              {step.done ? null : step.action}
            </div>
          </li>
        ))}
      </ol>
      <p className="text-ink-2">
        Goals are optional; a habit works on its own. New here? Read{" "}
        <Link href={GUIDE_PATH} className={LINK}>
          how Spark works
        </Link>
        .
      </p>
    </section>
  )
}
