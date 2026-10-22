import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { supabaseEnv } from "@workspace/db/env"

import { parseRole } from "../permissions"
import type { AuthOptions, ProxyAuthResult } from "../types"

/** Refreshes the Supabase session; the only place that should refresh it. Not `server-only`: runs in `proxy.ts`. */
export async function updateSession(
  request: NextRequest,
  options: AuthOptions
): Promise<ProxyAuthResult> {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    supabaseEnv.url,
    supabaseEnv.publishableKey,
    {
      cookieOptions: { name: options.cookieName },
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
  const claims = data?.claims
  if (!claims?.sub) return { response, isAuthenticated: false, role: null }
  return {
    response,
    isAuthenticated: true,
    role: parseRole(claims.app_metadata?.role),
  }
}
