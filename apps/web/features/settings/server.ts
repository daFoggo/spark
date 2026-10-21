import "server-only"

import { apiFetch } from "@/lib/http"

import { SettingsSchema, type Settings } from "./schemas"

/** The signed-in user's settings. */
export async function fetchSettings(accessToken: string): Promise<Settings> {
  return SettingsSchema.parse(
    await apiFetch<unknown>("settings", { token: accessToken })
  )
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
  await apiFetch<void>("settings", {
    token: accessToken,
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  })
}
