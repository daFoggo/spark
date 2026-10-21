# Module: goals + checkpoints (Phase 4)

Baseline inventory from reading the code on 2026-10-21. **Re-verify in playbook step 1.** Paths relative to `apps/web/`.
Spec rules: GL-1…GL-7, CP-1…CP-4.

## A. Operations (`features/goals/server.ts`)

| Function | Supabase call | operationId | Notes |
| :--- | :--- | :--- | :--- |
| `fetchGoals` (L64) | `goals` + embedded `checkpoints(id, goal_id, title, position, done_on)`, `status <> archived`, order `position, created_at` | `listGoals` | `toGoal` sorts checkpoints by `position, id` in TS |
| `fetchGoal(id)` (L77) | same columns, `eq id`, `maybeSingle` (archived included) | `getGoal` | `null` when not visible; errors → plain `Error` |
| `createGoal(name)` (L91) | RPC `create_goal(p_name)` → id | `createGoal` | empty result → `DataError PGRST116` |
| `updateGoal(id, patch)` (L103) | `goals.update`, `.single()` | `updateGoal` | used for edit and status changes |
| `addCheckpoint` (L126) | `checkpoints.insert` | `addCheckpoint` | `position` passed from the client, not validated |
| `renameCheckpoint` (L143) | update title, `.single()` | `editCheckpoint` (title) | |
| `deleteCheckpoint` (L158) | delete, `.single()` | `deleteCheckpoint` | |
| `setCheckpointDone` (L173) | RPC `set_checkpoint_done(id, done)` → date | `setCheckpointDone` | |
| `moveCheckpoint` (L187) | RPC `move_checkpoint(id, direction)` | `editCheckpoint` (move) | |

## B. Actions (`actions.ts`, all through `guarded()` L43–53 which maps expected `DataError` to `{error}` without the prefix)

| Action | Input | Calls | Tags | Returns |
| :--- | :--- | :--- | :--- | :--- |
| `createGoalAction` (L56) | `NewGoalSchema` name trim 1–120 | `createGoal` | `goalsTag` | `{saved, goalId, someday}` |
| `updateGoalAction` (L76) | goalId uuid; `GoalFormSchema` name 1–120, why ≤500, becoming ≤60, targetDate date or "", obstacle/plan ≤280 | `updateGoal` | `goalsTag`, `goalTag` | `{saved, goalId}` |
| `setGoalStatusAction` (L104) | goalId, status enum | `updateGoal({status})` | `goalsTag`, `goalTag` | `{saved}` |
| `addCheckpointAction` (L125) | title 1–120, position (unvalidated) | `addCheckpoint` | `goalsTag`, `goalTag` | `{saved}` |
| `toggleCheckpointAction` (L149) | goalId, checkpointId, done (unvalidated) | `setCheckpointDone` | `goalsTag`, `goalTag` | `{saved}` |
| `editCheckpointAction` (L171) | union rename / move ±1 (unvalidated) / remove | rename / move / delete | `goalsTag`, `goalTag` | `{saved}` |

## C. Queries

`getGoals()` tag `goalsTag`; `getGoal(goalId)` tags `goalsTag` + `goalTag(goalId)`. Private cache, 300/300/3600.

## D. DB logic (`20261020150000_goals.sql`, perf indexes)

| Object | Behaviour |
| :--- | :--- |
| `goals` | name 1–120; slug `^[a-z0-9][a-z0-9-]*$` ≤60, `unique(user_id, slug)`; status in active/someday/done/archived; `position` default 0; index `(user_id, status)` |
| `enforce_goal_rules` trigger (insert/update) | GL-3: becoming `active` (new row or status changed) with ≥3 **other** active goals → `P0001 'GL-3: Move one goal to Someday first'`. GL-4: becoming `done` without `target_date` and without any checkpoint → `P0001 'GL-4: Add a target date or a checkpoint before marking it done'` |
| `create_goal(p_name)` | slug: lowercase, non-alnum → `-`, trimmed, cut to 50, `goal` if empty; clash → `-2`, `-3`…; status `someday` if ≥3 active else `active` (GL-3 fallback); returns id |
| `checkpoints` | title 1–120, position int, `done_on date`; FK goal cascade; index `(goal_id, position)`; insert needs `owns_goal(goal_id)` |
| `set_checkpoint_done(id, done)` | `done_on = today_for(user)` or null; missing → `P0001 'CP-3: checkpoint not found'` |
| `move_checkpoint(id, dir)` | neighbour by `(position, id)`; swap positions; ties renumbered ±1; no neighbour → silent no-op; any dir > 0 means down; missing → `P0001 'CP-4: …'` |
| `owns_goal` | used by policies of checkpoints, habits, tasks, activities (goal_id must be the caller's) → service ownership checks in **every** module that accepts `goalId` |
| grants | goals insert/update column lists; no delete on goals (GL-6 soft delete) |

## E. Consumers

Pages: `_components/dashboard-data.ts`, `_components/crumbs.tsx`, `dashboard/goals/page.tsx`,
`dashboard/goals/[goalId]/page.tsx`, `dashboard/{tasks,review,habits,habits/[habitId]}/page.tsx`,
`dashboard/_components/{get-started,today-sections}.tsx`. Components: `goal-board.tsx` (status DnD, client-side GL-3
pre-check L162), `goal-new.tsx`, `goal-dialog.tsx`, `goal-status.tsx`, `checkpoint-list.tsx`.

## F. Tests today

vitest: `rules.test.ts` (checkpointProgress, canMarkDone, canActivate, groupGoals, goalLevel, goalCells),
`contract.test.ts` (Goal, Checkpoint). pgTAP `goals.test.sql` (10): slug + suffix, 3rd active / 4th someday, 4th
activation refused, GL-4, checkpoint add, CP-3 stamp, isolation. Not covered: move/rename/delete checkpoint.

## Findings to decide

1. GL-3 under concurrency: two parallel activations can both pass a count check. Lock `user_settings` row (or goals of
   the user) `for update` in the service before counting; test with two sessions.
2. Slug uniqueness: generation in Python + `unique(user_id, slug)`; on `IntegrityError` retry with the next suffix.
3. `move_checkpoint`: keep tie renumbering and the silent no-op at the edges; validate `move ∈ {-1, 1}` (Fix: 422 otherwise).
4. Contract: `editCheckpoint` body should be `oneOf` title|move; document 404 for checkpoint routes and CP-3/CP-4;
   `addCheckpoint.position` minimum 0 is not validated in the app; `listGoals` ordering not documented.
5. Unguarded `.single()` writes return `PGRST116` → thrown today; after: 404 → decide per action (throw is today's behaviour).

## Integration

habits, tasks and activities accept `goalId`: after this module, their services call `goals.service.assert_owned(user,
goal_id)` (replaces `owns_goal` in their policies). Archiving a goal keeps links (GL-7).

## Module-specific parity items

- [ ] Create from the list: 1st–3rd active, 4th someday with the "someday" notice; slug suffixes.
- [ ] Drag Someday → Active with 3 active refused (client pre-check and server 422 GL-3).
- [ ] Done without target/checkpoint refused (GL-4); with a checkpoint allowed.
- [ ] Checkpoints: add, toggle (done date = user's today), rename, move up/down incl. edges, delete; progress n/m.
- [ ] Archive hides the goal everywhere; linked habits keep running unlinked in the UI.
