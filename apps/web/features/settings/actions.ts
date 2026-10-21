"use server"

import { updateTag } from "next/cache"

import { settingsTag } from "@/lib/cache-tags"
import { verifySession } from "@/lib/dal"
import { isExpectedApiError } from "@/lib/errors"

import { DetectedLocaleSchema, UpdateSettingsSchema } from "./schemas"
import { saveSettings } from "./server"

export type SettingsState = { error?: string; saved?: boolean }

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
  const parsed = UpdateSettingsSchema.safeParse({
    timezone: formData.get("timezone"),
    petName: formData.get("petName"),
    weekStart: formData.get("weekStart"),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  try {
    await saveSettings(accessToken, {
      ...parsed.data,
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
