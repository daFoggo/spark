import { describe, expect, it } from "vitest"

import { parseSupabaseEnv } from "../env"

const URL_KEY = "NEXT_PUBLIC_SUPABASE_URL"
const KEY_KEY = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"

describe("parseSupabaseEnv", () => {
  it("returns the URL and publishable key", () => {
    expect(
      parseSupabaseEnv({
        [URL_KEY]: "https://x.supabase.co",
        [KEY_KEY]: "sb_publishable_a",
      })
    ).toEqual({
      url: "https://x.supabase.co",
      publishableKey: "sb_publishable_a",
    })
  })

  it("names a missing URL", () => {
    expect(() => parseSupabaseEnv({ [KEY_KEY]: "k" })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/
    )
  })

  it("names a malformed URL", () => {
    expect(() =>
      parseSupabaseEnv({ [URL_KEY]: "not a url", [KEY_KEY]: "k" })
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/)
  })

  it("names a missing publishable key", () => {
    expect(() =>
      parseSupabaseEnv({ [URL_KEY]: "https://x.supabase.co" })
    ).toThrow(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/)
  })
})
