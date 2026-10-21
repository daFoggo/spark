import { toNextJsHandler } from "better-auth/next-js"

import { auth } from "@/lib/auth/better-auth/auth"
import { authConfig } from "@/lib/auth/config"

const handler = toNextJsHandler(auth)
const notFound = () => new Response(null, { status: 404 })

// Better Auth's endpoints exist only on the Better Auth stack.
export const { GET, POST } =
  authConfig.AUTH_PROVIDER === "better-auth"
    ? handler
    : { GET: notFound, POST: notFound }
