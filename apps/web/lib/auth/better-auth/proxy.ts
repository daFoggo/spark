import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import type { ProxyAuthResult } from "../types"
import { auth } from "./auth"

export async function updateSession(
  request: NextRequest
): Promise<ProxyAuthResult> {
  const response = NextResponse.next({ request })

  // Short-circuit: if there is no session token or auth header, the request is unauthenticated.
  // This avoids unnecessary DB connection attempts on public pages and static assets.
  const hasSessionCookie =
    request.cookies.has("better-auth.session_token") ||
    request.cookies.has("__Secure-better-auth.session_token") ||
    request.headers.has("authorization")

  if (!hasSessionCookie) {
    return { response, isAuthenticated: false }
  }

  try {
    const result = await auth.api.getSession({
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

    return { response, isAuthenticated: Boolean(session) }
  } catch (error) {
    console.error("[proxy] updateSession error:", error)
    return { response, isAuthenticated: false }
  }
}
