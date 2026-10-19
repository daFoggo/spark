import { cacheLife, cacheTag } from "next/cache"

import { tasksTag } from "@/lib/cache-tags"
import { verifySession } from "@/lib/dal"
import type { LocalDate } from "@/lib/dates"

import { fetchTasks } from "./server"
import type { Task, TaskTab } from "./schemas"

/** Per-user cache (browser only); `today` is part of the key so a task never keeps a stale age; writes expire it with `updateTag`. */
export async function getTasks(
  tab: TaskTab,
  today: LocalDate
): Promise<Task[]> {
  "use cache: private"
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 })
  const { userId, accessToken } = await verifySession()
  cacheTag(tasksTag(userId))
  return fetchTasks(accessToken, { tab, today })
}
