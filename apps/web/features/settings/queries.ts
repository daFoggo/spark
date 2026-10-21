import { cacheLife, cacheTag } from "next/cache"

import { settingsTag } from "@/lib/cache-tags"
import { verifySession, type Calendar } from "@/lib/dal"

import { fetchSettings } from "./server"
import type { Settings } from "./schemas"

/**
 * Per-user cache (browser only): the token is needed to read, so `"use cache: private"`.
 * Call inside `<Suspense>`; it runs at request time.
 */
export async function getSettings(): Promise<Settings> {
  "use cache: private"
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 })
  const { userId, accessToken } = await verifySession()
  cacheTag(settingsTag(userId))
  return fetchSettings(accessToken)
}

/**
 * Timezone, week start and adoption date: all most pages need to know "today". Taken from the session
 * token when the provider carries them (Supabase hook: no read, no wait), else from the settings read.
 */
export async function getCalendar(): Promise<Calendar> {
  const { calendar } = await verifySession()
  if (calendar) return calendar
  const { timezone, weekStart, adoptedOn } = await getSettings()
  return { timezone, weekStart, adoptedOn }
}
