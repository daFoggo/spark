import "server-only"

import { createServerClient } from "@supabase/ssr"
import { isAuthError } from "@supabase/supabase-js"
import { io } from "next/cache"
import { cookies } from "next/headers"

import { supabaseEnv } from "@workspace/db/env"

import { parseRole } from "../permissions"
import type {
  AuthOptions,
  AuthProvider,
  Calendar,
  Credentials,
  Session,
  SignUpInput,
  SignUpResult,
} from "../types"

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value ? value : null
}

/** Claims a Custom Access Token Hook may add (docs/providers.md §5); absent without one, then pages read settings. */
function calendarOf(claims: Record<string, unknown>): Calendar | undefined {
  const { timezone, week_start: weekStart, adopted_on: adoptedOn } = claims
  return typeof timezone === "string" &&
    typeof weekStart === "number" &&
    typeof adoptedOn === "string"
    ? { timezone, weekStart, adoptedOn }
    : undefined
}

/** New client per request (it is bound to that request's cookies). */
async function createClient(options: AuthOptions) {
  const cookieStore = await cookies()
  return createServerClient(supabaseEnv.url, supabaseEnv.publishableKey, {
    cookieOptions: { name: options.cookieName },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server Components cannot write cookies; the proxy refreshes the session.
        }
      },
    },
  })
}

/** Supabase Auth for one app (its own cookie name). */
export function createSupabaseProvider(options: AuthOptions): AuthProvider {
  return {
    async getSession(): Promise<Session | null> {
      // getClaims checks token expiry against the clock, which must not run during prerender.
      await io()
      const supabase = await createClient(options)
      // getClaims verifies the JWT signature; getSession alone must not be trusted.
      const { data: claims } = await supabase.auth.getClaims()
      const userId = claims?.claims.sub
      if (!userId) return null

      // Only used to forward the (already verified) token to the data client.
      const { data } = await supabase.auth.getSession()
      if (!data.session) return null
      return {
        userId,
        accessToken: data.session.access_token,
        // user_metadata is user-editable: it may supply the display name but never the role.
        role: parseRole(claims.claims.app_metadata?.role),
        name: stringOrNull(claims.claims.user_metadata?.name),
        email: stringOrNull(claims.claims.email),
        calendar: calendarOf(claims.claims),
      }
    },

    async verifySessionFresh(): Promise<Session | null> {
      await io()
      const supabase = await createClient(options)
      // getUser asks the Auth server, so revoked sessions are rejected.
      const { data, error } = await supabase.auth.getUser()
      if (error || !data.user) return null
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) return null
      return {
        userId: data.user.id,
        accessToken: sessionData.session.access_token,
        role: parseRole(data.user.app_metadata.role),
        name: stringOrNull(data.user.user_metadata.name),
        email: data.user.email ?? null,
      }
    },

    async signUp({
      name,
      email,
      password,
    }: SignUpInput): Promise<SignUpResult> {
      const supabase = await createClient(options)
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      })
      if (error) throw error
      // No session means the project requires email confirmation first.
      return data.session ? "signed-in" : "confirm-email"
    },

    async signIn(credentials: Credentials) {
      const supabase = await createClient(options)
      const { error } = await supabase.auth.signInWithPassword(credentials)
      if (error) throw error
    },

    async signOut() {
      const supabase = await createClient(options)
      // "local" ends this browser's session only; the default "global" revokes every device.
      const { error } = await supabase.auth.signOut({ scope: "local" })
      if (error) throw error
    },

    async refreshSession() {
      const supabase = await createClient(options)
      // The hook runs again on refresh; the cookie adapter writes the new token.
      const { error } = await supabase.auth.refreshSession()
      if (error) throw error
    },

    // Auth API rejections carry a 4xx status; network failures and 5xx come as
    // AuthRetryableFetchError with status 0 or 5xx, and are not the user's fault.
    isExpectedError(error) {
      const status = isAuthError(error) ? (error.status ?? 0) : 0
      return status >= 400 && status < 500
    },

    oauth: {
      async start(provider, redirectTo) {
        const supabase = await createClient(options)
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo },
        })
        if (error) throw error
        return data.url
      },

      async exchangeCode(code) {
        const supabase = await createClient(options)
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) throw error
      },
    },
  }
}
