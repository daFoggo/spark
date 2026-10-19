import { cacheLife, cacheTag } from "next/cache"

import { reviewsTag } from "@/lib/cache-tags"
import { verifySession } from "@/lib/dal"
import type { LocalDate } from "@/lib/dates"

import { fetchReview } from "./server"
import type { Review } from "./schemas"

/** Per-user cache (browser only); finishing a review expires it with `updateTag`. Call inside `<Suspense>`. */
export async function getReview(weekStart: LocalDate): Promise<Review | null> {
  "use cache: private"
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 })
  const { userId, accessToken } = await verifySession()
  cacheTag(reviewsTag(userId))
  return fetchReview(accessToken, weekStart)
}
