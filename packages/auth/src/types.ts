import type { NextResponse } from "next/server"

import type { Role } from "./permissions"

/** Per-app settings. Each app has its own cookie so web and admin sessions stay apart (both run on localhost in dev). */
export type AuthOptions = { cookieName: string }

/**
 * Provider-agnostic session. `accessToken` goes to the data backend (PostgREST) as Bearer. `role` comes
 * from a source the user cannot edit; it drives UI and early checks, and the backend still authorizes every call.
 */
export type Session = {
  userId: string
  accessToken: string
  role: Role
  name: string | null
  email: string | null
  /** Set when the provider copies the calendar preferences into the token (saves a settings read). */
  calendar?: Calendar
}

/**
 * The dates the app counts from: timezone (IANA) and week start (0 = Sunday .. 6 = Saturday), spec
 * TM-2, TM-4; `adoptedOn` (`YYYY-MM-DD`, PT-1) never changes after sign-up. A Custom Access Token Hook
 * may copy them into the token (docs/providers.md §5).
 */
export type Calendar = {
  timezone: string
  weekStart: number
  adoptedOn: string
}

export type Credentials = {
  email: string
  password: string
}

export type SignUpInput = Credentials & { name: string }

/** `confirm-email`: the account exists but the user must confirm their email first. */
export type SignUpResult = "signed-in" | "confirm-email"

/** Server-side contract (Server Components, Server Actions, Route Handlers). */
export interface AuthProvider {
  /** Verified session, or null. Must not refresh tokens (the proxy does that). */
  getSession(): Promise<Session | null>
  /**
   * Like `getSession`, but also asks the Auth server whether the session is still valid (not revoked).
   * Use before sensitive actions.
   */
  verifySessionFresh(): Promise<Session | null>
  /** Throws on invalid credentials. Only callable from a Server Action / Route Handler. */
  signIn(credentials: Credentials): Promise<void>
  /** Creates an account. Throws when the data is rejected (e.g. email already used). */
  signUp(input: SignUpInput): Promise<SignUpResult>
  signOut(): Promise<void>
  /**
   * Reissues the token so the claims copied from user data (`calendar`) are current. Only providers
   * that set `calendar` implement it; call it from the Server Action that changed that data.
   */
  refreshSession?(): Promise<void>
  /**
   * True when the Auth server rejected the input (wrong password, email taken, weak password, rate limit): safe
   * to show in the form. Anything else (network, 5xx) is an outage and must be rethrown.
   */
  isExpectedError(error: unknown): boolean
  /** Social login (redirect flow). Only providers that support it implement this. */
  oauth?: {
    /** Returns the URL to send the browser to. */
    start(provider: "google", redirectTo: string): Promise<string>
    /** Completes the flow on the callback route. Throws on failure. */
    exchangeCode(code: string): Promise<void>
  }
}

export type ProxyAuthResult = {
  /** Response to return from `proxy.ts` (carries refreshed cookies). */
  response: NextResponse
  /** Optimistic: a session exists. Real authorization is done in the DAL. */
  isAuthenticated: boolean
  /** Role from the token, `null` when signed out. Optimistic, like `isAuthenticated`. */
  role: Role | null
}
