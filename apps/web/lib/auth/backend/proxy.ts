import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { z } from "zod"

import { apiUrl } from "@/lib/url"

import { authConfig } from "../config"
import type { ProxyAuthResult } from "../types"
import {
  ACCESS_REFRESH_SKEW_MS,
  cookieName,
  parseExpirationMs,
  seal,
  setOnResponse,
  unseal,
  type BackendSession,
} from "./cookie"

const refreshSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expiration: z.union([z.string(), z.number()]),
  refresh_expiration: z.union([z.string(), z.number()]),
})

async function refresh(
  session: BackendSession
): Promise<BackendSession | null> {
  if (authConfig.AUTH_PROVIDER !== "backend") return null
  try {
    const res = await fetch(apiUrl(authConfig.API_BASE_URL, "auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    })
    if (!res.ok) return null
    const body = refreshSchema.parse(await res.json())
    // Identity fields are kept from sign-in; a role change shows after the next sign-in.
    return {
      ...session,
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      accessExpiresAt: parseExpirationMs(body.expiration),
      refreshExpiresAt: parseExpirationMs(body.refresh_expiration),
    }
  } catch {
    return null
  }
}

/**
 * The only place that refreshes backend tokens (Server Components cannot write
 * cookies). Identity comes from decrypting the session cookie, not from the backend.
 */
export async function updateSession(
  request: NextRequest
): Promise<ProxyAuthResult> {
  const name = cookieName()
  const raw = request.cookies.get(name)?.value
  const session = await unseal(raw)
  if (!session) {
    const response = NextResponse.next({ request })
    // A cookie that cannot be unsealed (tampered, expired, wrong secret) is dropped.
    if (raw) {
      request.cookies.delete(name)
      response.cookies.delete(name)
    }
    return { response, isAuthenticated: false }
  }

  const now = Date.now()
  const needsRefresh = session.accessExpiresAt - now <= ACCESS_REFRESH_SKEW_MS
  if (!needsRefresh) {
    return { response: NextResponse.next({ request }), isAuthenticated: true }
  }

  const next = session.refreshExpiresAt > now ? await refresh(session) : null
  if (next) {
    // Make the new session visible to Server Components on this very request.
    request.cookies.set(name, await seal(next))
    const response = NextResponse.next({ request })
    await setOnResponse(response, next)
    return { response, isAuthenticated: true }
  }

  // Refresh failed: keep going while the access token is still valid, otherwise sign out.
  if (session.accessExpiresAt > now) {
    return { response: NextResponse.next({ request }), isAuthenticated: true }
  }
  request.cookies.delete(name)
  const response = NextResponse.next({ request })
  response.cookies.delete(name)
  return { response, isAuthenticated: false }
}
