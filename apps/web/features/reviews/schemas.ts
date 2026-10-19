import { z } from "zod"

const LocalDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const HABIT_CHOICES = ["keep", "easier", "pause"] as const
export type HabitChoice = (typeof HABIT_CHOICES)[number]

/** RV-4: at most three focus tasks. */
export const FOCUS_LIMIT = 3

export const ReviewSchema = z.object({
  id: z.string(),
  weekStartOn: LocalDateSchema,
  reflection: z.string().nullable(),
  habitChoices: z.record(z.string(), z.enum(HABIT_CHOICES)),
  focusTaskIds: z.array(z.string()),
  completedAt: z.string().nullable(),
})
export type Review = z.infer<typeof ReviewSchema>

/** What the browser sends when the review is finished (RV-1…RV-4). */
export const CompleteReviewSchema = z.object({
  weekStart: LocalDateSchema,
  reflection: z
    .string()
    .trim()
    .max(2000, "Keep the note under 2000 characters"),
  choices: z.record(z.string().uuid(), z.enum(HABIT_CHOICES)),
  focusTaskIds: z
    .array(z.string().uuid())
    .max(FOCUS_LIMIT, "Pick up to 3 focus tasks"),
})
export type CompleteReviewInput = z.infer<typeof CompleteReviewSchema>
