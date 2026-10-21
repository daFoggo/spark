"use server"

import { updateTag } from "next/cache"
import { z } from "zod"

import { checkinsTag, activitiesTag, habitsTag } from "@/lib/cache-tags"
import { verifySession } from "@/lib/dal"
import { addDays, isLocalDate } from "@/lib/dates"
import { isExpectedApiError } from "@/lib/errors"
import { DataError } from "@/lib/supabase/data"

import {
  CheckInInputSchema,
  HabitFormSchema,
  NoteInputSchema,
  type CheckInLevel,
} from "./schemas"
import {
  createHabit,
  saveCheckInNote,
  setHabitSchedule,
  toggleCheckIn,
  updateHabit,
} from "./server"

export type ActionState = { error?: string; saved?: boolean; habitId?: string }

const fail = (message: string): ActionState => ({ error: message })

/** Rule violations raised by the database carry the rule ID ("AC-5: only the last 3 days…"). */
function expected(error: unknown): string | null {
  if (isExpectedApiError(error)) {
    return error.message.replace(/^[A-Z]{2}-\d+:\s*/, "")
  }
  if (error instanceof DataError && error.expected) {
    return error.message.replace(/^[A-Z]{2}-\d+:\s*/, "")
  }
  return null
}

/** AC-3, AC-5, AC-6: tap full / minimum. Returns the level after the tap, `null` when undone. */
export async function checkInAction(input: {
  habitId: string
  date: string
  level: CheckInLevel
}): Promise<{ error: string } | { level: CheckInLevel | null }> {
  const { userId, accessToken } = await verifySession()
  const parsed = CheckInInputSchema.safeParse(input)
  if (!parsed.success || !isLocalDate(parsed.data.date)) {
    return { error: "Invalid check-in" }
  }
  try {
    const level = await toggleCheckIn(accessToken, parsed.data)
    updateTag(checkinsTag(userId))
    updateTag(activitiesTag(userId))
    return { level }
  } catch (error) {
    const message = expected(error)
    if (message) return { error: message }
    throw error
  }
}

/** AC-8: add or clear the note of a check-in. */
export async function checkInNoteAction(input: {
  habitId: string
  date: string
  note: string
}): Promise<ActionState> {
  const { userId, accessToken } = await verifySession()
  const parsed = NoteInputSchema.safeParse(input)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid note")
  }
  try {
    await saveCheckInNote(accessToken, parsed.data)
  } catch (error) {
    const message = expected(error)
    if (message) return fail(message)
    throw error
  }
  updateTag(checkinsTag(userId))
  return { saved: true }
}

function readForm(formData: FormData) {
  return HabitFormSchema.safeParse({
    name: formData.get("name"),
    cue: formData.get("cue") ?? "",
    fullVersion: formData.get("fullVersion") ?? "",
    minimumVersion: formData.get("minimumVersion") ?? "",
    timeOfDay: formData.get("timeOfDay"),
    goalId: formData.get("goalId") || null,
    kind: formData.get("kind"),
    weekdays: formData.getAll("weekdays"),
    everyN: formData.get("everyN") ?? 2,
  })
}

/** HB-1, HB-2: create a habit with its first schedule. */
export async function createHabitAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { userId, accessToken } = await verifySession()
  const parsed = readForm(formData)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid habit")
  }
  try {
    const habitId = await createHabit(accessToken, parsed.data)
    updateTag(habitsTag(userId))
    return { saved: true, habitId }
  } catch (error) {
    const message = expected(error)
    if (message) return fail(message)
    throw error
  }
}

const HabitIdSchema = z.string().uuid()

/** HB-4: text fields change in place; a changed schedule applies from today on. */
export async function updateHabitAction(
  habitId: string,
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { userId, accessToken } = await verifySession()
  if (!HabitIdSchema.safeParse(habitId).success) return fail("Unknown habit")
  const parsed = readForm(formData)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid habit")
  }
  try {
    await updateHabit(accessToken, habitId, {
      name: parsed.data.name,
      cue: parsed.data.cue,
      fullVersion: parsed.data.fullVersion,
      minimumVersion: parsed.data.minimumVersion,
      timeOfDay: parsed.data.timeOfDay,
      goalId: parsed.data.goalId,
    })
    await setHabitSchedule(accessToken, habitId, parsed.data)
  } catch (error) {
    const message = expected(error)
    if (message) return fail(message)
    throw error
  }
  updateTag(habitsTag(userId))
  return { saved: true, habitId }
}

/** HB-5: pause from `from` (a local date, default today by the caller) until `until`, or until resumed. */
export async function pauseHabitAction(input: {
  habitId: string
  from: string
  until: string | null
}): Promise<ActionState> {
  const { userId, accessToken } = await verifySession()
  if (
    !HabitIdSchema.safeParse(input.habitId).success ||
    !isLocalDate(input.from) ||
    (input.until !== null &&
      (!isLocalDate(input.until) || input.until < input.from))
  ) {
    return fail("Invalid pause")
  }
  await updateHabit(accessToken, input.habitId, {
    pausedFrom: input.from,
    pausedUntil: input.until,
  })
  updateTag(habitsTag(userId))
  return { saved: true }
}

/** HB-5: resume. Days paused so far stay "not scheduled"; the pause ends yesterday. */
export async function resumeHabitAction(input: {
  habitId: string
  today: string
}): Promise<ActionState> {
  const { userId, accessToken } = await verifySession()
  if (
    !HabitIdSchema.safeParse(input.habitId).success ||
    !isLocalDate(input.today)
  ) {
    return fail("Invalid request")
  }
  await updateHabit(accessToken, input.habitId, {
    pausedUntil: addDays(input.today, -1),
  })
  updateTag(habitsTag(userId))
  return { saved: true }
}

/** HB-6: archived habits leave Today and the lists; their check-ins stay. */
export async function archiveHabitAction(
  habitId: string
): Promise<ActionState> {
  const { userId, accessToken } = await verifySession()
  if (!HabitIdSchema.safeParse(habitId).success) return fail("Unknown habit")
  await updateHabit(accessToken, habitId, {
    archivedAt: new Date().toISOString(),
  })
  updateTag(habitsTag(userId))
  return { saved: true }
}
