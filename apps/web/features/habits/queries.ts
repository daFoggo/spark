import { cacheLife, cacheTag } from "next/cache"

import { checkinsTag, habitsTag } from "@/lib/cache-tags"
import { verifySession } from "@/lib/dal"
import type { LocalDate } from "@/lib/dates"

import { fetchCheckIns, fetchHabit, fetchHabits } from "./server"
import type { CheckIn, Habit } from "./schemas"

/** Per-user caches (browser only): the token is needed to read. Call inside `<Suspense>`. */

export async function getHabits(): Promise<Habit[]> {
  "use cache: private"
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 })
  const { userId, accessToken } = await verifySession()
  cacheTag(habitsTag(userId))
  return fetchHabits(accessToken)
}

export async function getHabit(habitId: string): Promise<Habit | null> {
  "use cache: private"
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 })
  const { userId, accessToken } = await verifySession()
  cacheTag(habitsTag(userId))
  return fetchHabit(accessToken, habitId)
}

/** Check-ins for the date range; the range is part of the cache key. */
export async function getCheckIns(
  from: LocalDate,
  to: LocalDate,
  habitId?: string
): Promise<CheckIn[]> {
  "use cache: private"
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 })
  const { userId, accessToken } = await verifySession()
  cacheTag(checkinsTag(userId))
  return fetchCheckIns(accessToken, { from, to, habitId })
}
