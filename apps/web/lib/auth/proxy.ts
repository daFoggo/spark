import type { NextRequest } from "next/server"

import { authConfig } from "./config"
import type { ProxyAuthResult } from "./types"

/** Entry used by `proxy.ts`. Not `server-only`: the proxy runs outside the RSC graph. */
export async function updateSession(
  request: NextRequest
): Promise<ProxyAuthResult> {
  if (authConfig.AUTH_PROVIDER === "better-auth") {
    return (await import("./better-auth/proxy")).updateSession(request)
  }
  if (authConfig.AUTH_PROVIDER === "supabase") {
    return (await import("./supabase/proxy")).updateSession(request)
  }
  return (await import("./backend/proxy")).updateSession(request)
}
