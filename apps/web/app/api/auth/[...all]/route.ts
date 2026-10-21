import { toNextJsHandler } from "better-auth/next-js"

import { auth } from "@/lib/auth/better-auth/auth"

export const { GET, POST } = toNextJsHandler(auth)
