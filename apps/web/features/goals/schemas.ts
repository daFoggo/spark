import { z } from "zod"

const LocalDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const GOAL_STATUSES = ["active", "someday", "done", "archived"] as const
export type GoalStatus = (typeof GOAL_STATUSES)[number]

export const CheckpointSchema = z.object({
  id: z.string(),
  goalId: z.string(),
  title: z.string(),
  position: z.number(),
  doneOn: LocalDateSchema.nullable(),
})
export type Checkpoint = z.infer<typeof CheckpointSchema>

export const GoalSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  why: z.string().nullable(),
  becoming: z.string().nullable(),
  targetDate: LocalDateSchema.nullable(),
  ifHardObstacle: z.string().nullable(),
  ifHardPlan: z.string().nullable(),
  status: z.enum(GOAL_STATUSES),
  checkpoints: z.array(CheckpointSchema),
})
export type Goal = z.infer<typeof GoalSchema>

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => value || null)

/** Edit form (GL-1). Only the name is required. */
export const GoalFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the goal a name")
    .max(120, "Keep the name under 120 characters"),
  why: optionalText(500, "Keep this under 500 characters"),
  becoming: optionalText(60, "Keep this under 60 characters"),
  targetDate: z
    .string()
    .trim()
    .transform((value) => value || null)
    .pipe(LocalDateSchema.nullable()),
  ifHardObstacle: optionalText(280, "Keep this under 280 characters"),
  ifHardPlan: optionalText(280, "Keep this under 280 characters"),
})
export type GoalForm = z.infer<typeof GoalFormSchema>

export const NewGoalSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the goal a name")
    .max(120, "Keep the name under 120 characters"),
})

export const GoalIdSchema = z.string().uuid()

export const CheckpointTitleSchema = z
  .string()
  .trim()
  .min(1, "Write the checkpoint first")
  .max(120, "Keep it under 120 characters")

export const CheckpointPositionSchema = z
  .number()
  .int()
  .nonnegative()
  .max(2_147_483_647)

export const CheckpointMoveSchema = z.literal(-1).or(z.literal(1))
