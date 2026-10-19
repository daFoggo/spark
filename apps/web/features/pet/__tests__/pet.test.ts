import { describe, expect, it } from "vitest"

import { petState } from "../pet"

const today = "2026-10-19"
const base = { treats: 0, lastActivity: null, today, weekRate: 0 }

describe("petState", () => {
  it("picks the stage by treats (PT-3)", () => {
    expect(petState({ ...base, treats: 29 }).stageName).toBe("Kitten")
    expect(petState({ ...base, treats: 30 }).stageName).toBe("Young cat")
    expect(petState({ ...base, treats: 400 })).toMatchObject({
      stage: 4,
      untilNext: null,
      fatness: 1,
    })
    expect(petState({ ...base, treats: 100 })).toMatchObject({
      stage: 2,
      untilNext: 100,
      nextName: "Round cat",
    })
  })

  it("derives the mood from the last activity (PT-4)", () => {
    expect(petState(base).mood).toBe("sleepy")
    expect(petState({ ...base, lastActivity: "2026-10-17" }).mood).toBe(
      "sleepy"
    )
    expect(petState({ ...base, lastActivity: "2026-10-18" }).mood).toBe("idle")
    expect(petState({ ...base, lastActivity: today, weekRate: 0.5 }).mood).toBe(
      "idle"
    )
    expect(petState({ ...base, lastActivity: today, weekRate: 0.6 }).mood).toBe(
      "happy"
    )
  })
})
