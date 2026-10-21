"use server"

import { updateTag } from "next/cache"

import { settingsTag } from "@/lib/cache-tags"
import { verifySession } from "@/lib/dal"
import { isExpectedApiError } from "@/lib/errors"

import { DetectedLocaleSchema, UpdateSettingsSchema } from "./schemas"
import { saveSettings } from "./server"

/** `values` echoes the fields back on error: React resets the form after an action finishes. */
export type SettingsState = {
  error?: string
  saved?: boolean
  /** Backend rule that refused the save, e.g. `TM-2` for an unknown timezone. */
  rule?: string
  values?: { timezone: string; weekStart: string; petName: string }
}

/** First visit: store the browser's timezone and locale week start once (TM-2, TM-4). */
export async function syncLocaleAction(input: {
  timezone: string
  weekStart: number
}): Promise<SettingsState> {
  const { userId, accessToken } = await verifySession()
  const parsed = DetectedLocaleSchema.safeParse(input)
  if (!parsed.success) return { error: "Invalid locale" }

  try {
    await saveSettings(accessToken, {
      timezone: parsed.data.timezone,
      weekStart: parsed.data.weekStart,
      timezoneConfirmed: true,
    })
  } catch (error) {
    if (isExpectedApiError(error)) {
      return { error: error.message }
    }
    throw error
  }
  updateTag(settingsTag(userId))
  return { saved: true }
}

export async function updateSettingsAction(
  _previous: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const { userId, accessToken } = await verifySession()
  const values = {
    timezone: String(formData.get("timezone") ?? ""),
    weekStart: String(formData.get("weekStart") ?? ""),
    petName: String(formData.get("petName") ?? ""),
  }
  const parsed = UpdateSettingsSchema.safeParse(values)
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      values,
    }
  }

  try {
    await saveSettings(accessToken, {
      ...parsed.data,
      timezoneConfirmed: true,
    })
  } catch (error) {
    if (isExpectedApiError(error)) {
      const rule =
        error.body && typeof error.body === "object" && "rule" in error.body
          ? String(error.body.rule)
          : undefined
      return { error: error.message, rule, values }
    }
    throw error
  }
  updateTag(settingsTag(userId))
  return { saved: true }
}
