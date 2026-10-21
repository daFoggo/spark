import "server-only"

import { endRejectedSession } from "@/lib/http"
import { createDataClient, unwrap } from "@/lib/supabase/data"

import { SettingsSchema, type Settings } from "./schemas"

const COLUMNS = "timezone, timezone_confirmed, week_start, pet_name, adopted_on"

/** The signed-in user's settings. RLS limits the table to that user, so no id filter is needed. */
export async function fetchSettings(accessToken: string): Promise<Settings> {
  const result = await createDataClient(accessToken)
    .from("user_settings")
    .select(COLUMNS)
    .maybeSingle()
  // Sign-up always creates the row, so none means the user was deleted while the JWT is still valid.
  if (!result.error && !result.data) await endRejectedSession()
  const row = unwrap(result)
  return SettingsSchema.parse({
    timezone: row.timezone,
    timezoneConfirmed: row.timezone_confirmed,
    weekStart: row.week_start,
    petName: row.pet_name,
    adoptedOn: row.adopted_on,
  })
}

export async function saveSettings(
  accessToken: string,
  patch: {
    timezone?: string
    timezoneConfirmed?: boolean
    weekStart?: number
    petName?: string
  }
): Promise<void> {
  const result = await createDataClient(accessToken)
    .from("user_settings")
    .update({
      timezone: patch.timezone,
      timezone_confirmed: patch.timezoneConfirmed,
      week_start: patch.weekStart,
      pet_name: patch.petName,
    })
    // Required by PostgREST for an update; RLS already restricts it to the caller's row.
    .not("user_id", "is", null)
    .select("user_id")
    .maybeSingle()
  // No row to update: the user was deleted (see fetchSettings).
  if (!result.error && !result.data) await endRejectedSession()
  unwrap(result)
}
