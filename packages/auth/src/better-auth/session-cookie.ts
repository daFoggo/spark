import type { NextRequest } from "next/server"

/**
 * Cheap check before touching the database: no session cookie (with this app's prefix) and no bearer header means
 * signed out. Better Auth adds `__Secure-` in front of the prefix when secure cookies are on.
 */
export function hasBetterAuthSession(
  request: NextRequest,
  cookieName: string
): boolean {
  return (
    request.cookies.has(`${cookieName}.session_token`) ||
    request.cookies.has(`__Secure-${cookieName}.session_token`) ||
    request.headers.has("authorization")
  )
}
