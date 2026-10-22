import { beforeEach, describe, expect, it, vi } from "vitest"

const signOut = vi.fn()
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`)
})
let isAction = false

vi.mock("server-only", () => ({}))
vi.mock("next/headers", () => ({
  headers: async () => ({
    has: (name: string) => isAction && name === "next-action",
  }),
}))
vi.mock("next/navigation", () => ({ redirect }))
vi.mock("../auth", () => ({ getAuthProvider: async () => ({ signOut }) }))

const { DataError, ensureOk, unwrap } = await import("../data")

const fail = (code: string, status?: number) => ({
  data: null,
  error: { code, message: "boom" },
  status,
})

describe("unwrap / ensureOk", () => {
  beforeEach(() => {
    isAction = false
    signOut.mockClear()
    redirect.mockClear()
  })

  it("ends the session on a 401", async () => {
    await expect(unwrap(fail("", 401))).rejects.toThrow(
      "NEXT_REDIRECT:/auth/expired"
    )
    expect(redirect).toHaveBeenCalledOnce()
  })

  it.each(["PGRST301", "PGRST303"])("ends the session on %s", async (code) => {
    await expect(ensureOk(fail(code, 400))).rejects.toThrow("NEXT_REDIRECT")
  })

  it("signs out and goes to sign-in from a Server Action", async () => {
    isAction = true
    await expect(unwrap(fail("PGRST301", 401))).rejects.toThrow(
      "NEXT_REDIRECT:/sign-in"
    )
    expect(signOut).toHaveBeenCalledOnce()
  })

  it("throws a DataError, without redirecting, for other errors", async () => {
    const error = await unwrap(fail("23505", 409)).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(DataError)
    expect((error as InstanceType<typeof DataError>).code).toBe("23505")
    expect(redirect).not.toHaveBeenCalled()
  })

  it("returns the data on success", async () => {
    await expect(
      unwrap({ data: [1], error: null, status: 200 })
    ).resolves.toEqual([1])
  })
})
