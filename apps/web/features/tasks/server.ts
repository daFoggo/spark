import "server-only"

import type { LocalDate } from "@/lib/dates"
import { apiFetch } from "@/lib/http"

import { TaskSchema, type Task, type TaskList, type TaskTab } from "./schemas"

/** Tasks of one tab: open ones oldest first, then those finished today; the Done tab lists finished ones newest first (TK-8). */
export async function fetchTasks(
  accessToken: string,
  input: { tab: TaskTab; today: LocalDate }
): Promise<Task[]> {
  const raw = await apiFetch<unknown[]>(
    `tasks?tab=${input.tab}&today=${input.today}`,
    { token: accessToken }
  )
  return raw.map((t) => TaskSchema.parse(t))
}

export async function insertTask(
  accessToken: string,
  input: { title: string; list: TaskList; goalId: string | null }
): Promise<void> {
  await apiFetch<void>("tasks", {
    token: accessToken,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
}

/** TK-6, TK-7: the backend stamps today's local date; returns it, or null when un-completed. */
export async function setTaskDone(
  accessToken: string,
  taskId: string,
  done: boolean
): Promise<LocalDate | null> {
  const res = await apiFetch<{ doneOn: LocalDate | null }>(
    `tasks/${taskId}/done`,
    {
      token: accessToken,
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done }),
    }
  )
  return res.doneOn ?? null
}

/** TK-6: adds a completed, goal-linked task to the log. Returns the activity id. */
export async function logTask(
  accessToken: string,
  taskId: string
): Promise<number> {
  const res = await apiFetch<{ activityId: number }>(`tasks/${taskId}/log`, {
    token: accessToken,
    method: "POST",
  })
  return res.activityId
}

export async function updateTask(
  accessToken: string,
  taskId: string,
  patch: {
    note?: string | null
    list?: TaskList
    createdOn?: LocalDate
    focusFrom?: LocalDate | null
  }
): Promise<void> {
  await apiFetch<void>(`tasks/${taskId}`, {
    token: accessToken,
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  })
}

export async function deleteTask(
  accessToken: string,
  taskId: string
): Promise<void> {
  await apiFetch<void>(`tasks/${taskId}`, {
    token: accessToken,
    method: "DELETE",
  })
}
