# Module: tasks (Phase 6b)

Baseline inventory from reading the code on 2026-10-21. **Re-verify in playbook step 1.** Paths relative to `apps/web/`.
Spec rules: TK-1…TK-8, RV-4 (focus).

## A. Operations (`features/tasks/server.ts`; columns `id, title, note, goal_id, list, created_on, done_on, focus_from`)

| Function | Supabase call | operationId |
| :--- | :--- | :--- |
| `fetchTasks(token, tab, today)` (L36) | **done**: `done_on >= today−30`, order `done_on desc`. **today**: `(done_on is null or done_on = today) and (list='today' or focus_from <= today)`. **later**: open, `list='later' and (focus_from is null or focus_from > today)`. Open tabs order `created_on, created_at, id`; in TS rows done today sort after open rows (L64–68) | `listTasks` |
| `toTask` (L24) | `list = 'today'` when `focus_from <= today`, else stored list | — |
| `insertTask` (L71) | insert `title, note, goal_id, list` (`created_on` default `today_for`) | `createTask` |
| `setTaskDone(id, done)` (L89) | RPC `set_task_done` → date or null | `setTaskDone` |
| `logTask(id)` (L103) | RPC `log_task` → activity id | `logTask` |
| `updateTask(id, patch)` (L112) | update `note, list, created_on, focus_from`, `.single()` | `updateTask` |
| `deleteTask(id)` (L137) | delete, `.single()` | `deleteTask` |

## B. Actions (`expected()` L21–26 strips `XX-n:`)

| Action | Input | Calls | Tags | Returns |
| :--- | :--- | :--- | :--- | :--- |
| `addTaskAction` (L29) | `AddTaskSchema` title 1–200, list, goalId | `insertTask` | `tasksTag` | `{saved}` / `{error}` |
| `toggleTaskAction` (L51) | taskId, done (unvalidated) | `setTaskDone` | `tasksTag` | `{doneOn}` / `{error}` |
| `logTaskAction` (L71) | taskId | `logTask` | `activitiesTag`, `tasksTag` | `{saved}` / `{error}` |
| `moveTaskAction` (L87) | taskId, `to` (unvalidated), today | `updateTask`: later → `{list:'later', focusFrom:null}`; today/keep → `{list:'today', createdOn: today, focusFrom:null}` | `tasksTag` | no try/catch |
| `dropTaskAction` (L112) | taskId | `deleteTask` | `tasksTag` | no try/catch |
| `saveTaskNoteAction` (L120) | note ≤2000 | `updateTask({note})` | `tasksTag` | no try/catch |

TK-3 `#slug` parsing is **client-side** (`rules.ts` `parseQuickAdd`, `task-add.tsx:45`): the server receives `goalId`.
TK-4/TK-5 age and stale are computed on read in `rules.ts`.

## C. Queries

`getTasks(tab, today)` tag `tasksTag`, private 300/300/3600.

## D. DB logic

| Object | Behaviour |
| :--- | :--- |
| `tasks` | title 1–200, note ≤2000, list in today/later, `created_on default today_for(uid)`, `done_on`, `focus_from` (reviews migration); indexes `(user_id, list) where done_on is null`, `(user_id, done_on) where done_on is not null`, `tasks_user_focus`, `tasks_goal_id`; goal ownership on insert/update |
| grants | users cannot write `done_on` directly (42501) → only `set_task_done` |
| `set_task_done` (definer impl in `private`) | missing → `P0001 'TK-6: task not found'`; `done_on = today` or null |
| `log_task` | missing → `TK-6: task not found`; no goal → `P0001 'TK-6: only tasks linked to a goal can be logged'`; idempotent (existing `source='task'` row returned); insert activity `{date: today, source:'task', task_id, goal_id, note: left(title, 280)}` |
| `activities.task_id` FK | `on delete set null` + check `source <> 'task' or task_id is not null` |

## E. Consumers

Pages: `_components/dashboard-data.ts`, `goals/[goalId]/page.tsx`, `tasks/page.tsx`, `review/page.tsx`,
`dashboard/_components/{get-started,today-sections}.tsx`. Components: `task-add.tsx`, `task-row.tsx` (toggle, move,
note, drop, log), `task-tabs.tsx`.

## F. Tests today

vitest `rules.test.ts` (age, stale, tabs, 30-day done, parseQuickAdd), `contract.test.ts`. pgTAP `tasks.test.sql` (12):
created_on, done stamp/clear, direct `done_on` write refused, log needs goal, log once, cross-user goal refused, isolation.

## Findings to decide

1. **Bug candidate**: dropping a task that was logged → `on delete set null` makes the activity violate
   `source <> 'task' or task_id is not null` (23514) → error thrown (no try/catch). Verify on a live DB in step 1;
   decide: keep the activity (change FK/check) or refuse the drop with a message. Record as Fix.
2. `listTasks` takes `today` today; after D11 the backend computes it (drop the param or keep it ignored — decide).
3. Contract: `TaskCreate` lacks `goalId`; `TaskPatch` lacks `goalId`, `focusFrom`; `setTaskDone`/`deleteTask` 404 not
   handled; `listTasks` description misses focus + done-today rows.
4. Column-grant rule "no direct `done_on` write" → `TaskPatch` model must not accept `doneOn` (`extra="forbid"`).
5. `log_task` idempotency under concurrency: rely on the partial unique index + `IntegrityError` → return existing id.

## Integration

- Writes activities through `activities.service` (TK-6) — goal page and pet treats must update.
- Reviews set `focus_from` (Phase 7) — the today/later filters must honour it from the start.

## Module-specific parity items

- [ ] Quick add with `#slug` (known/unknown) on Today and Tasks; list = current tab.
- [ ] Complete/un-complete (done date = user's today); done tab shows 30 days, ordered.
- [ ] "Add to log?" on a goal-linked task → one activity, twice → still one.
- [ ] Carry-over age; stale prompt at ≥5 days with Keep / Later / Drop (seed an old task).
- [ ] Note save on blur; goal change.
- [ ] Focus tasks from a review appear in Today per RV-4.
