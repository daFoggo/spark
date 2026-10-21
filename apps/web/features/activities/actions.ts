"use server"

import { updateTag } from "next/cache"

import { activitiesTag, checkinsTag } from "@/lib/cache-tags"
import { verifySession } from "@/lib/dal"
import { isLocalDate } from "@/lib/dates"
import { isExpectedApiError } from "@/lib/errors"

import { ActivityIdSchema, LogFormSchema } from "./schemas"
import { deleteActivity, insertLog } from "./server"

export type LogState = { error?: string; saved?: boolean }

/** AC-7, AC-5: a free log for `date` (today unless the caller sends a date within the 3-day window). */
export async function logActivityAction(
  today: string,
  _previous: LogState,
  formData: FormData
): Promise<LogState> {
  const { userId, accessToken } = await verifySession()
  if (!isLocalDate(today)) return { error: "Invalid date" }
  const parsed = LogFormSchema.safeParse({
    note: formData.get("note"),
    hours: formData.get("hours") ?? "",
    topic: formData.get("topic") ?? "",
    date: formData.get("date") || undefined,
    goalId: formData.get("goalId") || undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid log" }
  }
  const date = parsed.data.date ?? today
  if (!isLocalDate(date)) return { error: "Invalid date" }

  try {
    await insertLog(accessToken, { ...parsed.data, date })
  } catch (error) {
    if (isExpectedApiError(error)) {
      return { error: error.message.replace(/^[A-Z]{2}-\d+:\s*/, "") }
    }
    throw error
  }
  updateTag(activitiesTag(userId))
  return { saved: true }
}

/** AC-9: delete a log or check-in from the history. Counters and the pet follow. */
export async function deleteActivityAction(
  id: number
): Promise<{ error?: string }> {
  const { userId, accessToken } = await verifySession()
  const parsed = ActivityIdSchema.safeParse(id)
  if (!parsed.success) return { error: "Unknown entry" }
  await deleteActivity(accessToken, parsed.data)
  updateTag(activitiesTag(userId))
  updateTag(checkinsTag(userId))
  return {}
}
