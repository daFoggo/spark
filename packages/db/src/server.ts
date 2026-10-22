import "server-only"

import { createClient } from "@supabase/supabase-js"

import type { Database } from "./database.types"
import { supabaseEnv } from "./env"

export { unwrap } from "./errors"

/**
 * Client that runs every request as the signed-in user, so RLS applies. New one per request.
 * `options.fetch` lets the app react to responses (e.g. a 401 ends the session).
 */
export function createDataClient(
  accessToken: string,
  options?: { fetch?: typeof fetch }
) {
  return createClient<Database>(supabaseEnv.url, supabaseEnv.publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
      ...(options?.fetch ? { fetch: options.fetch } : {}),
    },
  })
}
