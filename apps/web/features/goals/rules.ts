import type { HeatCell, HeatLevel } from "@/components/shared/heatmap"
import { dateRange, type LocalDate } from "@/lib/dates"

import type { Checkpoint, Goal } from "./schemas"

/** Pure goal rules (spec GL-3, GL-4, CP-2, CP-3). */

export const ACTIVE_LIMIT = 3

export const activeGoals = (goals: readonly Goal[]) =>
  goals.filter((goal) => goal.status === "active")

/** CP-2, CP-3: done / total, or `null` when there are no checkpoints (no percentage then). */
export function checkpointProgress(
  checkpoints: readonly Checkpoint[]
): { done: number; total: number; percent: number } | null {
  if (checkpoints.length === 0) return null
  const done = checkpoints.filter((c) => c.doneOn !== null).length
  return {
    done,
    total: checkpoints.length,
    percent: Math.round((done / checkpoints.length) * 100),
  }
}

/** GL-4: something has to be able to finish: a target date or a checkpoint. */
export const canMarkDone = (goal: Pick<Goal, "targetDate" | "checkpoints">) =>
  goal.targetDate !== null || goal.checkpoints.length > 0

/** GL-3: can another goal be made active? */
export const canActivate = (goals: readonly Goal[]) =>
  activeGoals(goals).length < ACTIVE_LIMIT

/** Lists on the Goals page (GL-2): archived goals are hidden everywhere (GL-5). */
export function groupGoals(goals: readonly Goal[]) {
  return {
    active: goals.filter((g) => g.status === "active"),
    someday: goals.filter((g) => g.status === "someday"),
    done: goals.filter((g) => g.status === "done"),
  }
}

/** MT-7 (goal day): activity count 0 -> 0, 1 -> 2, 2 -> 3, 3 or more -> 4. */
export const goalLevel = (count: number): HeatLevel =>
  count === 0 ? 0 : count === 1 ? 2 : count === 2 ? 3 : 4

/** Heatmap cells for a goal: one per day, from every activity of the goal . */
export function goalCells(
  dates: readonly LocalDate[],
  from: LocalDate,
  to: LocalDate,
  describe: (date: LocalDate, count: number) => string
): Partial<Record<LocalDate, HeatCell>> {
  const counts = new Map<LocalDate, number>()
  for (const date of dates) counts.set(date, (counts.get(date) ?? 0) + 1)
  const cells: Partial<Record<LocalDate, HeatCell>> = {}
  for (const date of dateRange(from, to)) {
    const count = counts.get(date) ?? 0
    cells[date] = { level: goalLevel(count), label: describe(date, count) }
  }
  return cells
}
