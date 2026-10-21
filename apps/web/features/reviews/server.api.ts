import "server-only"

import type { LocalDate } from "@/lib/dates"
import { ApiError } from "@/lib/errors"
import { apiFetch } from "@/lib/http"

import { ReviewSchema, type CompleteReviewInput, type Review } from "./schemas"

/** The review of the week starting on `weekStart`, or `null` when none was saved yet (RV-1). */
export async function fetchReview(
  accessToken: string,
  weekStart: LocalDate
): Promise<Review | null> {
  try {
    const raw = await apiFetch<unknown>(`reviews/${weekStart}`, {
      token: accessToken,
    })
    return ReviewSchema.parse(raw)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

/** RV-1…RV-5: one API call saves the review, pauses habits and queues focus tasks together. */
export async function completeReview(
  accessToken: string,
  input: CompleteReviewInput
): Promise<void> {
  await apiFetch<void>(`reviews/${input.weekStart}`, {
    token: accessToken,
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      reflection: input.reflection,
      choices: input.choices,
      focusTaskIds: input.focusTaskIds,
    }),
  })
}
