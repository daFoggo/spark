import { z } from "zod"

const LocalDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const TIMES_OF_DAY = ["morning", "afternoon", "evening"] as const
export type TimeOfDay = (typeof TIMES_OF_DAY)[number]

/** HB-2: either a set of weekdays (0 = Sunday .. 6 = Saturday) or every `n` days counted from `starts_on`. */
export const ScheduleSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("days"),
    weekdays: z.array(z.number().int().min(0).max(6)).min(1),
  }),
  z.object({
    kind: z.literal("every"),
    everyN: z.number().int().min(2).max(7),
  }),
])
export type Schedule = z.infer<typeof ScheduleSchema>

/** HB-4: the schedule that applies from `validFrom` on. */
export const ScheduleRowSchema = z.intersection(
  ScheduleSchema,
  z.object({ validFrom: LocalDateSchema })
)
export type ScheduleRow = z.infer<typeof ScheduleRowSchema>

export const HabitSchema = z.object({
  id: z.string(),
  goalId: z.string().nullable(),
  name: z.string(),
  cue: z.string().nullable(),
  fullVersion: z.string().nullable(),
  minimumVersion: z.string().nullable(),
  timeOfDay: z.enum(TIMES_OF_DAY),
  startsOn: LocalDateSchema,
  pausedFrom: LocalDateSchema.nullable(),
  pausedUntil: LocalDateSchema.nullable(),
  archived: z.boolean(),
  schedules: z.array(ScheduleRowSchema),
})
export type Habit = z.infer<typeof HabitSchema>

export const CHECK_IN_LEVELS = ["full", "minimum"] as const
export type CheckInLevel = (typeof CHECK_IN_LEVELS)[number]

export const CheckInSchema = z.object({
  id: z.number(),
  habitId: z.string(),
  date: LocalDateSchema,
  level: z.enum(CHECK_IN_LEVELS),
  note: z.string().nullable(),
})
export type CheckIn = z.infer<typeof CheckInSchema>

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => value || null)

/** Create / edit form (HB-1, HB-2). `weekdays` comes from a multi-value field, `everyN` from a number field. */
export const HabitFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Give the habit a name")
      .max(80, "Keep the name under 80 characters"),
    cue: optionalText(120, "Keep the cue under 120 characters"),
    fullVersion: optionalText(60, "Keep this under 60 characters"),
    minimumVersion: optionalText(60, "Keep this under 60 characters"),
    timeOfDay: z.enum(TIMES_OF_DAY),
    goalId: z.string().uuid().nullable(),
    kind: z.enum(["days", "every"]),
    weekdays: z.array(z.coerce.number().int().min(0).max(6)),
    everyN: z.coerce.number().int().min(2).max(7),
  })
  .refine((value) => value.kind !== "days" || value.weekdays.length > 0, {
    message: "Pick at least one day",
    path: ["weekdays"],
  })
export type HabitForm = z.infer<typeof HabitFormSchema>

export const CheckInInputSchema = z.object({
  habitId: z.string().uuid(),
  date: LocalDateSchema,
  level: z.enum(CHECK_IN_LEVELS),
})

export const NoteInputSchema = z.object({
  habitId: z.string().uuid(),
  date: LocalDateSchema,
  note: z.string().trim().max(280, "Keep the note under 280 characters"),
})
