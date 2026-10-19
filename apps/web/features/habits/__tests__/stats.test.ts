import { describe, expect, it } from "vitest"

import { addDays } from "@/lib/dates"

import type { CheckIn, Habit, ScheduleRow } from "../schemas"
import {
  bestStreak,
  consistency,
  currentStreak,
  habitCells,
  indexByDate,
  isDue,
  overallLevel,
  toughestWeekday,
  weekdayRates,
  weekProgress,
} from "../stats"

// 2026-10-19 is a Monday.
const TODAY = "2026-10-19"
const daily: ScheduleRow = {
  kind: "days",
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  validFrom: "2026-01-01",
}

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: "h1",
    goalId: null,
    name: "Read",
    cue: null,
    fullVersion: null,
    minimumVersion: null,
    timeOfDay: "morning",
    startsOn: "2026-01-01",
    pausedFrom: null,
    pausedUntil: null,
    archived: false,
    schedules: [daily],
    ...overrides,
  }
}

const checkIn = (date: string, level: CheckIn["level"] = "full"): CheckIn => ({
  id: 1,
  habitId: "h1",
  date,
  level,
  note: null,
})
const index = (...dates: string[]) => indexByDate(dates.map((d) => checkIn(d)))
const back = (n: number) => addDays(TODAY, -n)

describe("isDue", () => {
  it("matches weekdays and respects starts_on (HB-2, HB-3)", () => {
    const h = habit({
      startsOn: "2026-10-12",
      schedules: [{ kind: "days", weekdays: [1, 3], validFrom: "2026-10-12" }],
    })
    expect(isDue(h, "2026-10-12")).toBe(true) // Monday
    expect(isDue(h, "2026-10-13")).toBe(false)
    expect(isDue(h, "2026-10-14")).toBe(true) // Wednesday
    expect(isDue(h, "2026-10-05")).toBe(false) // before starts_on
  })

  it("counts every n days from starts_on (HB-2)", () => {
    const h = habit({
      startsOn: "2026-10-12",
      schedules: [{ kind: "every", everyN: 3, validFrom: "2026-10-12" }],
    })
    expect([12, 13, 14, 15, 16].map((d) => isDue(h, `2026-10-${d}`))).toEqual([
      true,
      false,
      false,
      true,
      false,
    ])
  })

  it("is not due while paused (HB-5)", () => {
    const h = habit({ pausedFrom: "2026-10-15", pausedUntil: "2026-10-17" })
    expect(isDue(h, "2026-10-14")).toBe(true)
    expect(isDue(h, "2026-10-16")).toBe(false)
    expect(isDue(h, "2026-10-18")).toBe(true)
    expect(isDue(habit({ pausedFrom: "2026-10-15" }), "2026-10-30")).toBe(false)
  })

  it("applies the schedule that was valid on that date (HB-4)", () => {
    const h = habit({
      schedules: [
        { kind: "days", weekdays: [1], validFrom: "2026-01-01" },
        { kind: "days", weekdays: [2], validFrom: "2026-10-10" },
      ],
    })
    expect(isDue(h, "2026-10-05")).toBe(true) // old Monday rule
    expect(isDue(h, "2026-10-19")).toBe(false) // Monday no longer
    expect(isDue(h, "2026-10-20")).toBe(true) // new Tuesday rule
  })
})

describe("streaks (MT-1, MT-2)", () => {
  it("does not count today until it is done, and does not break on it", () => {
    const c = index(back(1), back(2), back(3))
    expect(currentStreak(habit(), c, TODAY)).toBe(3)
    expect(currentStreak(habit(), index(TODAY, back(1)), TODAY)).toBe(2)
  })

  it("forgives one miss but stops at two in a row", () => {
    expect(
      currentStreak(habit(), index(back(1), back(3), back(4)), TODAY)
    ).toBe(3)
    expect(
      currentStreak(habit(), index(back(1), back(4), back(5)), TODAY)
    ).toBe(1)
  })

  it("skips paused and not-scheduled days", () => {
    const h = habit({
      schedules: [{ kind: "days", weekdays: [1, 3], validFrom: "2026-01-01" }],
    })
    // Mon Oct 19 (today, open), Wed Oct 14 and Mon Oct 12 done; the days between are not scheduled.
    expect(currentStreak(h, index("2026-10-14", "2026-10-12"), TODAY)).toBe(2)
  })

  it("finds the best run in history", () => {
    const h = habit({ startsOn: back(30) })
    const c = index(
      ...[30, 29, 28, 27, 26, 25].map(back), // 6
      ...[10, 9, 8].map(back) // 3
    )
    expect(bestStreak(h, c, TODAY)).toBe(6)
  })

  it("ignores check-ins on days that were not due (AC-4)", () => {
    const h = habit({
      schedules: [{ kind: "days", weekdays: [1], validFrom: "2026-01-01" }],
    })
    // The Tuesday extra session adds nothing: only the Monday counts.
    expect(currentStreak(h, index("2026-10-13", "2026-10-12"), TODAY)).toBe(1)
  })
})

describe("consistency (MT-3)", () => {
  it("is done / due over the last 30 days, extras excluded", () => {
    const h = habit({
      schedules: [{ kind: "days", weekdays: [1], validFrom: "2026-01-01" }],
    })
    // Mondays in the window: Sep 21, 28, Oct 5, 12, 19 = 5 due.
    const c = index("2026-10-12", "2026-10-05", "2026-10-13")
    expect(consistency(h, c, TODAY)).toBeCloseTo(2 / 5)
  })

  it("is null when nothing was due", () => {
    expect(
      consistency(habit({ startsOn: "2026-12-01" }), index(), TODAY)
    ).toBeNull()
  })
})

describe("weekday insight (MT-6)", () => {
  it("waits for 10 check-ins, then names the weakest day", () => {
    const h = habit({ startsOn: back(60) })
    const dates = Array.from({ length: 60 }, (_, i) => back(i)).filter(
      (d) => new Date(`${d}T00:00:00Z`).getUTCDay() !== 4 // never on Thursdays
    )
    const rates = weekdayRates(h, index(...dates), TODAY)
    expect(toughestWeekday(rates, 5)).toBeNull()
    expect(toughestWeekday(rates, dates.length)).toBe(4)
  })
})

describe("heat levels (MT-7)", () => {
  it("marks missed 0, minimum 2, full 4, off-schedule rest and extras", () => {
    const h = habit({
      startsOn: "2026-10-12",
      schedules: [{ kind: "days", weekdays: [1], validFrom: "2026-10-12" }],
    })
    const c = indexByDate([
      checkIn("2026-10-12", "minimum"),
      checkIn("2026-10-14", "full"),
    ])
    const cells = habitCells(
      h,
      c,
      "2026-10-12",
      "2026-10-19",
      (d, s) => `${d} ${s}`
    )
    expect(cells["2026-10-12"]).toMatchObject({ level: 2, extra: false })
    expect(cells["2026-10-13"]?.level).toBe("rest")
    expect(cells["2026-10-14"]).toMatchObject({ level: 4, extra: true })
    expect(cells["2026-10-19"]?.level).toBe(0)
  })

  it("buckets the overall day", () => {
    expect(overallLevel(0, 0)).toBe(0)
    expect(overallLevel(5, 2)).toBe(1)
    expect(overallLevel(2, 2)).toBe(2)
    expect(overallLevel(2, 3)).toBe(3)
    expect(overallLevel(2, 4)).toBe(4)
  })
})

describe("weekProgress (MT-4)", () => {
  it("counts this week's due check-ins and the 80% target", () => {
    const c = new Map([["h1", index(back(0), back(1))]])
    const p = weekProgress([habit()], c, TODAY, TODAY) // week starts today
    expect(p).toEqual({ due: 7, dueSoFar: 1, done: 1, target: 6 })
  })
})
