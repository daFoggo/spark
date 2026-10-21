import { z } from "zod"

export const authConfig = z
  .object({
    AUTH_PROVIDER: z.literal("better-auth").default("better-auth"),
    BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
    BETTER_AUTH_SECRET: z.string().min(32),
    DATABASE_URL: z.string().min(1),
    API_AUDIENCE: z.string().min(1).default("http://localhost:8000"),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
  })
  .parse({
    AUTH_PROVIDER: process.env.AUTH_PROVIDER || "better-auth",
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    BETTER_AUTH_SECRET:
      process.env.BETTER_AUTH_SECRET ||
      "placeholder-secret-at-least-32-characters-long",
    DATABASE_URL:
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5432/spark",
    API_AUDIENCE: process.env.API_AUDIENCE,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  })
