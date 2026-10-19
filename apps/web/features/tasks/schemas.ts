import { z } from "zod"

const LocalDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const TASK_LISTS = ["today", "later"] as const
export type TaskList = (typeof TASK_LISTS)[number]

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  note: z.string().nullable(),
  goalId: z.string().nullable(),
  list: z.enum(TASK_LISTS),
  createdOn: LocalDateSchema,
  doneOn: LocalDateSchema.nullable(),
})
export type Task = z.infer<typeof TaskSchema>

/** The three tabs of the Tasks page (`?tab=`). */
export const TASK_TABS = ["today", "later", "done"] as const
export type TaskTab = (typeof TASK_TABS)[number]

export const AddTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Write the task first")
    .max(200, "Keep the task under 200 characters"),
  list: z.enum(TASK_LISTS),
  goalId: z.string().uuid().nullable(),
})

export const TaskNoteSchema = z.object({
  taskId: z.string().uuid(),
  note: z.string().trim().max(2000, "Keep the note under 2000 characters"),
})

export const TaskIdSchema = z.string().uuid()
