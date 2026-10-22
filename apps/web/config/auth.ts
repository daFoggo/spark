import type { AuthOptions } from "@workspace/auth/types"

/** Spark's own session cookie, so it never collides with another app on the same host. */
export const AUTH_OPTIONS = {
  cookieName: "spark-auth",
} as const satisfies AuthOptions
