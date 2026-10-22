import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    // `env.ts` validates at import time, as the apps do at startup.
    env: {
      AUTH_PROVIDER: "supabase",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-key",
    },
  },
})
