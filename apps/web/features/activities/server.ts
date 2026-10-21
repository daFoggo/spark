import "server-only"

import type { LocalDate } from "@/lib/dates"
import { apiFetch } from "@/lib/http"

import { ActivitySchema, type Activity, type ActivityStats } from "./schemas"

/**
 * Treats since adoption, the newest activity date and today's count (PT-2, PT-4, "Done today").
 */
export async function fetchActivityStats(
  accessToken: string,
  input: { adoptedOn: LocalDate; today: LocalDate }
): Promise<ActivityStats> {
  return await apiFetch<ActivityStats>(
    `activities/stats?adoptedOn=${input.adoptedOn}&today=${input.today}`,
    { token: accessToken }
  )
}

/** Activities per day for the overall heatmap (MT-7) and timelines. */
export async function fetchActivities(
  accessToken: string,
  range: { from: LocalDate; to: LocalDate; source?: Activity["source"] }
): Promise<Activity[]> {
  const params = new URLSearchParams({ from: range.from, to: range.to })
  if (range.source) params.set("source", range.source)
  const raw = await apiFetch<unknown[]>(`activities?${params.toString()}`, {
    token: accessToken,
  })
  return raw.map((a) => ActivitySchema.parse(a))
}

export async function insertLog(
  accessToken: string,
  input: {
    date: LocalDate
    note: string
    hours: number | null
    topic: string | null
    goalId?: string
  }
): Promise<void> {
  await apiFetch<{ id: number }>("activities/logs", {
    token: accessToken,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      date: input.date,
      note: input.note,
      hours: input.hours,
      topic: input.topic,
      goalId: input.goalId ?? null,
    }),
  })
}

/** AC-9: the user's own history; a hard delete. */
export async function deleteActivity(
  accessToken: string,
  id: number
): Promise<void> {
  await apiFetch<void>(`activities/${id}`, {
    token: accessToken,
    method: "DELETE",
  })
}

/**
 * A goal's activity: everything since `from` for the heatmap and timeline, plus how many things
 * the goal has in all.
 */
export async function fetchGoalActivity(
  accessToken: string,
  input: { goalId: string; from: LocalDate }
): Promise<{ recent: Activity[]; total: number }> {
  const res = await apiFetch<{ recent: unknown[]; total: number }>(
    `goals/${input.goalId}/activity?from=${input.from}`,
    { token: accessToken }
  )
  return {
    recent: res.recent.map((a) => ActivitySchema.parse(a)),
    total: res.total,
  }
}
