import "server-only"

import { createClient } from "@supabase/supabase-js"

import { authConfig } from "../auth/config"
import type { Database } from "./database.types"

/**
 * Typed Supabase client for feature data. It sends the caller's access token, so Postgres runs the
 * request as that user and Row Level Security applies. The token comes from the DAL (`verifySession`)
 * and is passed in by `queries.ts` / `actions.ts`; it never becomes part of a cache key.
 * There is no service-role client in this app. Only feature `server.ts` files may import this module.
 */
export function createDataClient(accessToken: string) {
  if (authConfig.AUTH_PROVIDER !== "supabase") {
    throw new Error("Feature data needs AUTH_PROVIDER=supabase")
  }
  return createClient<Database>(
    authConfig.NEXT_PUBLIC_SUPABASE_URL,
    authConfig.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )
}

/** Postgres error codes that mean "the request was rejected", as opposed to a bug or an outage. */
const EXPECTED_CODES = new Set(["23505", "23514", "23503", "P0001", "42501"])

export class DataError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message)
    this.name = "DataError"
  }

  /** Rule violations raised by our triggers/functions carry the rule ID, e.g. "GL-3: ...". */
  get expected(): boolean {
    return EXPECTED_CODES.has(this.code)
  }
}

/** Throws a `DataError` for a failed Supabase call; otherwise returns the (non-null) data. */
export function unwrap<T>(result: {
  data: T
  error: { code: string; message: string } | null
}): NonNullable<T> {
  if (result.error) {
    throw new DataError(result.error.code, result.error.message)
  }
  if (result.data === null || result.data === undefined) {
    throw new DataError("PGRST116", "No data returned")
  }
  return result.data
}
