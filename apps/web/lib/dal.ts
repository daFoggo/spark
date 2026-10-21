import "server-only"

import { cache } from "react"
import { cacheLife } from "next/cache"
import { forbidden, redirect } from "next/navigation"

import { SESSION_EXPIRED_PATH } from "@/config/routes"

import { getAuthProvider, type Calendar, type Session } from "./auth"
import { hasPermission, type Permission } from "./auth/permissions"

export type { Calendar, Session }

/**
 * Data Access Layer entry point. `"use cache: private"` (not React `cache`, which each cache scope
 * isolates) so every query's private scope joins one session read per request, and the read
 * (cookies + Better Auth's `Date.now()` expiry check) can run in the per-session App Shell.
 * Never stored on the server across production requests.
 */
export async function getSession(): Promise<Session | null> {
  "use cache: private"
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 })
  const provider = await getAuthProvider()
  return provider.getSession()
}

/** Call close to the data (queries, actions), not in layouts. */
export const verifySession = cache(async (): Promise<Session> => {
  const session = await getSession()
  if (!session) redirect(SESSION_EXPIRED_PATH)
  return session
})

/**
 * Session that holds `permission`, else the nearest forbidden.tsx (403).
 * Call in the page or action that needs it, not in a layout.
 */
export const requirePermission = cache(
  async (permission: Permission): Promise<Session> => {
    const session = await verifySession()
    if (!hasPermission(session.role, permission)) forbidden()
    return session
  }
)

/**
 * For sensitive actions (change password, delete account, payments): also confirms with
 * the identity system that the session was not revoked. Costs a network round trip.
 */
export const verifySessionFresh = cache(async (): Promise<Session> => {
  const provider = await getAuthProvider()
  const session = await provider.verifySessionFresh()
  if (!session) redirect(SESSION_EXPIRED_PATH)
  return session
})

/**
 * After a Server Action changes data the provider copies into the token (`Session.calendar`):
 * reissues the token so the next request reads the new values. No-op for providers without it.
 */
export async function refreshSessionClaims(): Promise<void> {
  const provider = await getAuthProvider()
  await provider.refreshSession?.()
}
