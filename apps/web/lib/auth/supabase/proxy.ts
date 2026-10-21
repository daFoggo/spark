import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { authConfig } from "../config"
import type { ProxyAuthResult } from "../types"

/** Refreshes the Supabase session; the only place that should refresh it. */
export async function updateSession(
  request: NextRequest
): Promise<ProxyAuthResult> {
  if (authConfig.AUTH_PROVIDER !== "supabase") {
    throw new Error("Supabase proxy used while AUTH_PROVIDER is not 'supabase'")
  }

  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    authConfig.NEXT_PUBLIC_SUPABASE_URL,
    authConfig.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
          // Cache headers stop CDNs from caching a response that carries Set-Cookie.
          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value)
          }
        },
      },
    }
  )

  const { data } = await supabase.auth.getClaims()
  return { response, isAuthenticated: Boolean(data?.claims.sub) }
}
