import { describe, expect, it } from "vitest"
import type { z } from "zod"

import { contractKeys, type Same, type Schemas } from "@/lib/api/contract"

import { SettingsSchema } from "../schemas"

type _Settings = Same<z.infer<typeof SettingsSchema>, Schemas["Settings"]>
export const assertions: [_Settings] = [true]

describe("settings contract (openapi.yaml)", () => {
  it("Settings lists the same fields as the DTO", () => {
    expect(contractKeys("Settings")).toEqual(
      Object.keys(SettingsSchema.shape).sort()
    )
  })
})
