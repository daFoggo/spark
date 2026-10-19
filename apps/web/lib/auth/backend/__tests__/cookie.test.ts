import { describe, expect, it } from "vitest"

import { parseExpirationMs, seal, unseal, type BackendSession } from "../cookie"

const session = (): BackendSession => ({
  userId: "u1",
  accessToken: "a",
  refreshToken: "r",
  accessExpiresAt: Date.now() + 60_000,
  refreshExpiresAt: Date.now() + 3_600_000,
  role: "admin",
  name: "Ada",
  email: "ada@example.com",
})

describe("parseExpirationMs", () => {
  it("accepts ISO strings, unix seconds and milliseconds", () => {
    expect(parseExpirationMs("2030-01-01T00:00:00Z")).toBe(
      Date.parse("2030-01-01T00:00:00Z")
    )
    expect(parseExpirationMs(1_900_000_000)).toBe(1_900_000_000_000)
    expect(parseExpirationMs(1_900_000_000_000)).toBe(1_900_000_000_000)
    expect(parseExpirationMs("1900000000")).toBe(1_900_000_000_000)
  })
})

describe("sealed session cookie", () => {
  it("round-trips a session", async () => {
    const original = session()
    expect(await unseal(await seal(original))).toEqual(original)
  })

  it("reads cookies sealed before role/name/email existed as a member", async () => {
    const { role: _role, name: _name, email: _email, ...legacy } = session()
    expect(await unseal(await seal(legacy as BackendSession))).toEqual({
      ...legacy,
      role: "member",
      name: null,
      email: null,
    })
  })

  it("rejects missing, tampered and malformed cookies", async () => {
    expect(await unseal(undefined)).toBeNull()
    const sealed = await seal(session())
    expect(await unseal(sealed.slice(0, -4) + "AAAA")).toBeNull()
    expect(await unseal("not-a-seal")).toBeNull()
  })
})
