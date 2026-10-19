import { describe, expect, it } from "vitest"
import type { z } from "zod"

import { contractKeys, type Same, type Schemas } from "@/lib/api/contract"

import { ActivitySchema, type ActivityStats } from "../schemas"

type _Activity = Same<z.infer<typeof ActivitySchema>, Schemas["Activity"]>
type _Stats = Same<ActivityStats, Schemas["ActivityStats"]>
export const assertions: [_Activity, _Stats] = [true, true]

describe("activities contract (openapi.yaml)", () => {
  it("Activity lists the same fields as the DTO", () => {
    expect(contractKeys("Activity")).toEqual(
      Object.keys(ActivitySchema.shape).sort()
    )
  })
})
