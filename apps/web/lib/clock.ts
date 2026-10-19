import "server-only"

import { io } from "next/cache"

import { localDate, type LocalDate } from "./dates"

/**
 * Today's date in the user's timezone (spec TM-3). Reading the clock must wait for the request:
 * `io()` marks it as request-time so it is never baked into a prerender or a shared cache.
 * Call it from inside `<Suspense>`, then pass the date into cached functions as an argument.
 */
export async function getToday(timezone: string): Promise<LocalDate> {
  await io()
  return localDate(new Date(), timezone)
}
