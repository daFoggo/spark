import { sealData, unsealData } from "iron-session"
import type { NextResponse } from "next/server"
import { z } from "zod"

import { authConfig } from "../config"
import { ROLES, type Role } from "../permissions"

/**
 * The whole backend session lives in one encrypted + signed httpOnly cookie
 * (iron-session seal). Decrypting it locally is how `getSession` knows the user
 * without calling the backend on every request. Expiries are epoch milliseconds.
 */
export type BackendSession = {
  userId: string
  accessToken: string
  refreshToken: string
  accessExpiresAt: number
  refreshExpiresAt: number
  role: Role
  name: string | null
  email: string | null
}

// Defaults keep cookies sealed before role/name/email existed valid (no forced sign-out).
const sessionSchema = z.object({
  userId: z.string(),
  accessToken: z.string(),
  refreshToken: z.string(),
  accessExpiresAt: z.number(),
  refreshExpiresAt: z.number(),
  role: z.enum(ROLES).default("member"),
  name: z.string().nullable().default(null),
  email: z.string().nullable().default(null),
})

export const ACCESS_REFRESH_SKEW_MS = 2 * 60 * 1000

function backendConfig() {
  if (authConfig.AUTH_PROVIDER !== "backend") {
    throw new Error("backend cookie used while AUTH_PROVIDER is not 'backend'")
  }
  return authConfig
}

export const cookieName = (): string => backendConfig().SESSION_COOKIE_NAME

export const cookieOptions = (session: BackendSession) =>
  ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(session.refreshExpiresAt),
  }) as const

export async function seal(session: BackendSession): Promise<string> {
  const ttl = Math.max(
    1,
    Math.floor((session.refreshExpiresAt - Date.now()) / 1000)
  )
  return sealData(session, { password: backendConfig().SESSION_SECRET, ttl })
}

/** Returns null for a missing, tampered, expired or malformed cookie. */
export async function unseal(
  raw: string | undefined
): Promise<BackendSession | null> {
  if (!raw) return null
  try {
    const data = await unsealData(raw, {
      password: backendConfig().SESSION_SECRET,
    })
    const parsed = sessionSchema.safeParse(data)
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/** Accepts ISO strings or unix seconds/milliseconds (backend format is not fixed). */
export function parseExpirationMs(raw: string | number): number {
  if (typeof raw === "number") return raw > 1e12 ? raw : raw * 1000
  const iso = Date.parse(raw)
  if (!Number.isNaN(iso)) return iso
  const n = Number(raw)
  return n > 1e12 ? n : n * 1000
}

export async function setOnResponse(
  response: NextResponse,
  session: BackendSession
) {
  response.cookies.set(
    cookieName(),
    await seal(session),
    cookieOptions(session)
  )
}
