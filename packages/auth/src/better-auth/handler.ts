import { toNextJsHandler } from "better-auth/next-js"

import { authConfig } from "../config"
import type { AuthOptions } from "../types"
import { getBetterAuth } from "./auth"

const notFound = () => new Response(null, { status: 404 })

/** Route handlers for `app/api/auth/[...all]/route.ts`. Better Auth's endpoints exist only on its own stack. */
export function createBetterAuthHandler(options: AuthOptions) {
  return authConfig.AUTH_PROVIDER === "better-auth"
    ? toNextJsHandler(getBetterAuth(options))
    : { GET: notFound, POST: notFound }
}
