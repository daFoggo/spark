import "server-only"

import { io } from "next/cache"
import { headers } from "next/headers"
import { APIError } from "better-auth/api"

import { parseRole } from "../permissions"
import type {
  AuthProvider,
  Credentials,
  Session,
  SignUpInput,
  SignUpResult,
} from "../types"
import { auth } from "./auth"

export const betterAuthProvider: AuthProvider = {
  async getSession(): Promise<Session | null> {
    // Better Auth checks token/cookie expiry against Date.now(), which must not run during prerender.
    // io() suspends only during prerender; unlike connection() it resolves inside "use cache: private"
    // and does not block prefetches.
    await io()
    const reqHeaders = await headers()
    const session = await auth.api.getSession({
      headers: reqHeaders,
    })
    if (!session) return null

    const tokenRes = await auth.api.getToken({
      headers: reqHeaders,
    })
    const accessToken =
      typeof tokenRes === "string" ? tokenRes : tokenRes?.token ?? ""

    return {
      userId: session.user.id,
      accessToken,
      role: parseRole((session.user as { role?: string }).role),
      name: session.user.name ?? null,
      email: session.user.email ?? null,
    }
  },

  async verifySessionFresh(): Promise<Session | null> {
    await io()
    const reqHeaders = await headers()
    const session = await auth.api.getSession({
      headers: reqHeaders,
      query: { disableCookieCache: true },
    })
    if (!session) return null

    const tokenRes = await auth.api.getToken({
      headers: reqHeaders,
    })
    const accessToken =
      typeof tokenRes === "string" ? tokenRes : tokenRes?.token ?? ""

    return {
      userId: session.user.id,
      accessToken,
      role: parseRole((session.user as { role?: string }).role),
      name: session.user.name ?? null,
      email: session.user.email ?? null,
    }
  },

  async signIn(credentials: Credentials): Promise<void> {
    await auth.api.signInEmail({
      body: {
        email: credentials.email,
        password: credentials.password,
      },
      headers: await headers(),
    })
  },

  async signUp(input: SignUpInput): Promise<SignUpResult> {
    await auth.api.signUpEmail({
      body: {
        name: input.name,
        email: input.email,
        password: input.password,
      },
      headers: await headers(),
    })
    return "signed-in"
  },

  async signOut(): Promise<void> {
    await auth.api.signOut({
      headers: await headers(),
    })
  },

  isExpectedError(error: unknown): boolean {
    if (error instanceof APIError) {
      const status = error.statusCode ?? error.status ?? 500
      return status >= 400 && status < 500
    }
    return false
  },

  oauth: {
    async start(provider: "google", redirectTo: string): Promise<string> {
      const res = await auth.api.signInSocial({
        body: {
          provider: "google",
          callbackURL: redirectTo,
        },
        headers: await headers(),
      })
      if (!res?.url) {
        throw new Error("Social sign in did not return redirect URL")
      }
      return res.url
    },
    async exchangeCode(_code: string): Promise<void> {
      // Handled by Better Auth route handler
    },
  },
}
