import "server-only"

import { authConfig } from "./config"
import type { AuthProvider } from "./types"

export type { Credentials, Session, SignUpInput, SignUpResult } from "./types"

/** The active provider, chosen once per deployment via `AUTH_PROVIDER`. */
export async function getAuthProvider(): Promise<AuthProvider> {
  if (authConfig.AUTH_PROVIDER === "better-auth") {
    return (await import("./better-auth/server")).betterAuthProvider
  }
  if (authConfig.AUTH_PROVIDER === "supabase") {
    return (await import("./supabase/server")).supabaseProvider
  }
  return (await import("./backend/server")).backendProvider
}
