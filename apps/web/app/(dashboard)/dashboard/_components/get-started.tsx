import { IconCircle, IconCircleCheck } from "@tabler/icons-react"
import Link from "next/link"

import { GOALS_PATH, GUIDE_PATH } from "@/config/routes"
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
  const steps = [
    { label: "Create a habit", done: habits.length > 0 },
    { label: "Check it in", done: stats.treats > 0 },
    { label: "Add a task", done: hasTask },
  ]
  if (steps.every((step) => step.done)) return null
  return (
    <section
      aria-labelledby="get-started"
      className="flex max-w-3xl flex-col gap-4 border border-dashed p-5"
    >
      <h2
        id="get-started"
        className="font-mono text-sm font-medium tracking-wide uppercase"
      >
        Get started
      </h2>
      <ol className="flex flex-col gap-2">
        {steps.map((step) => (
          <li key={step.label} className="flex items-center gap-2">
            {step.done ? (
              <IconCircleCheck aria-hidden className="size-4 text-primary" />
            ) : (
              <IconCircle aria-hidden className="size-4 text-ink-3" />
            )}
            <span className={step.done ? "text-ink-3 line-through" : undefined}>
              {step.label}
              {step.done ? <span className="sr-only"> (done)</span> : null}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-ink-2">
        {goals.length === 0 ? (
          <>
            Want a bigger picture? Add a{" "}
            <Link href={GOALS_PATH} className={LINK}>
              goal
            </Link>{" "}
            later; it is optional.{" "}
          </>
        ) : null}
        New here? Read{" "}
        <Link href={GUIDE_PATH} className={LINK}>
          how Spark works
        </Link>
        .
      </p>
    </section>
  )
}
