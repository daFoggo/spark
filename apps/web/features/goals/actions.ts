"use server"

import { updateTag } from "next/cache"

import { goalTag, goalsTag } from "@/lib/cache-tags"
import { verifySession } from "@/lib/dal"
import { isExpectedDataError } from "@/lib/errors"

import {
  CheckpointMoveSchema,
  CheckpointPositionSchema,
  CheckpointTitleSchema,
  GOAL_STATUSES,
  GoalFormSchema,
  GoalIdSchema,
  NewGoalSchema,
  type GoalStatus,
} from "./schemas"
import {
  addCheckpoint,
  createGoal,
  deleteCheckpoint,
  moveCheckpoint,
  renameCheckpoint,
  setCheckpointDone,
  updateGoal,
} from "./server"

export type GoalState = {
  error?: string
  saved?: boolean
  goalId?: string
  /** GL-3: the new goal was created as someday because 3 goals are active. */
  someday?: boolean
}

/** Database rules (GL-3, GL-4…) carry their message after the rule ID. */
function expected(error: unknown): string | null {
  if (isExpectedDataError(error)) {
    return error.message.replace(/^[A-Z]{2}-\d+:\s*/, "")
  }
  return null
}

async function guarded<T>(
  work: () => Promise<T>
): Promise<{ value: T } | { error: string }> {
  try {
    return { value: await work() }
  } catch (error) {
    const message = expected(error)
    if (message) return { error: message }
    throw error
  }
}

/** GL-1, GL-3: create a goal from a name. */
export async function createGoalAction(
  _previous: GoalState,
  formData: FormData
): Promise<GoalState> {
  const { userId, accessToken } = await verifySession()
  const parsed = NewGoalSchema.safeParse({ name: formData.get("name") })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid goal" }
  }
  const result = await guarded(() => createGoal(accessToken, parsed.data.name))
  if ("error" in result) return result
  updateTag(goalsTag(userId))
  return {
    saved: true,
    goalId: result.value.id,
    someday: result.value.status === "someday",
  }
}

/** GL-1: edit the details. */
export async function updateGoalAction(
  goalId: string,
  _previous: GoalState,
  formData: FormData
): Promise<GoalState> {
  const { userId, accessToken } = await verifySession()
  if (!GoalIdSchema.safeParse(goalId).success) return { error: "Unknown goal" }
  const parsed = GoalFormSchema.safeParse({
    name: formData.get("name"),
    why: formData.get("why") ?? "",
    becoming: formData.get("becoming") ?? "",
    targetDate: formData.get("targetDate") ?? "",
    ifHardObstacle: formData.get("ifHardObstacle") ?? "",
    ifHardPlan: formData.get("ifHardPlan") ?? "",
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid goal" }
  }
  const result = await guarded(() =>
    updateGoal(accessToken, goalId, parsed.data)
  )
  if ("error" in result) return result
  updateTag(goalsTag(userId))
  updateTag(goalTag(goalId))
  return { saved: true, goalId }
}

/** GL-2…GL-5: change status. The database trigger enforces GL-3 and GL-4. */
export async function setGoalStatusAction(input: {
  goalId: string
  status: GoalStatus
}): Promise<GoalState> {
  const { userId, accessToken } = await verifySession()
  if (
    !GoalIdSchema.safeParse(input.goalId).success ||
    !GOAL_STATUSES.includes(input.status)
  ) {
    return { error: "Invalid request" }
  }
  const result = await guarded(() =>
    updateGoal(accessToken, input.goalId, { status: input.status })
  )
  if ("error" in result) return result
  updateTag(goalsTag(userId))
  updateTag(goalTag(input.goalId))
  return { saved: true }
}

/** CP-1: add a checkpoint at the end. */
export async function addCheckpointAction(input: {
  goalId: string
  title: string
  position: number
}): Promise<GoalState> {
  const { userId, accessToken } = await verifySession()
  const title = CheckpointTitleSchema.safeParse(input.title)
  const position = CheckpointPositionSchema.safeParse(input.position)
  if (
    !GoalIdSchema.safeParse(input.goalId).success ||
    !title.success ||
    !position.success
  ) {
    return { error: title.error?.issues[0]?.message ?? "Invalid checkpoint" }
  }
  const result = await guarded(() =>
    addCheckpoint(accessToken, {
      goalId: input.goalId,
      title: title.data,
      position: position.data,
    })
  )
  if ("error" in result) return result
  updateTag(goalsTag(userId))
  updateTag(goalTag(input.goalId))
  return { saved: true }
}

/** CP-3: toggle done. CP-4: never completed automatically. */
export async function toggleCheckpointAction(input: {
  goalId: string
  checkpointId: string
  done: boolean
}): Promise<GoalState> {
  const { userId, accessToken } = await verifySession()
  if (
    !GoalIdSchema.safeParse(input.goalId).success ||
    !GoalIdSchema.safeParse(input.checkpointId).success
  ) {
    return { error: "Invalid request" }
  }
  const result = await guarded(() =>
    setCheckpointDone(accessToken, input.checkpointId, input.done)
  )
  if ("error" in result) return result
  updateTag(goalsTag(userId))
  updateTag(goalTag(input.goalId))
  return { saved: true }
}

/** CP-4: rename, move or delete a checkpoint. */
export async function editCheckpointAction(input: {
  goalId: string
  checkpointId: string
  change: { rename: string } | { move: -1 | 1 } | { remove: true }
}): Promise<GoalState> {
  const { userId, accessToken } = await verifySession()
  if (
    !GoalIdSchema.safeParse(input.goalId).success ||
    !GoalIdSchema.safeParse(input.checkpointId).success
  ) {
    return { error: "Invalid request" }
  }
  const { change } = input
  let result
  if ("rename" in change) {
    const title = CheckpointTitleSchema.safeParse(change.rename)
    if (!title.success) {
      return { error: title.error.issues[0]?.message ?? "Invalid title" }
    }
    result = await guarded(() =>
      renameCheckpoint(accessToken, input.checkpointId, title.data)
    )
  } else if ("move" in change) {
    const move = CheckpointMoveSchema.safeParse(change.move)
    if (!move.success) return { error: "Invalid request" }
    result = await guarded(() =>
      moveCheckpoint(accessToken, input.checkpointId, move.data)
    )
  } else {
    result = await guarded(() =>
      deleteCheckpoint(accessToken, input.checkpointId)
    )
  }
  if ("error" in result) return result
  updateTag(goalsTag(userId))
  updateTag(goalTag(input.goalId))
  return { saved: true }
}
