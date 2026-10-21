import "server-only"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { SESSION_EXPIRED_PATH, SIGN_IN_PATH } from "@/config/routes"

import { getAuthProvider } from "./auth"
import { env } from "./env"
import { ApiError } from "./errors"
import { apiUrl } from "./url"

type ApiFetchOptions = Omit<RequestInit, "headers"> & {
  /** Bearer token; obtain it from the DAL and pass it in. */
  token?: string
  headers?: Record<string, string>
}

/**
 * Thin fetch wrapper for the backend. Resolves with parsed JSON or throws
 * `ApiError`; it never returns fallback data for failures.
 * Only feature `server.ts` files may import this module.
 */
export async function apiFetch<T>(
  path: string,
  { token, headers, ...init }: ApiFetchOptions = {}
): Promise<T> {
  const res = await fetch(apiUrl(env.API_BASE_URL, path), {
    ...init,
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  })

  if (!res.ok) {
    // A token the session still holds was rejected: end the session.
    if (res.status === 401 && token) await endRejectedSession()
    const body = await res.json().catch(() => undefined)
    // The backend answers with RFC 7807 problem details ({ title, detail, status }).
    const detail =
      body &&
      typeof body === "object" &&
      "detail" in body &&
      typeof body.detail === "string"
        ? body.detail
        : undefined
    throw new ApiError(
      res.status,
      detail ?? `Request failed with status ${res.status}`,
      body
    )
  }

  if (res.status === 204) {
    return undefined as T
  }
  const text = await res.text()
  if (!text) {
    return undefined as T
  }
  return JSON.parse(text) as T
}

/**
 * Renders cannot write cookies, so they go through the route that clears the session.
 * A Server Action can only soft-navigate to a page (redirecting it to that route leaves the
 * client stuck on the old UI), so it signs out itself and goes straight to sign-in.
 */
async function endRejectedSession(): Promise<never> {
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
