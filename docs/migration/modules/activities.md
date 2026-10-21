# Module: activities (Phase 6a)

Baseline inventory from reading the code on 2026-10-21. **Re-verify in playbook step 1.** Paths relative to `apps/web/`.
Spec rules: AC-1, AC-5, AC-7, AC-9, PT-2, MT-7 (goal day). The table and the AC-5 window are created in Phase 5
(habits); this module adds its own endpoints and owns `activities.service`.

## A. Operations (`features/activities/server.ts`)

| Function | Supabase call | operationId |
| :--- | :--- | :--- |
| `fetchActivityStats(token, adoptedOn, today)` (L14) | 3 queries: count `date >= adoptedOn` (treats), count `date = today` (doneToday), latest `date` (lastActivity); count errors → plain `Error` | `getActivityStats` |
| `fetchActivities(token, from, to, source?)` (L68) | columns `id, date, source, habit_id, goal_id, note, hours, topic`; range; optional source; order `date desc, id desc`; **no limit** | `listActivities` |
| `insertLog(token, input)` (L83) | insert `{date, source:'log', goal_id, note, hours, topic}` → id | `createLog` |
| `deleteActivity(token, id)` (L110) | delete by id, `.select("id").single()`; 0 rows → `PGRST116` thrown | `deleteActivity` |
| `fetchGoalActivity(token, goalId, from)` (L128) | `recent`: same columns, goal, `date >= from`, ordered, no limit; `total`: count for goal (no date filter) | `getGoalActivity` |

## B. Actions

| Action | Input | Calls | Tags | Returns |
| :--- | :--- | :--- | :--- | :--- |
| `logActivityAction(today, prev, formData)` (L16) | `LogFormSchema` note 1–280, hours (0,24] step 0.1, topic ≤40, date optional (defaults to `today`), goalId | `insertLog` | `activitiesTag` | `{saved}` / `{error}` (prefix stripped). **Not imported anywhere** (spec 5.2: no log form) |
| `deleteActivityAction(id)` (L50) | positive int | `deleteActivity` | `activitiesTag`, `checkinsTag` | `{}` / `{error:"Unknown entry"}`; DataError not mapped (thrown). **Not imported anywhere** |

## C. Queries

`getActivityStats(adoptedOn, today)`, `getActivities(from, to, source?)`, `getGoalActivity(goalId, from)` — all tag
`activitiesTag`, private, 300/300/3600.

## D. DB logic

See habits.md table D for `activities`. Specific here: `check_activity_window` also covers logs and task rows (AC-5);
delete is unrestricted (AC-9); insert/update need `goal_id` owned; `source <> 'task' or task_id is not null`;
`activities_one_task_log` unique `(task_id) where source='task'` (from tasks migration).

## E. Consumers

`getActivityStats`: `_components/dashboard-data.ts` (pet, Today). `getActivities`: `dashboard/review/page.tsx`,
`dashboard/goals/page.tsx`. `getGoalActivity`: `dashboard/goals/[goalId]/page.tsx`.

## F. Tests today

vitest `contract.test.ts` (Activity, ActivityStats). No pgTAP file of its own (covered by habits/tasks tests).

## Findings to decide

1. `today` is passed from the frontend to stats (`getActivityStats(adoptedOn, today)`); the contract
   (`getActivityStats`) defines its own params — check whether the backend should compute `today`/`adoptedOn` itself
   (preferred: single source, D11). Keep the query signature; drop params from the request if the backend computes them.
2. Unbounded lists (`fetchActivities`, `recent`): keep (parity) and add a note; the ranges are bounded by `from/to`.
3. `deleteActivity` 404 documented but never produced today → produce 404 (Fix).
4. Contract constraints (`note` ≤280, `topic` ≤40, `hours`) are in the YAML but not in the response Zod DTO — fine.
5. `LogCreate.date` required in the contract, optional in the form — decide (backend default = user's today).

## Integration

- habits (check-ins) and tasks (`log_task`) write through `activities.service`; stats must count all three sources.
- Pet (`features/pet`) reads `treats`, `lastActivity` from `getActivityStats` — re-check the pet card.

## Module-specific parity items

- [ ] Treats, doneToday, lastActivity equal on both stacks for the seed user (and after a check-in / undo).
- [ ] Goal page: recent evidence list and total equal, same order.
- [ ] Goals list and Review page activity data equal.
- [ ] Log create/delete via API (no UI): AC-5 window and AC-7 tested in pytest.
