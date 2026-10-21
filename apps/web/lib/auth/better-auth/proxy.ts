import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import type { ProxyAuthResult } from "../types"
import { auth } from "./auth"

export async function updateSession(
  request: NextRequest
): Promise<ProxyAuthResult> {
  const result = await auth.api.getSession({
    headers: request.headers,
    returnHeaders: true,
  })

  const session = result?.response
  const setHeaders = result?.headers

  const response = NextResponse.next({ request })

  if (setHeaders) {
    const cookies =
      typeof setHeaders.getSetCookie === "function"
        ? setHeaders.getSetCookie()
        : [setHeaders.get("set-cookie")].filter(Boolean) as string[]

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
}
