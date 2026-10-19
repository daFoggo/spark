import { FOCUS_LIMIT, type Review } from "./schemas"

/** Pure review rules (spec RV-1, RV-3, RV-4, RV-5). */

/** RV-3: under 50% over the last 14 days suggests making the habit easier. */
export const EASIER_BELOW = 0.5

export const suggestEasier = (rate14: number | null): boolean =>
  rate14 !== null && rate14 < EASIER_BELOW

/** RV-5: the sidebar says "due" until the current week's review is saved. */
export const isReviewDue = (review: Review | null): boolean =>
  review === null || review.completedAt === null

/** RV-4: toggle a task in the focus set, never beyond three. Returns the same set when it is full. */
export function toggleFocus(
  focus: readonly string[],
  taskId: string
): string[] {
  if (focus.includes(taskId)) return focus.filter((id) => id !== taskId)
  return focus.length >= FOCUS_LIMIT ? [...focus] : [...focus, taskId]
}
