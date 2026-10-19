import { describe, expect, it } from "vitest"

import { apiUrl } from "../url"

describe("apiUrl", () => {
  it("keeps the base path (e.g. /api/v1) with or without a trailing slash", () => {
    expect(apiUrl("https://h/api/v1", "auth/sign-in").href).toBe(
      "https://h/api/v1/auth/sign-in"
    )
    expect(apiUrl("https://h/api/v1/", "/users/me").href).toBe(
      "https://h/api/v1/users/me"
    )
  })
})
