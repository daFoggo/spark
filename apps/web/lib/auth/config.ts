import { z } from "zod"

/**
 * Auth environment. `AUTH_PROVIDER` picks the whole stack (docs/providers.md): `better-auth` = Better Auth +
 * FastAPI, `supabase` = Supabase Auth + PostgREST. Each branch lists only its own variables.
 * Not `server-only` so `proxy.ts` can read it; client components must not import it (ESLint rule).
 * `process.env.X` is referenced literally so `NEXT_PUBLIC_*` stay inlinable.
 */
const authSchema = z.discriminatedUnion("AUTH_PROVIDER", [
  z.object({
    AUTH_PROVIDER: z.literal("better-auth"),
    BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
    BETTER_AUTH_SECRET: z.string().min(32),
    DATABASE_URL: z.string().min(1),
    API_AUDIENCE: z.string().min(1).default("http://localhost:2210"),
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

export const authConfig: AuthConfig = authSchema.parse({
  AUTH_PROVIDER: process.env.AUTH_PROVIDER || "better-auth",
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  BETTER_AUTH_SECRET:
    process.env.BETTER_AUTH_SECRET ||
    "placeholder-secret-at-least-32-characters-long",
  DATABASE_URL:
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:2211/spark",
  API_AUDIENCE: process.env.API_AUDIENCE,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
})
