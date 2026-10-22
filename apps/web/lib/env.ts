import "server-only"

import { z } from "zod"

/**
 * Validated server-side environment. Server-only: secrets never reach the client.
 * Public (`NEXT_PUBLIC_*`) variables live in `env.public.ts`.
 *
 * Every variable read here must also be declared in `turbo.json` (`build.env`),
 * otherwise Turborepo's strict env mode hides it from the task.
 */
const serverSchema = z.object({
  API_BASE_URL: z.url().default("http://localhost:2210"),
})

export const env = serverSchema.parse({
  API_BASE_URL: process.env.API_BASE_URL,
})
