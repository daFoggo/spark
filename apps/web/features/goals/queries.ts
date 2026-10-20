import { cacheLife, cacheTag } from "next/cache"

import { goalTag, goalsTag } from "@/lib/cache-tags"
import { verifySession } from "@/lib/dal"

import { fetchGoal, fetchGoals } from "./server"
import type { Goal } from "./schemas"

/** Per-user caches (browser only); writes expire them with `updateTag`. Call inside `<Suspense>`. */

export async function getGoals(): Promise<Goal[]> {
  "use cache: private"
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 })
  const { userId, accessToken } = await verifySession()
  cacheTag(goalsTag(userId))
  return fetchGoals(accessToken)
}

export async function getGoal(goalId: string): Promise<Goal | null> {
  "use cache: private"
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 })
  const { userId, accessToken } = await verifySession()
  cacheTag(goalsTag(userId), goalTag(goalId))
  return fetchGoal(accessToken, goalId)
}
