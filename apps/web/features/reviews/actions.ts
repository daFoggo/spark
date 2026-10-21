"use server"

import { updateTag } from "next/cache"

import { habitsTag, reviewsTag, tasksTag } from "@/lib/cache-tags"
import { verifySession } from "@/lib/dal"
import { isExpectedApiError } from "@/lib/errors"

import { CompleteReviewSchema, type CompleteReviewInput } from "./schemas"
import { completeReview } from "./server"

export type ReviewState = { error?: string; saved?: boolean }

/**
 * RV-5: finish the review. The database applies the pauses (RV-3) and the focus tasks (RV-4) in the
 * same transaction, so habits and tasks are invalidated along with the review.
 */
export async function completeReviewAction(
  input: CompleteReviewInput
): Promise<ReviewState> {
  const { userId, accessToken } = await verifySession()
  const parsed = CompleteReviewSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid review" }
  }
  try {
    await completeReview(accessToken, parsed.data)
  } catch (error) {
    if (isExpectedApiError(error)) {
      return { error: error.message.replace(/^[A-Z]{2}-\d+:\s*/, "") }
    }
    throw error
  }
  updateTag(reviewsTag(userId))
  updateTag(habitsTag(userId))
  updateTag(tasksTag(userId))
  return { saved: true }
}
