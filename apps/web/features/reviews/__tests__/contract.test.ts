import { describe, expect, it } from "vitest"
import type { z } from "zod"

import {
  contractKeys,
  contractRequired,
  type Same,
  type Schemas,
} from "@/lib/api/contract"

import { ReviewSchema } from "../schemas"

type _Review = Same<z.infer<typeof ReviewSchema>, Schemas["Review"]>
export const assertions: [_Review] = [true]

describe("reviews contract (openapi.yaml)", () => {
  it("Review lists the same fields as the DTO", () => {
    expect(contractKeys("Review")).toEqual(
      Object.keys(ReviewSchema.shape).sort()
    )
    expect(contractRequired("Review")).toEqual(contractKeys("Review"))
  })
})
