import "server-only"

import { getAuthProvider as getProvider } from "@workspace/auth/server"
import type { AuthProvider } from "@workspace/auth/types"

import { AUTH_OPTIONS } from "@/config/auth"

export type { Calendar, Session, SignUpResult } from "@workspace/auth/types"

/** The active provider (`AUTH_PROVIDER`, docs/providers.md) bound to Spark's cookie. */
export function getAuthProvider(): Promise<AuthProvider> {
  return getProvider(AUTH_OPTIONS)
}
