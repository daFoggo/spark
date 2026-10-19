import "server-only"

import { io } from "next/cache"
import { cookies } from "next/headers"
import { z } from "zod"

import { isExpectedApiError } from "@/lib/errors"
import { apiFetch } from "@/lib/http"

import { parseRole } from "../permissions"
import type {
  AuthProvider,
  Credentials,
  Session,
  SignUpInput,
  SignUpResult,
} from "../types"
import {
  cookieName,
  cookieOptions,
  parseExpirationMs,
  seal,
  unseal,
} from "./cookie"

const signInSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expiration: z.union([z.string(), z.number()]),
  refresh_expiration: z.union([z.string(), z.number()]),
  // name/email/role are optional: a backend that only returns `id` still works (role = member).
  user_info: z.object({
    id: z.string(),
    name: z.string().nullish(),
    email: z.string().nullish(),
    role: z.unknown(),
  }),
})

export const backendProvider: AuthProvider = {
  async getSession(): Promise<Session | null> {
    // Date.now() below must not run during prerender. io() suspends only there; unlike
    // connection() it resolves inside "use cache: private" and does not block prefetches.
    await io()
    const session = await unseal((await cookies()).get(cookieName())?.value)
    // The seal is authenticated encryption, so the userId can be trusted without
    // asking the backend. The backend still checks the token on every API call.
    if (!session || session.accessExpiresAt <= Date.now()) return null
    return {
      userId: session.userId,
      accessToken: session.accessToken,
      role: session.role,
      name: session.name,
      email: session.email,
    }
  },

  // The backend validates the token and the user's status on every call, so a
  // "fresh" check is the same as a normal session read here.
  async verifySessionFresh(): Promise<Session | null> {
    return backendProvider.getSession()
  },

  async signUp(input: SignUpInput): Promise<SignUpResult> {
    await apiFetch<unknown>("auth/sign-up", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    await backendProvider.signIn({
      email: input.email,
      password: input.password,
    })
    return "signed-in"
  },

  async signIn(credentials: Credentials) {
    const body = signInSchema.parse(
      await apiFetch<unknown>("auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      })
    )
    const session = {
      userId: body.user_info.id,
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      accessExpiresAt: parseExpirationMs(body.expiration),
      refreshExpiresAt: parseExpirationMs(body.refresh_expiration),
      role: parseRole(body.user_info.role),
      name: body.user_info.name ?? null,
      email: body.user_info.email ?? credentials.email,
    }
    const store = await cookies()
    store.set(cookieName(), await seal(session), cookieOptions(session))
  },

  async signOut() {
    const store = await cookies()
    store.delete(cookieName())
  },

  isExpectedError: isExpectedApiError,
}
