import "server-only"

import type { LocalDate } from "@/lib/dates"
import { ApiError } from "@/lib/errors"
import { apiFetch } from "@/lib/http"

import {
  CheckInSchema,
  HabitSchema,
  type CheckIn,
  type CheckInLevel,
  type Habit,
  type HabitForm,
} from "./schemas"

/** Habits that are not archived (HB-6), oldest first. */
export async function fetchHabits(accessToken: string): Promise<Habit[]> {
  const raw = await apiFetch<unknown[]>("habits", { token: accessToken })
  return raw.map((h) => HabitSchema.parse(h))
}

/** One habit, archived or not; `null` when it is not the caller's or does not exist. */
export async function fetchHabit(
  accessToken: string,
  habitId: string
): Promise<Habit | null> {
  try {
    const raw = await apiFetch<unknown>(`habits/${habitId}`, {
      token: accessToken,
    })
    return HabitSchema.parse(raw)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

/** Check-ins between two local dates (inclusive), optionally for one habit. */
export async function fetchCheckIns(
  accessToken: string,
  range: { from: LocalDate; to: LocalDate; habitId?: string }
): Promise<CheckIn[]> {
  const params = new URLSearchParams({ from: range.from, to: range.to })
  if (range.habitId) params.set("habitId", range.habitId)
  const raw = await apiFetch<unknown[]>(`check-ins?${params.toString()}`, {
    token: accessToken,
  })
  return raw.map((c) => CheckInSchema.parse(c))
}

/** AC-3: returns the level after the tap, or `null` when it was undone. */
export async function toggleCheckIn(
  accessToken: string,
  input: { habitId: string; date: LocalDate; level: CheckInLevel }
): Promise<CheckInLevel | null> {
  const res = await apiFetch<{ level: CheckInLevel | null }>(
    `habits/${input.habitId}/check-ins/${input.date}`,
    {
      token: accessToken,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: input.level }),
    }
  )
  return res.level ?? null
}

export async function createHabit(
  accessToken: string,
  form: HabitForm
): Promise<string> {
  const schedule =
    form.kind === "days"
      ? { kind: "days", weekdays: form.weekdays }
      : { kind: "every", everyN: form.everyN }
  const res = await apiFetch<{ id: string }>("habits", {
    token: accessToken,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: form.name,
      cue: form.cue ?? null,
      fullVersion: form.fullVersion ?? null,
      minimumVersion: form.minimumVersion ?? null,
      timeOfDay: form.timeOfDay,
      goalId: form.goalId ?? null,
      schedule,
    }),
  })
  return res.id
}

/** HB-4: the schedule applies from today on; past check-ins are untouched. */
export async function setHabitSchedule(
  accessToken: string,
  habitId: string,
  form: Pick<HabitForm, "kind" | "weekdays" | "everyN">
): Promise<void> {
  const schedule =
    form.kind === "days"
      ? { kind: "days", weekdays: form.weekdays }
      : { kind: "every", everyN: form.everyN }
  await apiFetch<void>(`habits/${habitId}/schedule`, {
    token: accessToken,
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(schedule),
  })
}

export async function updateHabit(
  accessToken: string,
  habitId: string,
  patch: {
    name?: string
    cue?: string | null
    fullVersion?: string | null
    minimumVersion?: string | null
    timeOfDay?: string
    goalId?: string | null
    pausedFrom?: LocalDate | null
    pausedUntil?: LocalDate | null
    archivedAt?: string | null
  }
): Promise<void> {
  await apiFetch<void>(`habits/${habitId}`, {
    token: accessToken,
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: patch.name,
      cue: patch.cue,
      fullVersion: patch.fullVersion,
      minimumVersion: patch.minimumVersion,
      timeOfDay: patch.timeOfDay,
      goalId: patch.goalId,
      pausedFrom: patch.pausedFrom,
      pausedUntil: patch.pausedUntil,
      archived:
        patch.archivedAt !== undefined ? patch.archivedAt !== null : undefined,
    }),
  })
}

/** AC-8: a note on a check-in; an empty note clears it. */
export async function saveCheckInNote(
  accessToken: string,
  input: { habitId: string; date: LocalDate; note: string }
): Promise<void> {
  await apiFetch<void>(`habits/${input.habitId}/check-ins/${input.date}`, {
    token: accessToken,
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note: input.note || "" }),
  })
}
