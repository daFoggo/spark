import "server-only"

import type { AuthProvider } from "./types"

export type { Credentials, Session, SignUpInput, SignUpResult } from "./types"

/** The active provider (Better Auth). */
export async function getAuthProvider(): Promise<AuthProvider> {
  return (await import("./better-auth/server")).betterAuthProvider
}
