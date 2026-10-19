import { z } from "zod"

/** What the app knows about the user's preferences (spec TM-2, TM-4, PT-1). Dates are `YYYY-MM-DD`. */
export const SettingsSchema = z.object({
  timezone: z.string().min(1),
  timezoneConfirmed: z.boolean(),
  /** 0 = Sunday .. 6 = Saturday. */
  weekStart: z.number().int().min(0).max(6),
  petName: z.string().min(1).max(20),
  adoptedOn: z.string(),
})
export type Settings = z.infer<typeof SettingsSchema>

/** Sent once by the browser on the first visit (TM-2, TM-4). */
export const DetectedLocaleSchema = z.object({
  timezone: z.string().min(1).max(64),
  weekStart: z.number().int().min(0).max(6),
})
export type DetectedLocale = z.infer<typeof DetectedLocaleSchema>

export const UpdateSettingsSchema = z.object({
  timezone: z.string().min(1).max(64),
  weekStart: z.coerce.number().int().min(0).max(6),
  petName: z
    .string()
    .trim()
    .min(1, "Give your pet a name")
    .max(20, "Keep the name under 20 characters"),
})
