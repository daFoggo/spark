import { describe, expect, it } from "vitest"

import {
  canActivate,
  canMarkDone,
  checkpointProgress,
  currentChapterStart,
  goalCells,
  goalLevel,
  groupGoals,
} from "../rules"
import type { Chapter, Checkpoint, Goal } from "../schemas"

const goal = (overrides: Partial<Goal> = {}): Goal => ({
  id: "g1",
  slug: "g1",
  name: "Goal",
  why: null,
  becoming: null,
  targetDate: null,
  ifHardObstacle: null,
  ifHardPlan: null,
  status: "active",
  checkpoints: [],
  ...overrides,
})
const cp = (doneOn: string | null): Checkpoint => ({
  id: String(Math.random()),
  goalId: "g1",
  title: "Step",
  position: 0,
  doneOn,
})

describe("checkpointProgress (CP-2, CP-3)", () => {
  it("has no percentage without checkpoints", () => {
    expect(checkpointProgress([])).toBeNull()
  })

  it("counts done over total", () => {
    expect(checkpointProgress([cp("2026-10-01"), cp(null), cp(null)])).toEqual({
      done: 1,
      total: 3,
      percent: 33,
    })
  })
})

describe("goal status rules (GL-3, GL-4)", () => {
  it("needs a target date or a checkpoint to be marked done", () => {
    expect(canMarkDone(goal())).toBe(false)
    expect(canMarkDone(goal({ targetDate: "2026-12-31" }))).toBe(true)
    expect(canMarkDone(goal({ checkpoints: [cp(null)] }))).toBe(true)
  })

  it("allows at most 3 active goals", () => {
    const three = [goal({ id: "a" }), goal({ id: "b" }), goal({ id: "c" })]
    expect(canActivate(three)).toBe(false)
    expect(
      canActivate([...three.slice(0, 2), goal({ status: "someday" })])
    ).toBe(true)
  })

  it("groups goals and hides archived ones (GL-5)", () => {
    const groups = groupGoals([
      goal({ id: "a" }),
      goal({ id: "b", status: "someday" }),
      goal({ id: "c", status: "done" }),
      goal({ id: "d", status: "archived" }),
    ])
    expect(groups.active.map((g) => g.id)).toEqual(["a"])
    expect(groups.someday.map((g) => g.id)).toEqual(["b"])
    expect(groups.done.map((g) => g.id)).toEqual(["c"])
  })
})

describe("currentChapterStart (CH-3)", () => {
  it("starts after the highest closed activity id", () => {
    const chapter = (lastActivityId: number): Chapter => ({
      id: "c",
      goalId: "g1",
      title: "One",
      closedOn: "2026-10-01",
      lastActivityId,
      activityCount: 1,
      hours: 0,
    })
    expect(currentChapterStart([])).toBe(0)
    expect(currentChapterStart([chapter(12), chapter(40)])).toBe(40)
  })
})

describe("goal heat levels (MT-7)", () => {
  it("buckets the daily count", () => {
    expect([0, 1, 2, 3, 7].map(goalLevel)).toEqual([0, 2, 3, 4, 4])
  })

  it("builds one cell per day", () => {
    const cells = goalCells(
      ["2026-10-19", "2026-10-19", "2026-10-20"],
      "2026-10-18",
      "2026-10-20",
      (date, count) => `${date} ${count}`
    )
    expect(Object.keys(cells)).toHaveLength(3)
    expect(cells["2026-10-19"]).toMatchObject({
      level: 3,
      label: "2026-10-19 2",
    })
    expect(cells["2026-10-18"]?.level).toBe(0)
  })
})
