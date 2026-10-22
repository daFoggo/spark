import type { NextRequest } from "next/server"

import { redirectWithSession, updateSession } from "@workspace/auth/proxy"

import { AUTH_OPTIONS } from "@/config/auth"
import {
  AUTH_PAGES,
  DASHBOARD_PATH,
  PROTECTED_PREFIXES,
  SIGN_IN_PATH,
} from "@/config/routes"

/**
 * 1) Refresh the session (provider-specific) so Server Components see fresh tokens.
 * 2) Optimistic redirect for protected paths. Real authorization is in the DAL.
 * 3) Emits Server-Timing header for Chrome DevTools Network profiling.
 */
export async function proxy(request: NextRequest) {
  const start = performance.now()
  const { response, isAuthenticated } = await updateSession(
    request,
    AUTH_OPTIONS
  )
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
  matcher: [
    "/((?!api|_next/static|_next/image|__nextjs_font|favicon.ico|icon.svg|robots.txt|sitemap.xml).*)",
  ],
}
