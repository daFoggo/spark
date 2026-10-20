import "server-only"

import { createDataClient, unwrap } from "@/lib/supabase/data"
import type { LocalDate } from "@/lib/dates"

import { ActivitySchema, type Activity, type ActivityStats } from "./schemas"

const COLUMNS = "id, date, source, habit_id, goal_id, note, hours, topic"

/**
 * Treats since adoption, the newest activity date and today's count, in three cheap head/limit queries
 * (PT-2, PT-4, "Done today").
 */
export async function fetchActivityStats(
  accessToken: string,
  input: { adoptedOn: LocalDate; today: LocalDate }
): Promise<ActivityStats> {
  const client = createDataClient(accessToken)
  const [treats, today, latest] = await Promise.all([
    client
      .from("activities")
      .select("id", { count: "exact", head: true })
      .gte("date", input.adoptedOn),
    client
      .from("activities")
      .select("id", { count: "exact", head: true })
      .eq("date", input.today),
    client
      .from("activities")
      .select("date")
      .order("date", { ascending: false })
      .limit(1),
  ])
  for (const result of [treats, today, latest]) {
    if (result.error) throw new Error(`activities: ${result.error.message}`)
  }
  return {
    treats: treats.count ?? 0,
    doneToday: today.count ?? 0,
    lastActivity: latest.data?.[0]?.date ?? null,
  }
}

type ActivityRow = {
  id: number
  date: string
  source: string
  habit_id: string | null
  goal_id: string | null
  note: string | null
  hours: number | null
  topic: string | null
}

const toActivity = (row: ActivityRow): Activity =>
  ActivitySchema.parse({
    id: row.id,
    date: row.date,
    source: row.source,
    habitId: row.habit_id,
    goalId: row.goal_id,
    note: row.note,
    hours: row.hours,
    topic: row.topic,
  })

/** Activities per day for the overall heatmap (MT-7) and timelines. */
export async function fetchActivities(
  accessToken: string,
  range: { from: LocalDate; to: LocalDate; source?: Activity["source"] }
): Promise<Activity[]> {
  let query = createDataClient(accessToken)
    .from("activities")
    .select(COLUMNS)
    .gte("date", range.from)
    .lte("date", range.to)
    .order("date", { ascending: false })
    .order("id", { ascending: false })
  if (range.source) query = query.eq("source", range.source)
  return unwrap(await query).map(toActivity)
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
  unwrap(
    await createDataClient(accessToken)
      .from("activities")
      .insert({
        date: input.date,
        source: "log",
        goal_id: input.goalId,
        note: input.note,
        hours: input.hours,
        topic: input.topic,
      })
      .select("id")
      .single()
  )
}

/** AC-9: the user's own history; a hard delete. */
export async function deleteActivity(
  accessToken: string,
  id: number
): Promise<void> {
  unwrap(
    await createDataClient(accessToken)
      .from("activities")
      .delete()
      .eq("id", id)
      .select("id")
      .single()
  )
}

/**
 * A goal's activity: everything since `from` for the heatmap and timeline, plus how many things
 * the goal has in all. Uses a lightweight head query for total count to avoid downloading all row payloads.
 */
export async function fetchGoalActivity(
  accessToken: string,
  input: { goalId: string; from: LocalDate }
): Promise<{ recent: Activity[]; total: number }> {
  const client = createDataClient(accessToken)
  const [recent, totalResult] = await Promise.all([
    client
      .from("activities")
      .select(COLUMNS)
      .eq("goal_id", input.goalId)
      .gte("date", input.from)
      .order("date", { ascending: false })
      .order("id", { ascending: false }),
    client
      .from("activities")
      .select("id", { count: "exact", head: true })
      .eq("goal_id", input.goalId),
  ])
  if (totalResult.error) {
    throw new Error(`activities: ${totalResult.error.message}`)
  }
  return {
    recent: unwrap(recent).map(toActivity),
    total: totalResult.count ?? 0,
  }
}
