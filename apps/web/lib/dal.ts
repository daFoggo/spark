import "server-only"

import { cache } from "react"
import { forbidden, redirect } from "next/navigation"

import { SESSION_EXPIRED_PATH } from "@/config/routes"

import { getAuthProvider, type Session } from "./auth"
import { hasPermission, type Permission } from "./auth/permissions"

export type { Session }

/** Data Access Layer entry point. Memoized per request via React `cache`. */
export const getSession = cache(async (): Promise<Session | null> => {
  const provider = await getAuthProvider()
  return provider.getSession()
})

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
