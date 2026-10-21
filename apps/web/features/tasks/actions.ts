"use server"

import { updateTag } from "next/cache"

import { activitiesTag, tasksTag } from "@/lib/cache-tags"
import { verifySession } from "@/lib/dal"
import { isLocalDate } from "@/lib/dates"
import { isExpectedApiError } from "@/lib/errors"
import { DataError } from "@/lib/supabase/data"

import { AddTaskSchema, TaskIdSchema, TaskNoteSchema } from "./schemas"
import {
  deleteTask,
  insertTask,
  logTask,
  setTaskDone,
  updateTask,
} from "./server"

export type TaskState = { error?: string; saved?: boolean }

function expected(error: unknown): string | null {
  if (isExpectedApiError(error)) {
    return error.message.replace(/^[A-Z]{2}-\d+:\s*/, "")
  }
  if (error instanceof DataError && error.expected) {
    return error.message.replace(/^[A-Z]{2}-\d+:\s*/, "")
  }
  return null
}

/** TK-1, TK-3: add a task. The `#slug` was already parsed into `goalId`; the database checks the goal is yours. */
export async function addTaskAction(input: {
  title: string
  list: "today" | "later"
  goalId: string | null
}): Promise<TaskState> {
  const { userId, accessToken } = await verifySession()
  const parsed = AddTaskSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid task" }
  }
  try {
    await insertTask(accessToken, parsed.data)
  } catch (error) {
    const message = expected(error)
    if (message) return { error: message }
    throw error
  }
  updateTag(tasksTag(userId))
  return { saved: true }
}

/** TK-6, TK-7: complete or un-complete. */
export async function toggleTaskAction(input: {
  taskId: string
  done: boolean
}): Promise<{ error: string } | { doneOn: string | null }> {
  const { userId, accessToken } = await verifySession()
  if (!TaskIdSchema.safeParse(input.taskId).success) {
    return { error: "Unknown task" }
  }
  try {
    const doneOn = await setTaskDone(accessToken, input.taskId, input.done)
    updateTag(tasksTag(userId))
    return { doneOn }
  } catch (error) {
    const message = expected(error)
    if (message) return { error: message }
    throw error
  }
}

/** TK-6: "Add to log?" accepted. */
export async function logTaskAction(taskId: string): Promise<TaskState> {
  const { userId, accessToken } = await verifySession()
  if (!TaskIdSchema.safeParse(taskId).success) return { error: "Unknown task" }
  try {
    await logTask(accessToken, taskId)
  } catch (error) {
    const message = expected(error)
    if (message) return { error: message }
    throw error
  }
  updateTag(activitiesTag(userId))
  updateTag(tasksTag(userId))
  return { saved: true }
}

/** TK-5: Keep resets the age; Later moves it to the later list; "today" brings it back (age resets too). */
export async function moveTaskAction(input: {
  taskId: string
  to: "keep" | "later" | "today"
  today: string
}): Promise<TaskState> {
  const { userId, accessToken } = await verifySession()
  if (
    !TaskIdSchema.safeParse(input.taskId).success ||
    !isLocalDate(input.today)
  ) {
    return { error: "Invalid request" }
  }
  await updateTask(
    accessToken,
    input.taskId,
    // Moving a task by hand also ends any review focus on it (RV-4).
    input.to === "later"
      ? { list: "later", focusFrom: null }
      : { list: "today", createdOn: input.today, focusFrom: null }
  )
  updateTag(tasksTag(userId))
  return { saved: true }
}

/** TK-5: Drop deletes the task. */
export async function dropTaskAction(taskId: string): Promise<TaskState> {
  const { userId, accessToken } = await verifySession()
  if (!TaskIdSchema.safeParse(taskId).success) return { error: "Unknown task" }
  await deleteTask(accessToken, taskId)
  updateTag(tasksTag(userId))
  return { saved: true }
}

export async function saveTaskNoteAction(input: {
  taskId: string
  note: string
}): Promise<TaskState> {
  const { userId, accessToken } = await verifySession()
  const parsed = TaskNoteSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid note" }
  }
  await updateTask(accessToken, parsed.data.taskId, {
    note: parsed.data.note || null,
  })
  updateTag(tasksTag(userId))
  return { saved: true }
}
