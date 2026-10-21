import "server-only"

import { authConfig } from "@/lib/auth/config"
import type { LocalDate } from "@/lib/dates"
import { ApiError } from "@/lib/errors"
import { apiFetch } from "@/lib/http"
import { createDataClient, DataError, unwrap } from "@/lib/supabase/data"

import {
  CheckpointSchema,
  GoalSchema,
  type Goal,
  type GoalForm,
  type GoalStatus,
} from "./schemas"

const GOAL_COLUMNS =
  "id, slug, name, why, becoming, target_date, if_hard_obstacle, if_hard_plan, status, checkpoints(id, goal_id, title, position, done_on)"

type CheckpointRow = {
  id: string
  goal_id: string
  title: string
  position: number
  done_on: string | null
}

type GoalRow = {
  id: string
  slug: string
  name: string
  why: string | null
  becoming: string | null
  target_date: string | null
  if_hard_obstacle: string | null
  if_hard_plan: string | null
  status: string
  checkpoints: CheckpointRow[]
}

function toGoal(row: GoalRow): Goal {
  return GoalSchema.parse({
    id: row.id,
    slug: row.slug,
    name: row.name,
    why: row.why,
    becoming: row.becoming,
    targetDate: row.target_date,
    ifHardObstacle: row.if_hard_obstacle,
    ifHardPlan: row.if_hard_plan,
    status: row.status,
    checkpoints: [...row.checkpoints]
      .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
      .map((c) =>
        CheckpointSchema.parse({
          id: c.id,
          goalId: c.goal_id,
          title: c.title,
          position: c.position,
          doneOn: c.done_on,
        })
      ),
  })
}

/** Every goal that is not archived (GL-5), with its checkpoints. Active first, then by creation. */
export async function fetchGoals(accessToken: string): Promise<Goal[]> {
  if (authConfig.AUTH_PROVIDER === "better-auth") {
    const raw = await apiFetch<unknown[]>("goals", { token: accessToken })
    return raw.map((g) => GoalSchema.parse(g))
  }

  const rows = unwrap(
    await createDataClient(accessToken)
      .from("goals")
      .select(GOAL_COLUMNS)
      .neq("status", "archived")
      .order("position")
      .order("created_at")
  )
  return rows.map(toGoal)
}

/** One goal, archived or not; `null` when it is not the caller's. */
export async function fetchGoal(
  accessToken: string,
  goalId: string
): Promise<Goal | null> {
  if (authConfig.AUTH_PROVIDER === "better-auth") {
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

  const { data, error } = await createDataClient(accessToken)
    .from("goals")
    .select(GOAL_COLUMNS)
    .eq("id", goalId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? toGoal(data) : null
}

/** GL-1, GL-3: a goal from a name; with 3 active goals it becomes someday. */
export async function createGoal(
  accessToken: string,
  name: string
): Promise<{ id: string; status: GoalStatus }> {
  if (authConfig.AUTH_PROVIDER === "better-auth") {
    return await apiFetch<{ id: string; status: GoalStatus }>("goals", {
      token: accessToken,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
  }

  const rows = unwrap(
    await createDataClient(accessToken).rpc("create_goal", { p_name: name })
  )
  const row = rows[0]
  if (!row) throw new DataError("PGRST116", "No goal returned")
  return { id: row.id, status: row.status as GoalStatus }
}

export async function updateGoal(
  accessToken: string,
  goalId: string,
  patch: Partial<GoalForm> & { status?: GoalStatus }
): Promise<void> {
  if (authConfig.AUTH_PROVIDER === "better-auth") {
    await apiFetch<void>(`goals/${goalId}`, {
      token: accessToken,
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
    return
  }

  unwrap(
    await createDataClient(accessToken)
      .from("goals")
      .update({
        name: patch.name,
        why: patch.why,
        becoming: patch.becoming,
        target_date: patch.targetDate,
        if_hard_obstacle: patch.ifHardObstacle,
        if_hard_plan: patch.ifHardPlan,
        status: patch.status,
      })
      .eq("id", goalId)
      .select("id")
      .single()
  )
}

export async function addCheckpoint(
  accessToken: string,
  input: { goalId: string; title: string; position: number }
): Promise<void> {
  if (authConfig.AUTH_PROVIDER === "better-auth") {
    await apiFetch<{ id: string }>(`goals/${input.goalId}/checkpoints`, {
      token: accessToken,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: input.title,
        position: input.position,
      }),
    })
    return
  }

  unwrap(
    await createDataClient(accessToken)
      .from("checkpoints")
      .insert({
        goal_id: input.goalId,
        title: input.title,
        position: input.position,
      })
      .select("id")
      .single()
  )
}

export async function renameCheckpoint(
  accessToken: string,
  checkpointId: string,
  title: string
): Promise<void> {
  if (authConfig.AUTH_PROVIDER === "better-auth") {
    await apiFetch<void>(`checkpoints/${checkpointId}`, {
      token: accessToken,
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    })
    return
  }

  unwrap(
    await createDataClient(accessToken)
      .from("checkpoints")
      .update({ title })
      .eq("id", checkpointId)
      .select("id")
      .single()
  )
}

export async function deleteCheckpoint(
  accessToken: string,
  checkpointId: string
): Promise<void> {
  if (authConfig.AUTH_PROVIDER === "better-auth") {
    await apiFetch<void>(`checkpoints/${checkpointId}`, {
      token: accessToken,
      method: "DELETE",
    })
    return
  }

  unwrap(
    await createDataClient(accessToken)
      .from("checkpoints")
      .delete()
      .eq("id", checkpointId)
      .select("id")
      .single()
  )
}

/** CP-3: the database stamps the local date; returns it, or null when cleared. */
export async function setCheckpointDone(
  accessToken: string,
  checkpointId: string,
  done: boolean
): Promise<LocalDate | null> {
  if (authConfig.AUTH_PROVIDER === "better-auth") {
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

  const { data, error } = await createDataClient(accessToken).rpc(
    "set_checkpoint_done",
    { p_checkpoint_id: checkpointId, p_done: done }
  )
  if (error) throw new DataError(error.code, error.message)
  return (data as LocalDate | null) ?? null
}

/** CP-4: swap with the neighbour above (-1) or below (1). */
export async function moveCheckpoint(
  accessToken: string,
  checkpointId: string,
  direction: -1 | 1
): Promise<void> {
  if (authConfig.AUTH_PROVIDER === "better-auth") {
    await apiFetch<void>(`checkpoints/${checkpointId}`, {
      token: accessToken,
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ move: direction }),
    })
    return
  }

  const { error } = await createDataClient(accessToken).rpc("move_checkpoint", {
    p_checkpoint_id: checkpointId,
    p_direction: direction,
  })
  if (error) throw new DataError(error.code, error.message)
}
