import "server-only"

import { authConfig } from "@/lib/auth/config"
import type { LocalDate } from "@/lib/dates"
import { ApiError } from "@/lib/errors"
import { apiFetch } from "@/lib/http"
import { createDataClient, DataError, unwrap } from "@/lib/supabase/data"

import {
  CheckInSchema,
  HabitSchema,
  type CheckIn,
  type CheckInLevel,
  type Habit,
  type HabitForm,
  type ScheduleRow,
} from "./schemas"

const HABIT_COLUMNS =
  "id, goal_id, name, cue, full_version, minimum_version, time_of_day, starts_on, paused_from, paused_until, archived_at, habit_schedules(valid_from, kind, weekdays, every_n)"

type HabitRow = {
  id: string
  goal_id: string | null
  name: string
  cue: string | null
  full_version: string | null
  minimum_version: string | null
  time_of_day: string
  starts_on: string
  paused_from: string | null
  paused_until: string | null
  archived_at: string | null
  habit_schedules: {
    valid_from: string
    kind: string
    weekdays: number[] | null
    every_n: number | null
  }[]
}

function toHabit(row: HabitRow): Habit {
  const schedules = row.habit_schedules.map((s) =>
    s.kind === "days"
      ? { kind: "days", weekdays: s.weekdays ?? [], validFrom: s.valid_from }
      : { kind: "every", everyN: s.every_n ?? 2, validFrom: s.valid_from }
  ) as ScheduleRow[]
  return HabitSchema.parse({
    id: row.id,
    goalId: row.goal_id,
    name: row.name,
    cue: row.cue,
    fullVersion: row.full_version,
    minimumVersion: row.minimum_version,
    timeOfDay: row.time_of_day,
    startsOn: row.starts_on,
    pausedFrom: row.paused_from,
    pausedUntil: row.paused_until,
    archived: row.archived_at !== null,
    schedules,
  })
}

/** Habits that are not archived (HB-6), oldest first. */
export async function fetchHabits(accessToken: string): Promise<Habit[]> {
  if (authConfig.AUTH_PROVIDER === "better-auth") {
    const raw = await apiFetch<unknown[]>("habits", { token: accessToken })
    return raw.map((h) => HabitSchema.parse(h))
  }

  const rows = unwrap(
    await createDataClient(accessToken)
      .from("habits")
      .select(HABIT_COLUMNS)
      .is("archived_at", null)
      .order("position")
      .order("created_at")
  )
  return rows.map(toHabit)
}

/** One habit, archived or not; `null` when it is not the caller's (RLS) or does not exist. */
export async function fetchHabit(
  accessToken: string,
  habitId: string
): Promise<Habit | null> {
  if (authConfig.AUTH_PROVIDER === "better-auth") {
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

  const { data, error } = await createDataClient(accessToken)
    .from("habits")
    .select(HABIT_COLUMNS)
    .eq("id", habitId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? toHabit(data) : null
}

/** Check-ins between two local dates (inclusive), optionally for one habit. */
export async function fetchCheckIns(
  accessToken: string,
  range: { from: LocalDate; to: LocalDate; habitId?: string }
): Promise<CheckIn[]> {
  if (authConfig.AUTH_PROVIDER === "better-auth") {
    const params = new URLSearchParams({ from: range.from, to: range.to })
    if (range.habitId) params.set("habitId", range.habitId)
    const raw = await apiFetch<unknown[]>(`check-ins?${params.toString()}`, {
      token: accessToken,
    })
    return raw.map((c) => CheckInSchema.parse(c))
  }

  let query = createDataClient(accessToken)
    .from("activities")
    .select("id, habit_id, date, level, note")
    .eq("source", "habit")
    .gte("date", range.from)
    .lte("date", range.to)
    .order("date")
  if (range.habitId) query = query.eq("habit_id", range.habitId)
  return unwrap(await query).map((row) =>
    CheckInSchema.parse({
      id: row.id,
      habitId: row.habit_id,
      date: row.date,
      level: row.level,
      note: row.note,
    })
  )
}

// The generated RPC types treat every argument as required and non-null; the SQL functions accept null.
const orNull = (value: string | null) => value as string

/** AC-3: returns the level after the tap, or `null` when it was undone. */
export async function toggleCheckIn(
  accessToken: string,
  input: { habitId: string; date: LocalDate; level: CheckInLevel }
): Promise<CheckInLevel | null> {
  if (authConfig.AUTH_PROVIDER === "better-auth") {
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

  const { data, error } = await createDataClient(accessToken).rpc(
    "toggle_check_in",
    { p_habit_id: input.habitId, p_date: input.date, p_level: input.level }
  )
  if (error) {
    throw new DataError(error.code, error.message)
  }
  return (data as CheckInLevel | null) ?? null
}

export async function createHabit(
  accessToken: string,
  form: HabitForm
): Promise<string> {
  if (authConfig.AUTH_PROVIDER === "better-auth") {
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

  return unwrap(
    await createDataClient(accessToken).rpc("create_habit", {
      p_name: form.name,
      p_cue: orNull(form.cue),
      p_full: orNull(form.fullVersion),
      p_minimum: orNull(form.minimumVersion),
      p_time_of_day: form.timeOfDay,
      p_kind: form.kind,
      p_weekdays: form.kind === "days" ? form.weekdays : (null as never),
      p_every_n: form.kind === "every" ? form.everyN : (null as never),
      p_goal_id: form.goalId ?? undefined,
    })
  )
}

/** HB-4: the schedule applies from today on; past check-ins are untouched. */
export async function setHabitSchedule(
  accessToken: string,
  habitId: string,
  form: Pick<HabitForm, "kind" | "weekdays" | "everyN">
): Promise<void> {
  if (authConfig.AUTH_PROVIDER === "better-auth") {
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
    return
  }

  const { error } = await createDataClient(accessToken).rpc(
    "set_habit_schedule",
    {
      p_habit_id: habitId,
      p_kind: form.kind,
      p_weekdays: form.kind === "days" ? form.weekdays : (null as never),
      p_every_n: form.kind === "every" ? form.everyN : (null as never),
    }
  )
  if (error) {
    throw new DataError(error.code, error.message)
  }
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
  if (authConfig.AUTH_PROVIDER === "better-auth") {
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
    return
  }

  unwrap(
    await createDataClient(accessToken)
      .from("habits")
      .update({
        name: patch.name,
        cue: patch.cue,
        full_version: patch.fullVersion,
        minimum_version: patch.minimumVersion,
        time_of_day: patch.timeOfDay,
        goal_id: patch.goalId,
        paused_from: patch.pausedFrom,
        paused_until: patch.pausedUntil,
        archived_at: patch.archivedAt,
      })
      .eq("id", habitId)
      .select("id")
      .single()
  )
}

/** AC-8: a note on a check-in; an empty note clears it. */
export async function saveCheckInNote(
  accessToken: string,
  input: { habitId: string; date: LocalDate; note: string }
): Promise<void> {
  if (authConfig.AUTH_PROVIDER === "better-auth") {
    await apiFetch<void>(`habits/${input.habitId}/check-ins/${input.date}`, {
      token: accessToken,
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: input.note || "" }),
    })
    return
  }

  unwrap(
    await createDataClient(accessToken)
      .from("activities")
      .update({ note: input.note || null })
      .eq("habit_id", input.habitId)
      .eq("date", input.date)
      .eq("source", "habit")
      .select("id")
      .single()
  )
}
