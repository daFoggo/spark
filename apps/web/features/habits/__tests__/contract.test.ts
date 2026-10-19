import { describe, expect, it } from "vitest"
import type { z } from "zod"

import {
  contractKeys,
  contractRequired,
  type Same,
  type Schemas,
} from "@/lib/api/contract"

import { CheckInSchema, HabitSchema, ScheduleRowSchema } from "../schemas"

// Compile-time: the DTOs the server returns are exactly the contract types.
type _Habit = Same<z.infer<typeof HabitSchema>, Schemas["Habit"]>
type _CheckIn = Same<z.infer<typeof CheckInSchema>, Schemas["CheckIn"]>
type _Row = Same<z.infer<typeof ScheduleRowSchema>, Schemas["ScheduleRow"]>
export const assertions: [_Habit, _CheckIn, _Row] = [true, true, true]

describe("habits contract (openapi.yaml)", () => {
  it("Habit and CheckIn list the same fields as the DTOs", () => {
    expect(contractKeys("Habit")).toEqual(Object.keys(HabitSchema.shape).sort())
    expect(contractRequired("Habit")).toEqual(contractKeys("Habit"))
    expect(contractKeys("CheckIn")).toEqual(
      Object.keys(CheckInSchema.shape).sort()
    )
  })
})
