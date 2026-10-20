import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import {
  AUTH_PAGES,
  DASHBOARD_PATH,
  PROTECTED_PREFIXES,
  SIGN_IN_PATH,
} from "@/config/routes"
import { updateSession } from "@/lib/auth/proxy"

const CACHE_HEADERS = ["cache-control", "expires", "pragma"]

/**
 * A redirect built from scratch would drop the refreshed session cookies (single-use refresh
 * tokens would be lost) and the cache headers that stop a CDN from caching a `Set-Cookie`.
 */
function redirectWithSession(url: URL, session: NextResponse) {
  const redirect = NextResponse.redirect(url)
  for (const cookie of session.cookies.getAll()) redirect.cookies.set(cookie)
  for (const name of CACHE_HEADERS) {
    const value = session.headers.get(name)
    if (value) redirect.headers.set(name, value)
  }
  const timing = session.headers.get("server-timing")
  if (timing) redirect.headers.set("Server-Timing", timing)
  return redirect
}

/**
 * 1) Refresh the session (provider-specific) so Server Components see fresh tokens.
 * 2) Optimistic redirect for protected paths. Real authorization is in the DAL.
 * 3) Emits Server-Timing header for Chrome DevTools Network profiling.
 */
export async function proxy(request: NextRequest) {
  const start = performance.now()
  const { response, isAuthenticated } = await updateSession(request)
  const duration = Math.max(0, performance.now() - start).toFixed(2)
  response.headers.set(
    "Server-Timing",
    `proxy;dur=${duration};desc="Proxy Auth Check"`
  )

  const { pathname } = request.nextUrl
  // The root has no page of its own: signed-in visitors land on the dashboard, everyone else on sign-in.
  if (pathname === "/") {
    const target = isAuthenticated ? DASHBOARD_PATH : SIGN_IN_PATH
    return redirectWithSession(new URL(target, request.url), response)
  }
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
  if (isProtected && !isAuthenticated) {
    return redirectWithSession(new URL(SIGN_IN_PATH, request.url), response)
  }
  if (isAuthenticated && (AUTH_PAGES as readonly string[]).includes(pathname)) {
    return redirectWithSession(new URL(DASHBOARD_PATH, request.url), response)
  }
  return response
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
