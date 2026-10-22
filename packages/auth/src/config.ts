import { z } from "zod"

/**
 * Auth environment. `AUTH_PROVIDER` picks the whole stack (docs/providers.md): `supabase` (default) = Supabase Auth +
 * PostgREST, `better-auth` = identity foundation only. Each branch lists only its own variables.
 * Not `server-only` so `proxy.ts` can read it; client components must not import it (ESLint rule).
 * `process.env.X` is referenced literally so `NEXT_PUBLIC_*` stay inlinable.
 */
const authSchema = z.discriminatedUnion("AUTH_PROVIDER", [
  z.object({
    AUTH_PROVIDER: z.literal("better-auth"),
    BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
    BETTER_AUTH_SECRET: z.string().min(32),
    DATABASE_URL: z.string().min(1),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
  }),
  z.object({
    AUTH_PROVIDER: z.literal("supabase"),
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  }),
])

export type AuthConfig = z.infer<typeof authSchema>

type AuthEnv = Partial<
  Record<
    | "AUTH_PROVIDER"
    | "NEXT_PHASE"
    | "BETTER_AUTH_URL"
    | "BETTER_AUTH_SECRET"
    | "DATABASE_URL"
    | "GOOGLE_CLIENT_ID"
    | "GOOGLE_CLIENT_SECRET"
    | "NEXT_PUBLIC_SUPABASE_URL"
    | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    string | undefined
  >
>

// `next build` imports the modules to collect page data without the runtime secrets, so only the build gets
// placeholders. At runtime a missing secret must fail, never fall back to a value that is public in this repo.
const BUILD_SECRET = "placeholder-secret-at-least-32-characters-long"
const BUILD_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/spark"

export function parseAuthConfig(env: AuthEnv): AuthConfig {
  const building = env.NEXT_PHASE === "phase-production-build"
  return authSchema.parse({
    AUTH_PROVIDER: env.AUTH_PROVIDER || "supabase",
    BETTER_AUTH_URL: env.BETTER_AUTH_URL,
    BETTER_AUTH_SECRET:
      env.BETTER_AUTH_SECRET || (building ? BUILD_SECRET : undefined),
    DATABASE_URL: env.DATABASE_URL || (building ? BUILD_DATABASE_URL : undefined),
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  })
}

export const authConfig: AuthConfig = parseAuthConfig({
  AUTH_PROVIDER: process.env.AUTH_PROVIDER,
  NEXT_PHASE: process.env.NEXT_PHASE,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  DATABASE_URL: process.env.DATABASE_URL,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
})
