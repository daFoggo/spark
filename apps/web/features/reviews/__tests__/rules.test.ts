import { describe, expect, it } from "vitest"

import { isReviewDue, suggestEasier, toggleFocus } from "../rules"
import type { Review } from "../schemas"

const review = (completedAt: string | null): Review => ({
  id: "r1",
  weekStartOn: "2026-10-19",
  reflection: null,
  habitChoices: {},
  focusTaskIds: [],
  completedAt,
})

describe("isReviewDue (RV-5)", () => {
  it("is due until the week's review is saved", () => {
    expect(isReviewDue(null)).toBe(true)
    expect(isReviewDue(review(null))).toBe(true)
    expect(isReviewDue(review("2026-10-25T10:00:00Z"))).toBe(false)
  })
})

describe("suggestEasier (RV-3)", () => {
  it("flags habits under 50% and ignores habits with nothing due", () => {
    expect(suggestEasier(0.49)).toBe(true)
    expect(suggestEasier(0.5)).toBe(false)
    expect(suggestEasier(null)).toBe(false)
  })
})

describe("toggleFocus (RV-4)", () => {
  it("adds up to three and removes on a second tap", () => {
    let focus: string[] = []
    for (const id of ["a", "b", "c", "d"]) focus = toggleFocus(focus, id)
    expect(focus).toEqual(["a", "b", "c"])
    expect(toggleFocus(focus, "b")).toEqual(["a", "c"])
  })
})
