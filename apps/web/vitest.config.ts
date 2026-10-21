import { fileURLToPath } from "node:url"
import { configDefaults, defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    exclude: [...configDefaults.exclude, "e2e/**"],
    env: {
      AUTH_PROVIDER: "backend",
      API_BASE_URL: "http://localhost:8099/api/v1/",
      SESSION_SECRET: "test-secret-test-secret-test-secret-123",
    },
  },
})
