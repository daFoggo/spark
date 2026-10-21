import "server-only"

import { authConfig } from "./config"
import type { AuthProvider } from "./types"

export type {
  Calendar,
  Credentials,
  Session,
  SignUpInput,
  SignUpResult,
} from "./types"

/** The active provider, chosen once per deployment via `AUTH_PROVIDER` (docs/providers.md). */
export async function getAuthProvider(): Promise<AuthProvider> {
  if (authConfig.AUTH_PROVIDER === "supabase") {
    return (await import("./supabase/server")).supabaseProvider
  }
  return (await import("./better-auth/server")).betterAuthProvider
}
