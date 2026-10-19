import type { LocalDate } from "@/lib/dates"

import type { TaskRowData } from "./components/task-row"
import { isStale, taskAge } from "./rules"
import type { Task } from "./schemas"

/** Everything a task row needs, computed from the task and today's date (pure). */
export function taskRowData(
  task: Task,
  today: LocalDate,
  goalNames: ReadonlyMap<string, string> = new Map()
): TaskRowData {
  return {
    id: task.id,
    title: task.title,
    note: task.note,
    goalId: task.goalId,
    goalName: task.goalId ? (goalNames.get(task.goalId) ?? null) : null,
    done: task.doneOn !== null,
    list: task.list,
    age: taskAge(task, today),
    stale: isStale(task, today),
  }
}
