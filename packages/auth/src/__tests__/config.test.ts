import { describe, expect, it } from "vitest"

import { parseAuthConfig } from "../config"

const SECRET = "a-real-secret-that-is-at-least-32-characters"
const DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/spark"

describe("parseAuthConfig", () => {
  it("throws for better-auth without a secret outside the production build", () => {
    expect(() =>
      parseAuthConfig({ AUTH_PROVIDER: "better-auth", DATABASE_URL })
    ).toThrow()
  })

  it("throws for better-auth without a database url outside the production build", () => {
    expect(() =>
      parseAuthConfig({ AUTH_PROVIDER: "better-auth", BETTER_AUTH_SECRET: SECRET })
    ).toThrow()
  })

  it("allows placeholders for better-auth during the production build", () => {
    const config = parseAuthConfig({
      AUTH_PROVIDER: "better-auth",
      NEXT_PHASE: "phase-production-build",
    })
    expect(config.AUTH_PROVIDER).toBe("better-auth")
  })

  it("accepts better-auth with a real secret and database url", () => {
    const config = parseAuthConfig({
      AUTH_PROVIDER: "better-auth",
      BETTER_AUTH_SECRET: SECRET,
      DATABASE_URL,
    })
    expect(config.AUTH_PROVIDER).toBe("better-auth")
  })

  it("needs neither for supabase", () => {
    const config = parseAuthConfig({
      AUTH_PROVIDER: "supabase",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "key",
    })
    expect(config.AUTH_PROVIDER).toBe("supabase")
  })
})
