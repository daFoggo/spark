import { describe, expect, it } from "vitest"
import type { z } from "zod"

import {
  contractKeys,
  contractRequired,
  type Same,
  type Schemas,
} from "@/lib/api/contract"

import { CheckpointSchema, GoalSchema } from "../schemas"

type _Goal = Same<z.infer<typeof GoalSchema>, Schemas["Goal"]>
type _Checkpoint = Same<z.infer<typeof CheckpointSchema>, Schemas["Checkpoint"]>
export const assertions: [_Goal, _Checkpoint] = [true, true]

describe("goals contract (openapi.yaml)", () => {
  it("Goal and Checkpoint list the same fields as the DTOs", () => {
    expect(contractKeys("Goal")).toEqual(Object.keys(GoalSchema.shape).sort())
    expect(contractRequired("Goal")).toEqual(contractKeys("Goal"))
    expect(contractKeys("Checkpoint")).toEqual(
      Object.keys(CheckpointSchema.shape).sort()
    )
  })
})
