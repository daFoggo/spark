import "server-only"

import type { LocalDate } from "@/lib/dates"
import { createDataClient, DataError } from "@/lib/supabase/data"

import { ReviewSchema, type CompleteReviewInput, type Review } from "./schemas"

const COLUMNS =
  "id, week_start_on, reflection, habit_choices, focus_task_ids, completed_at"

/** The review of the week starting on `weekStart`, or `null` when none was saved yet (RV-1). */
export async function fetchReview(
  accessToken: string,
  weekStart: LocalDate
): Promise<Review | null> {
  const { data, error } = await createDataClient(accessToken)
    .from("reviews")
    .select(COLUMNS)
    .eq("week_start_on", weekStart)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return ReviewSchema.parse({
    id: data.id,
    weekStartOn: data.week_start_on,
    reflection: data.reflection,
    habitChoices: data.habit_choices,
    focusTaskIds: data.focus_task_ids,
    completedAt: data.completed_at,
  })
}

/** RV-1…RV-5: one RPC saves the review, pauses habits and queues focus tasks together. */
export async function completeReview(
  accessToken: string,
  input: CompleteReviewInput
): Promise<void> {
  const { error } = await createDataClient(accessToken).rpc("complete_review", {
    p_week_start: input.weekStart,
    p_reflection: input.reflection,
    p_choices: input.choices,
    p_focus: input.focusTaskIds,
  })
  if (error) throw new DataError(error.code, error.message)
}
