import { daysBetween, type LocalDate } from "@/lib/dates"

import type { Task, TaskTab } from "./schemas"

/** Pure task rules (spec TK-3…TK-5, TK-8). */

/** TK-5: age in days at which a carried-over task asks "Still want to do this?". */
export const STALE_AFTER_DAYS = 5

/** How long finished tasks stay in the Done tab (TK-8). */
export const DONE_VISIBLE_DAYS = 30

/** TK-4: whole days since the task was created (or last kept). */
export const taskAge = (task: Pick<Task, "createdOn">, today: LocalDate) =>
  Math.max(0, daysBetween(task.createdOn, today))

/** TK-5: only open tasks on the today list go stale. */
export const isStale = (task: Task, today: LocalDate) =>
  task.doneOn === null &&
  task.list === "today" &&
  taskAge(task, today) >= STALE_AFTER_DAYS

/** TK-8: the Done tab hides tasks finished more than 30 days ago. */
export const isRecentlyDone = (task: Task, today: LocalDate) =>
  task.doneOn !== null && daysBetween(task.doneOn, today) <= DONE_VISIBLE_DAYS

export function inTab(task: Task, tab: TaskTab, today: LocalDate): boolean {
  if (tab === "done") return isRecentlyDone(task, today)
  // A task finished today stays on its list until tomorrow (room for "Add to log?").
  return (task.doneOn === null || task.doneOn === today) && task.list === tab
}

/**
 * TK-3: a `#slug` token links a goal and is removed from the title; an unknown slug stays as typed.
 * Returns the cleaned title and the slug that matched (the first one wins).
 */
export function parseQuickAdd(
  input: string,
  knownSlugs: ReadonlySet<string>
): { title: string; goalSlug: string | null } {
  let goalSlug: string | null = null
  const title = input
    .replace(/(^|\s)#([a-z0-9][a-z0-9-]*)(?=\s|$)/gi, (match, space, slug) => {
      const key = String(slug).toLowerCase()
      if (goalSlug === null && knownSlugs.has(key)) {
        goalSlug = key
        return space
      }
      return match
    })
    .replace(/\s+/g, " ")
    .trim()
  return { title, goalSlug }
}
