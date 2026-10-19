import { describe, expect, it } from "vitest"

import {
  addDays,
  dateRange,
  daysBetween,
  isLocalDate,
  localDate,
  startOfWeek,
  weekday,
} from "../dates"

describe("localDate", () => {
  // 2026-10-19 18:30 UTC is already the 20th in Ho Chi Minh (UTC+7) and still the 19th in New York.
  const instant = new Date("2026-10-19T18:30:00Z")

  it("uses the user's timezone, not the server's", () => {
    expect(localDate(instant, "Asia/Ho_Chi_Minh")).toBe("2026-10-20")
    expect(localDate(instant, "America/New_York")).toBe("2026-10-19")
    expect(localDate(instant, "UTC")).toBe("2026-10-19")
  })
})

describe("date arithmetic", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01")
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31")
  })

  it("is not affected by DST changes", () => {
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09")
    expect(daysBetween("2026-03-01", "2026-04-01")).toBe(31)
  })

  it("counts days in both directions", () => {
    expect(daysBetween("2026-10-19", "2026-10-22")).toBe(3)
    expect(daysBetween("2026-10-22", "2026-10-19")).toBe(-3)
  })

  it("lists an inclusive range", () => {
    expect(dateRange("2026-10-19", "2026-10-21")).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
    ])
    expect(dateRange("2026-10-21", "2026-10-19")).toEqual([])
  })
})

describe("weeks", () => {
  it("returns the weekday with Sunday = 0", () => {
    expect(weekday("2026-10-19")).toBe(1) // Monday
    expect(weekday("2026-10-18")).toBe(0) // Sunday
  })

  it("starts the week on the configured day", () => {
    expect(startOfWeek("2026-10-22", 1)).toBe("2026-10-19") // Mon start
    expect(startOfWeek("2026-10-22", 0)).toBe("2026-10-18") // Sun start
    expect(startOfWeek("2026-10-19", 1)).toBe("2026-10-19") // already the first day
    expect(startOfWeek("2026-10-18", 1)).toBe("2026-10-12") // Sunday belongs to the previous Mon-week
  })
})

describe("isLocalDate", () => {
  it("accepts real dates only", () => {
    expect(isLocalDate("2026-10-19")).toBe(true)
    expect(isLocalDate("2026-02-30")).toBe(false)
    expect(isLocalDate("19/10/2026")).toBe(false)
  })
})
