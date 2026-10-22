import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { parseRole } from "../permissions"
import type { AuthOptions, ProxyAuthResult } from "../types"
import { getBetterAuth } from "./auth"
import { hasBetterAuthSession } from "./session-cookie"

export async function updateSession(
  request: NextRequest,
  options: AuthOptions
): Promise<ProxyAuthResult> {
  const response = NextResponse.next({ request })

  // Short-circuit: if there is no session token or auth header, the request is unauthenticated.
  // This avoids unnecessary DB connection attempts on public pages and static assets.
  if (!hasBetterAuthSession(request, options.cookieName)) {
    return { response, isAuthenticated: false, role: null }
  }

  try {
    const result = await getBetterAuth(options).api.getSession({
      headers: request.headers,
      returnHeaders: true,
    })

    const session = result?.response
    const setHeaders = result?.headers

    if (setHeaders) {
      const cookies =
        typeof setHeaders.getSetCookie === "function"
          ? setHeaders.getSetCookie()
          : ([setHeaders.get("set-cookie")].filter(Boolean) as string[])

      for (const cookieStr of cookies) {
        response.headers.append("set-cookie", cookieStr)
        const [nameVal] = cookieStr.split(";")
        if (nameVal) {
          const [cName, ...cVal] = nameVal.split("=")
          if (cName) {
            request.cookies.set(cName.trim(), cVal.join("=").trim())
          }
        }
      }
    }

    if (!session) return { response, isAuthenticated: false, role: null }
    return {
      response,
      isAuthenticated: true,
      role: parseRole((session.user as { role?: string }).role),
    }
  } catch (error) {
    console.error("[proxy] updateSession error:", error)
    return { response, isAuthenticated: false, role: null }
  }
}
