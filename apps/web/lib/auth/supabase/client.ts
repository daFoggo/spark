import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { authConfig } from "../config"

/** New client per request (it is bound to that request's cookies). */
export async function createClient() {
  if (authConfig.AUTH_PROVIDER !== "supabase") {
    throw new Error(
      "Supabase client used while AUTH_PROVIDER is not 'supabase'"
    )
  }
  const cookieStore = await cookies()
  return createServerClient(
    authConfig.NEXT_PUBLIC_SUPABASE_URL,
    authConfig.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Server Components cannot write cookies; the proxy refreshes the session.
          }
        },
      },
    }
  )
}
