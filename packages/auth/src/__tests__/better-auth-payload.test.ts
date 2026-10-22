import { describe, expect, it } from "vitest"

import { jwtPayload } from "../better-auth/payload"

describe("jwtPayload", () => {
  it("keeps the base backend's role vocabulary for users without a role", () => {
    expect(jwtPayload({ name: "A", email: "a@x.vn" }).role).toBe("member")
  })

  it("passes a stored role through unchanged", () => {
    expect(jwtPayload({ role: "admin", name: "A", email: "a@x.vn" })).toEqual({
      role: "admin",
      name: "A",
      email: "a@x.vn",
    })
  })
})
