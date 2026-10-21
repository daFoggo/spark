import type { NextRequest } from "next/server"

import type { ProxyAuthResult } from "./types"

/** Entry used by `proxy.ts`. Not `server-only`: the proxy runs outside the RSC graph. */
export async function updateSession(
  request: NextRequest
): Promise<ProxyAuthResult> {
  return (await import("./better-auth/proxy")).updateSession(request)
}
