import { describe, expect, it } from "vitest"
import type { z } from "zod"

import {
  contractKeys,
  contractRequired,
  type Same,
  type Schemas,
} from "@/lib/api/contract"

import { TaskSchema } from "../schemas"

type _Task = Same<z.infer<typeof TaskSchema>, Schemas["Task"]>
export const assertions: [_Task] = [true]

describe("tasks contract (openapi.yaml)", () => {
  it("Task lists the same fields as the DTO", () => {
    expect(contractKeys("Task")).toEqual(Object.keys(TaskSchema.shape).sort())
    expect(contractRequired("Task")).toEqual(contractKeys("Task"))
  })
})
