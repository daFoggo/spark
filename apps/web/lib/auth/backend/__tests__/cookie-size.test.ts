import { describe, expect, it } from "vitest"

import { seal, type BackendSession } from "../cookie"

// A signed HS256 JWT with the claims the backend issues (sub, email, name, iat, nbf, exp, type)
// is about 280 characters (a modeled token of that size is used here).
const jwt = (n: number) => "x".repeat(n)

describe("sealed session cookie size", () => {
  it("stays well below the 4096-byte browser cookie limit", async () => {
    const session: BackendSession = {
      userId: "0b2f6c1e-8d3a-4f55-9a1e-2c7d5e9b4a10",
      accessToken: jwt(283),
      refreshToken: jwt(283),
      accessExpiresAt: Date.now() + 1_800_000,
      refreshExpiresAt: Date.now() + 604_800_000,
      role: "member",
      name: "Nguyen Thi Ngoc Anh",
      email: "ngoc.anh.nguyen@example.com",
    }
    const size = encodeURIComponent(await seal(session)).length
    expect(size).toBeLessThan(3000)
  })
})
