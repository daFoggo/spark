import { cacheLife, cacheTag } from "next/cache"

import { activitiesTag } from "@/lib/cache-tags"
import { verifySession } from "@/lib/dal"
import type { LocalDate } from "@/lib/dates"

import {
  fetchActivities,
  fetchActivityStats,
  fetchGoalActivity,
} from "./server"
import type { Activity, ActivityStats } from "./schemas"

/** Per-user caches (browser only). Call inside `<Suspense>`. */

export async function getActivityStats(
  adoptedOn: LocalDate,
  today: LocalDate
): Promise<ActivityStats> {
  "use cache: private"
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 })
  const { userId, accessToken } = await verifySession()
  cacheTag(activitiesTag(userId))
  return fetchActivityStats(accessToken, { adoptedOn, today })
}

export async function getActivities(
  from: LocalDate,
  to: LocalDate,
  source?: Activity["source"]
): Promise<Activity[]> {
  "use cache: private"
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 })
  const { userId, accessToken } = await verifySession()
  cacheTag(activitiesTag(userId))
  return fetchActivities(accessToken, { from, to, source })
}

/** One goal's activity: since `from` for the heatmap and timeline, and the current chapter's totals. */
export async function getGoalActivity(
  goalId: string,
  from: LocalDate,
  afterId: number
) {
  "use cache: private"
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 })
  const { userId, accessToken } = await verifySession()
  cacheTag(activitiesTag(userId))
  return fetchGoalActivity(accessToken, { goalId, from, afterId })
}
