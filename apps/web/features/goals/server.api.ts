import "server-only"

import type { LocalDate } from "@/lib/dates"
import { ApiError } from "@/lib/errors"
import { apiFetch } from "@/lib/http"

import {
  GoalSchema,
  type Goal,
  type GoalForm,
  type GoalStatus,
} from "./schemas"

/** Every goal that is not archived (GL-5), with its checkpoints. Active first, then by creation. */
export async function fetchGoals(accessToken: string): Promise<Goal[]> {
  const raw = await apiFetch<unknown[]>("goals", { token: accessToken })
  return raw.map((g) => GoalSchema.parse(g))
}

/** One goal, archived or not; `null` when it is not the caller's. */
export async function fetchGoal(
  accessToken: string,
  goalId: string
): Promise<Goal | null> {
  try {
    const raw = await apiFetch<unknown>(`goals/${goalId}`, {
      token: accessToken,
    })
    return GoalSchema.parse(raw)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

/** GL-1, GL-3: a goal from a name; with 3 active goals it becomes someday. */
export async function createGoal(
  accessToken: string,
  name: string
): Promise<{ id: string; status: GoalStatus }> {
  return await apiFetch<{ id: string; status: GoalStatus }>("goals", {
    token: accessToken,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  })
}

export async function updateGoal(
  accessToken: string,
  goalId: string,
  patch: Partial<GoalForm> & { status?: GoalStatus }
): Promise<void> {
  await apiFetch<void>(`goals/${goalId}`, {
    token: accessToken,
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  })
}

export async function addCheckpoint(
  accessToken: string,
  input: { goalId: string; title: string; position: number }
): Promise<void> {
  await apiFetch<{ id: string }>(`goals/${input.goalId}/checkpoints`, {
    token: accessToken,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: input.title,
      position: input.position,
    }),
  })
}

export async function renameCheckpoint(
  accessToken: string,
  checkpointId: string,
  title: string
): Promise<void> {
  await apiFetch<void>(`checkpoints/${checkpointId}`, {
    token: accessToken,
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  })
}

export async function deleteCheckpoint(
  accessToken: string,
  checkpointId: string
): Promise<void> {
  await apiFetch<void>(`checkpoints/${checkpointId}`, {
    token: accessToken,
    method: "DELETE",
  })
}

/** CP-3: the database stamps the local date; returns it, or null when cleared. */
export async function setCheckpointDone(
  accessToken: string,
  checkpointId: string,
  done: boolean
): Promise<LocalDate | null> {
  const res = await apiFetch<{ doneOn: LocalDate | null }>(
    `checkpoints/${checkpointId}/done`,
    {
      token: accessToken,
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done }),
    }
  )
  return res.doneOn ?? null
}

/** CP-4: swap with the neighbour above (-1) or below (1). */
export async function moveCheckpoint(
  accessToken: string,
  checkpointId: string,
  direction: -1 | 1
): Promise<void> {
  await apiFetch<void>(`checkpoints/${checkpointId}`, {
    token: accessToken,
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ move: direction }),
  })
}
