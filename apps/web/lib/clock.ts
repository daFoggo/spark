import "server-only"

import { cacheLife } from "next/cache"

import { localDate, type LocalDate } from "./dates"

/**
 * Today's date in the user's timezone (spec TM-3). `"use cache: private"` keeps the clock read
 * per request (never in the static shell or a shared server cache) while letting it run in the
 * App Shell, so the reads keyed by `today` are prefetched instead of waiting for navigation.
 * Same lifetime as the queries: the client may show a cached day up to `stale` after midnight.
 */
export async function getToday(timezone: string): Promise<LocalDate> {
  "use cache: private"
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 })
  return localDate(new Date(), timezone)
}
