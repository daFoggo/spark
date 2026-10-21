# Module: reviews (Phase 7)

Baseline inventory from reading the code on 2026-10-21. **Re-verify in playbook step 1.** Paths relative to `apps/web/`.
Spec rules: RV-1…RV-5, TM-4.

## A. Operations (`features/reviews/server.ts`)

| Function | Supabase call | operationId |
| :--- | :--- | :--- |
| `fetchReview(token, weekStart)` (L12) | `reviews` by `week_start_on`, `maybeSingle` → `null` when none; errors → plain `Error` | `getReview` (contract says 404 when none) |
| `completeReview(token, input)` (L34) | RPC `complete_review(p_week_start, p_reflection, p_choices, p_focus)` | `completeReview` (PUT `/reviews/{weekStart}`) |

## B. Actions

`completeReviewAction(input)` (L18): `CompleteReviewSchema` (weekStart, reflection trim ≤2000, choices `{uuid: keep|easier|pause}`,
focusTaskIds uuid ≤3) → `completeReview` → `updateTag` `reviewsTag`, `habitsTag`, `tasksTag` → `{saved}`; expected
`DataError` → `{error}` without prefix; else rethrow.

## C. Queries

`getReview(weekStart)` tag `reviewsTag`, private 300/300/3600.

## D. DB logic (`20261020170000_reviews.sql`)

| Object | Behaviour |
| :--- | :--- |
| `reviews` | `unique(user_id, week_start_on)`, `habit_choices jsonb default '{}'`, `focus_task_ids uuid[]` ≤3, `completed_at` |
| `private.week_start_for(user)` | `today − ((dow − week_start + 7) % 7)`; NULL without settings row |
| `complete_review` | 1) `v_today`, `v_week`, `v_next = v_week + 7`; 2) `p_week_start <> v_week` → `P0001 'RV-1: only the current week can be reviewed'`; 3) >3 focus → `RV-4`; 4) reflection >2000 → `RV-2`; 5) read previous focus set; 6) upsert review, `reflection = nullif(trim)`, `completed_at = now()`; 7) RV-3: habits with choice `pause` (not archived) → `paused_from = v_next`, `paused_until = null`; 8) RV-4: undone focus tasks → `focus_from = today` if `today >= v_week + 6` else `v_next`; 9) tasks removed from a re-opened review → `focus_from = null`. One transaction |

## E. Consumers

`dashboard/review/page.tsx` (+ `ReviewFlow` client component), `_components/session-nav.tsx` (due badge via
`isReviewDue`).

## F. Tests today

vitest `rules.test.ts` (isReviewDue, suggestEasier, toggleFocus), `contract.test.ts` (Review only; `ReviewComplete`
not covered). pgTAP `reviews.test.sql` (9): wrong week, >3 focus, save, one per week, completed_at, pause from next week,
focus queued, re-save in week, dropped focus released.

## Findings to decide

1. Contract: `weekStart` is a path parameter, the app sends it in the body; `choices` keys are `uuid` in Zod, any string
   in YAML; GET → 404 vs `null` (map 404 → `null` in `server.ts`).
2. Ownership: habit ids in `choices` and task ids in `focusTaskIds` must belong to the user (today RLS silently skips
   others' rows in the UPDATEs). Decide: ignore unknown ids (parity) or 422 (Fix).
3. Cross-module transaction: `reviews.service.complete` calls `habits.service.pause_from_next_week` and
   `tasks.service.set_focus` within the same session (one commit).

## Integration

After a review: Habits page shows the paused habits from next week; Today shows focus tasks per RV-4 (on the last day of
the week immediately); the sidebar badge disappears (RV-5).

## Module-specific parity items

- [ ] Review page numbers (step 1) equal on both stacks.
- [ ] Finish with keep/easier/pause + 0–3 focus tasks; 4 refused; "Make easier" links shown.
- [ ] Re-open in the same week and change focus → dropped tasks released.
- [ ] Review on the last day of the week → focus tasks in Today immediately.
- [ ] Badge only in the last two days until saved.
