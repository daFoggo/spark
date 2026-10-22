import "server-only"

import { authConfig } from "@workspace/auth/config"
import { DataError, unwrap as unwrapResult } from "@workspace/db/errors"
import { createDataClient as createClient } from "@workspace/db/server"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { SESSION_EXPIRED_PATH, SIGN_IN_PATH } from "@/config/routes"

import { getAuthProvider } from "./auth"

export { DataError } from "@workspace/db/errors"

/**
 * Renders cannot write cookies, so they go through the route that clears the session.
 * A Server Action can only soft-navigate to a page (redirecting it to that route leaves the
 * client stuck on the old UI), so it signs out itself and goes straight to sign-in.
 */
export async function endRejectedSession(): Promise<never> {
  if ((await headers()).has("next-action")) {
    try {
      await (await getAuthProvider()).signOut()
    } catch {
      // Still leave: the proxy cannot refresh a rejected session either.
    }
    redirect(SIGN_IN_PATH)
  }
  redirect(SESSION_EXPIRED_PATH)
}

/** A response PostgREST rejects because of the token (401, or the JWT error codes). */
function isRejectedToken(error: { code: string } | null, status?: number) {
  return (
    status === 401 || error?.code === "PGRST301" || error?.code === "PGRST303"
  )
}

type Result = {
  error: { code: string; message: string } | null
  status?: number
}

/**
 * Ends the session when PostgREST rejected the token, otherwise throws a `DataError` for a failed
 * call and returns the result. The redirect must happen here, not in the client's `fetch` hook:
 * postgrest-js retries and swallows errors thrown from `fetch`, so the redirect never reaches Next.
 */
export async function ensureOk<R extends Result>(result: R): Promise<R> {
  if (result.error) {
    if (isRejectedToken(result.error, result.status)) await endRejectedSession()
    throw new DataError(result.error.code, result.error.message)
  }
  return result
}

/** `unwrap` from `@workspace/db/errors`, plus ending the session on a rejected token. */
export async function unwrap<T>(
  result: Result & { data: T }
): Promise<NonNullable<T>> {
  await ensureOk(result)
  return unwrapResult(result)
}

/**
 * Typed Supabase client for feature data. It sends the caller's access token, so Postgres runs the
 * request as that user and Row Level Security applies. The token comes from the DAL (`verifySession`)
 * and is passed in by `queries.ts` / `actions.ts`; it never becomes part of a cache key.
 * There is no service-role client in this app. Only feature `server.ts` files may import this module.
 */
export function createDataClient(accessToken: string) {
  if (authConfig.AUTH_PROVIDER !== "supabase") {
    throw new Error("Feature data needs AUTH_PROVIDER=supabase")
  }
  return createClient(accessToken)
}
