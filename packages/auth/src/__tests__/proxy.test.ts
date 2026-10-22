import { NextRequest, NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const ssr = vi.hoisted(() => ({
  options: undefined as { cookieOptions?: { name?: string } } | undefined,
  claims: null as Record<string, unknown> | null,
}))

vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: typeof ssr.options
  ) => {
    ssr.options = options
    return {
      auth: {
        getClaims: async () => ({
          data: ssr.claims ? { claims: ssr.claims } : null,
        }),
      },
    }
  },
}))

const { redirectWithSession, updateSession } = await import("../proxy")

const request = () => new NextRequest("http://localhost:3000/dashboard")

describe("updateSession", () => {
  beforeEach(() => {
    ssr.options = undefined
    ssr.claims = null
  })

  it("uses the app's own cookie name", async () => {
    await updateSession(request(), { cookieName: "spark-auth" })
    expect(ssr.options?.cookieOptions?.name).toBe("spark-auth")
  })

  it("reports the role of a signed-in user", async () => {
    ssr.claims = { sub: "u1", app_metadata: { role: "admin" } }
    const result = await updateSession(request(), { cookieName: "spark-auth" })
    expect(result).toMatchObject({ isAuthenticated: true, role: "admin" })
  })

  it("reports no session and no role when signed out", async () => {
    const result = await updateSession(request(), { cookieName: "spark-auth" })
    expect(result).toMatchObject({ isAuthenticated: false, role: null })
  })
})

describe("redirectWithSession", () => {
  it("keeps the refreshed cookies and cache headers", () => {
    const session = NextResponse.next()
    session.cookies.set("spark-auth", "v")
    session.headers.set("cache-control", "private, no-store")
    const redirect = redirectWithSession(
      new URL("http://localhost:3000/sign-in"),
      session
    )
    expect(redirect.cookies.get("spark-auth")?.value).toBe("v")
    expect(redirect.headers.get("cache-control")).toBe("private, no-store")
    expect(redirect.headers.get("location")).toBe(
      "http://localhost:3000/sign-in"
    )
  })
})
