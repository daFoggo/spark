import "server-only"

import { createClient } from "@supabase/supabase-js"

import type { Database } from "./database.types"
import { supabaseEnv } from "./env"

export { unwrap } from "./errors"

/**
 * Client that runs every request as the signed-in user, so RLS applies. New one per request.
 */
export function createDataClient(accessToken: string) {
  return createClient<Database>(supabaseEnv.url, supabaseEnv.publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  })
}
