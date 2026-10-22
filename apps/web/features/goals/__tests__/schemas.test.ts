import { describe, expect, it } from "vitest"

import { CheckpointMoveSchema, CheckpointPositionSchema } from "../schemas"

describe("CheckpointPositionSchema", () => {
  it("accepts non-negative integers", () => {
    expect(CheckpointPositionSchema.safeParse(0).success).toBe(true)
    expect(CheckpointPositionSchema.safeParse(7).success).toBe(true)
    expect(CheckpointPositionSchema.safeParse(2_147_483_647).success).toBe(true)
  })

  it.each([-1, 1.5, Number.NaN, Infinity, 2 ** 31, "2", null])(
    "rejects %s",
    (value) => {
      expect(CheckpointPositionSchema.safeParse(value).success).toBe(false)
    }
  )
})

describe("CheckpointMoveSchema", () => {
  it("accepts -1 and 1", () => {
    expect(CheckpointMoveSchema.safeParse(-1).success).toBe(true)
    expect(CheckpointMoveSchema.safeParse(1).success).toBe(true)
  })

  it.each([0, 2, 0.5, Number.NaN, "1"])("rejects %s", (value) => {
    expect(CheckpointMoveSchema.safeParse(value).success).toBe(false)
  })
})
