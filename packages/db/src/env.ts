import { z } from "zod"

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
})

export type SupabaseEnv = { url: string; publishableKey: string }

/** Validates the two public Supabase variables; the error names every one that is missing or malformed. */
export function parseSupabaseEnv(
  raw: Record<string, string | undefined>
): SupabaseEnv {
  const result = schema.safeParse(raw)
  if (!result.success) {
    const names = [
      ...new Set(result.error.issues.map((issue) => issue.path.join("."))),
    ]
    throw new Error(`Invalid Supabase env: ${names.join(", ")}`)
  }
  return {
    url: result.data.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: result.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  }
}

/**
 * Read once per process. Each variable is referenced literally so Next can inline it in client bundles.
 * Publishable key only: a secret / service_role key must never be used by the apps.
 */
export const supabaseEnv: SupabaseEnv = parseSupabaseEnv({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
})
