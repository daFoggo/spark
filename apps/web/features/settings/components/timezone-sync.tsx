"use client"

import { useEffect } from "react"

import { syncLocaleAction } from "../actions"

/** 0 = Sunday .. 6 = Saturday, from the browser locale. Monday where the API is missing (TM-4). */
function detectWeekStart(): number {
  const locale = new Intl.Locale(navigator.language) as Intl.Locale & {
    getWeekInfo?: () => { firstDay: number }
    weekInfo?: { firstDay: number }
  }
  const firstDay = (locale.getWeekInfo?.() ?? locale.weekInfo)?.firstDay
  // Intl uses 1 = Monday .. 7 = Sunday.
  return firstDay === undefined ? 1 : firstDay % 7
}

/**
 * Renders nothing. Mounted only while the user's timezone has not been confirmed yet, it reports the
 * browser's timezone and week start once; the server then stops rendering it (spec TM-2).
 */
export function TimezoneSync() {
  useEffect(() => {
    void syncLocaleAction({
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      weekStart: detectWeekStart(),
    })
  }, [])
  return null
}
