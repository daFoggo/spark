import { cacheLife, cacheTag } from "next/cache"

import { settingsTag } from "@/lib/cache-tags"
import { verifySession } from "@/lib/dal"

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
