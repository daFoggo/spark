import { createBetterAuthHandler } from "@workspace/auth/better-auth-handler"

import { AUTH_OPTIONS } from "@/config/auth"

// Better Auth's endpoints exist only on the Better Auth stack (404 on Supabase).
export const { GET, POST } = createBetterAuthHandler(AUTH_OPTIONS)
