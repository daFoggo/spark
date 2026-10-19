import { z } from "zod"

const LocalDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const ActivitySchema = z.object({
  id: z.number(),
  date: LocalDateSchema,
  source: z.enum(["habit", "log", "task"]),
  habitId: z.string().nullable(),
  goalId: z.string().nullable(),
  note: z.string().nullable(),
  hours: z.number().nullable(),
  topic: z.string().nullable(),
})
export type Activity = z.infer<typeof ActivitySchema>

/** What the pet and the "Done today" metric need (PT-2, PT-4). */
export type ActivityStats = {
  /** Activities on or after the adoption date. */
  treats: number
  lastActivity: string | null
  doneToday: number
}

const optional = z.string().trim().optional()

/** AC-7: a free log needs a note; hours and topic are optional. */
export const LogFormSchema = z.object({
  note: z
    .string()
    .trim()
    .min(1, "Write what you did")
    .max(280, "Keep it under 280 characters"),
  hours: z
    .union([z.literal(""), z.coerce.number().gt(0).max(24)])
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value))
    .pipe(z.number().multipleOf(0.1).nullable()),
  topic: optional
    .pipe(z.string().max(40, "Keep the topic under 40 characters").optional())
    .transform((value) => value || null),
  date: LocalDateSchema.optional(),
  goalId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
})
export type LogForm = z.infer<typeof LogFormSchema>

export const ActivityIdSchema = z.number().int().positive()
