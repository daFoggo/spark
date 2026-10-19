import { describe, expect, it } from "vitest"

import type { Task } from "../schemas"
import { inTab, isStale, parseQuickAdd, taskAge } from "../rules"

const today = "2026-10-20"
const task = (overrides: Partial<Task> = {}): Task => ({
  id: "t1",
  title: "Write tests",
  note: null,
  goalId: null,
  list: "today",
  createdOn: today,
  doneOn: null,
  ...overrides,
})

describe("task age (TK-4, TK-5)", () => {
  it("counts days since creation and goes stale at 5", () => {
    expect(taskAge(task({ createdOn: "2026-10-18" }), today)).toBe(2)
    expect(isStale(task({ createdOn: "2026-10-16" }), today)).toBe(false)
    expect(isStale(task({ createdOn: "2026-10-15" }), today)).toBe(true)
  })

  it("only open today tasks go stale", () => {
    const old = "2026-10-01"
    expect(isStale(task({ createdOn: old, list: "later" }), today)).toBe(false)
    expect(isStale(task({ createdOn: old, doneOn: today }), today)).toBe(false)
  })
})

describe("tabs (TK-2, TK-8)", () => {
  it("sorts tasks into today, later and done", () => {
    expect(inTab(task(), "today", today)).toBe(true)
    expect(inTab(task({ list: "later" }), "later", today)).toBe(true)
    expect(inTab(task({ doneOn: today }), "today", today)).toBe(true)
    expect(inTab(task({ doneOn: "2026-10-19" }), "today", today)).toBe(false)
    expect(inTab(task({ doneOn: today }), "done", today)).toBe(true)
  })

  it("hides tasks finished more than 30 days ago", () => {
    expect(inTab(task({ doneOn: "2026-09-20" }), "done", today)).toBe(true)
    expect(inTab(task({ doneOn: "2026-09-19" }), "done", today)).toBe(false)
  })
})

describe("parseQuickAdd (TK-3)", () => {
  const known = new Set(["ai-engineer"])

  it("links a known goal and removes the token", () => {
    expect(parseQuickAdd("Read chapter 3 #ai-engineer", known)).toEqual({
      title: "Read chapter 3",
      goalSlug: "ai-engineer",
    })
    expect(parseQuickAdd("#ai-engineer Read chapter 3", known).title).toBe(
      "Read chapter 3"
    )
  })

  it("keeps unknown slugs in the title", () => {
    expect(parseQuickAdd("Fix #123 bug", known)).toEqual({
      title: "Fix #123 bug",
      goalSlug: null,
    })
  })

  it("does not treat # inside a word as a token", () => {
    expect(parseQuickAdd("C#ai-engineer", known).goalSlug).toBeNull()
  })
})
