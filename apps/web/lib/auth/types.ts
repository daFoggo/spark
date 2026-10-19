import type { NextResponse } from "next/server"

import type { Role } from "./permissions"

/**
 * Provider-agnostic session. `accessToken` is sent as Bearer to the backend.
 * `role` comes from a source the user cannot edit and only drives UI and early checks;
 * the backend still authorizes every call.
 */
export type Session = {
  userId: string
  accessToken: string
  role: Role
  name: string | null
  email: string | null
}

export type Credentials = {
  email: string
  password: string
}

export type SignUpInput = Credentials & { name: string }

/** `confirm-email`: the account exists but the user must confirm their email first. */
export type SignUpResult = "signed-in" | "confirm-email"

/** Server-side contract (Server Components, Server Actions). */
export interface AuthProvider {
  /** Verified session, or null. Must not refresh tokens (the proxy does that). */
  getSession(): Promise<Session | null>
  /**
   * Like `getSession`, but also asks the identity system whether the session is still
   * valid (not revoked). Use before sensitive actions (change password, delete account).
   */
  verifySessionFresh(): Promise<Session | null>
  /** Throws on invalid credentials. Only callable from a Server Action / Route Handler. */
  signIn(credentials: Credentials): Promise<void>
  /** Creates an account. Throws when the data is rejected (e.g. email already used). */
  signUp(input: SignUpInput): Promise<SignUpResult>
  signOut(): Promise<void>
  /**
   * True when `signIn` / `signUp` / `oauth.start` failed because the identity system rejected the
   * input (wrong password, email taken, weak password, rate limit): safe to show in the form.
   * Anything else (network, 5xx, unexpected response) is a bug or outage and must be rethrown.
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
}
