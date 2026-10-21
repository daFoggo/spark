# Module: habits + schedules + check-ins (Phase 5)

Baseline inventory from reading the code on 2026-10-21. **Re-verify in playbook step 1.** Paths relative to `apps/web/`.
Spec rules: HB-1…HB-7, AC-2…AC-6, AC-8, MT-1…MT-7. This phase also creates the `activities` table (check-ins are
`activities` rows with `source='habit'`); the activities endpoints come in Phase 6a.

## A. Operations (`features/habits/server.ts`)

| Function | Supabase call | operationId |
| :--- | :--- | :--- |
| `fetchHabits` (L62) | `habits` + embedded `habit_schedules(valid_from, kind, weekdays, every_n)` (**embed unordered**), `archived_at is null`, order `position, created_at` | `listHabits` |
| `fetchHabit(id)` (L75) | same, `eq id`, `maybeSingle`, archived included; errors → plain `Error` | `getHabit` |
| `fetchCheckIns({from,to,habitId?})` (L89) | `activities` `id, habit_id, date, level, note`, `source='habit'`, date range, order `date` (no tie-breaker, no limit) | `listCheckIns` |
| `toggleCheckIn` (L116) | RPC `toggle_check_in(p_habit_id, p_date, p_level)` → level or null | `toggleCheckIn` |
| `createHabit(form)` (L130) | RPC `create_habit` (9 args incl. `p_goal_id`) → id | `createHabit` |
| `setHabitSchedule` (L150) | RPC `set_habit_schedule(p_habit_id, p_kind, p_weekdays, p_every_n)` | `setHabitSchedule` |
| `updateHabit(id, patch)` (L169) | `habits.update` (name, cue, versions, time_of_day, goal_id, paused_from/until, archived_at), `.single()` | `updateHabit` |
| `saveCheckInNote` (L205) | `activities.update({note: note \|\| null})` by habit_id + date + source, `.single()` | `setCheckInNote` |

Row → DTO `toHabit` (L39–59): schedules `every_n ?? 2`, `weekdays ?? []`, `archived = archived_at !== null`.

## B. Actions (`actions.ts`; `expected()` L30–35 strips `XX-n:`)

| Action | Input | Calls | Tags | Returns / errors |
| :--- | :--- | :--- | :--- | :--- |
| `checkInAction` (L38) | `CheckInInputSchema` + `isLocalDate` | `toggleCheckIn` | `checkinsTag`, `activitiesTag` | `{level}` / `{error}` |
| `checkInNoteAction` (L61) | `NoteInputSchema` trim ≤280 | `saveCheckInNote` | `checkinsTag` | `{saved}` / `{error}` |
| `createHabitAction` (L97) | `HabitFormSchema` (name 1–80, cue ≤120, full/min ≤60, goalId, kind, weekdays ≥1, everyN 2–7) | `createHabit` | `habitsTag` | `{saved, habitId}` |
| `updateHabitAction` (L120) | habitId + form | `updateHabit` then `setHabitSchedule` (**two calls, not atomic**) | `habitsTag` | `{saved}` |
| `pauseHabitAction` (L151) | habitId, from, until ≥ from or null | `updateHabit` | `habitsTag` | no try/catch |
| `resumeHabitAction` (L174) | habitId, today → `pausedUntil = today − 1` | `updateHabit` | `habitsTag` | no try/catch |
| `archiveHabitAction` (L193) | habitId → `archivedAt = now ISO` | `updateHabit` | `habitsTag` | no try/catch |

## C. Queries

`getHabits()`, `getHabit(id)` tag `habitsTag`; `getCheckIns(from, to, habitId?)` tag `checkinsTag`. Private, 300/300/3600.

## D. DB logic

| Object | Behaviour |
| :--- | :--- |
| `habits` | name/cue/versions lengths, `time_of_day` enum default morning, `starts_on` not null, check `paused_until` requires `paused_from`; insert/update need `goal_id` null or owned |
| `habit_schedules` | `unique(habit_id, valid_from)`; days → non-empty subset of 0–6 and `every_n` null; every → `every_n` 2–7; insert needs `owns_habit` |
| `activities` (created here) | `source` enum; `habit_id` set iff source=habit; `level` default full; `note` ≤280, `hours` (0,24] numeric(3,1), `topic` ≤40; partial unique `(habit_id, date) where source='habit'` (AC-2); indexes `(user_id, date)`, `(goal_id, id)`, `(goal_id, date desc, id desc)`; FKs habit cascade, goal set null, task set null (task FK in Phase 6b) |
| `check_activity_window` trigger | insert/update: new date in `[today−3, today]` and, on update, old date too, else `P0001 'AC-5: only the last 3 days can be changed'`; delete unrestricted |
| `toggle_check_in` | 1) level ∉ {full, minimum} → `AC-3`; 2) date outside window → `AC-5`; 3) habit not found or archived → `P0001 'HB-6: habit not found'`; copy `goal_id` (AC-6); 4) existing row `for update`; none → insert (return level); same level → delete (return null); other → update level |
| `create_habit` | insert habit with `starts_on = today`, then schedule row `valid_from = today`; returns id |
| `set_habit_schedule` | habit visible else `P0001 'HB-4: habit not found'` (archived allowed); upsert schedule `valid_from = today` on conflict update |
| perf | `habits_user_active (user_id, position, created_at) where archived_at is null`; `habits_goal_id` partial |

## E. Consumers

Queries: `_components/dashboard-data.ts`, `_components/crumbs.tsx`, `dashboard/habits/page.tsx`,
`habits/[habitId]/page.tsx`, `review/page.tsx`, `goals/[goalId]/page.tsx`. Pure stats/rows: `inspector-content.tsx`,
`habits/_components/habits-overview.tsx`, `dashboard/_components/today-sections.tsx`. Components: `habit-row.tsx`
(check-in, note), `habit-dialog.tsx` (create/update; used by get-started, habits pages, goal page), `habit-menu.tsx`
(pause/resume/archive).

## F. Tests today

vitest: `stats.test.ts` (isDue, streaks, consistency, MT-6, MT-7 cells, overallLevel, weekProgress), `contract.test.ts`.
pgTAP `habits.test.sql` (11): create with schedule, every_n 2–7 (23514), full/minimum/undo, −4 and future refused,
other user cannot see or write. Not covered: `overallCells`, `scheduleLabel`, `habitWeek`, `rows.ts`, actions.

## Findings to decide

1. **Stats stay in TS (D7)**; the API returns raw habits + check-ins. Return `schedules` **ordered by `valid_from`**
   (today unordered; `scheduleLabel` uses `.at(-1)`) — Fix, harmless.
2. `updateHabitAction` = two writes; FastAPI can do PATCH + schedule in one request? Keep two operations (contract) but
   consider a single transaction later; record.
3. `HabitPatch.archived` (bool, contract) vs code `archivedAt` timestamp; resume has no operation (`pausedUntil =
   yesterday`). Decide the PATCH semantics and document them.
4. `toggle_check_in` unique violation (two parallel first taps) → today 23505 shown as an error. After: the row lock +
   partial unique index; on `IntegrityError` re-read and apply AC-3 once (test with two sessions).
5. `setCheckInNote` when no check-in exists → 404 (today PGRST116 thrown); AC-5 applies to note edits too (trigger on update).
6. `stats.ts:224` uses `Math.max(due, done)` as denominator vs the comment at 221 — frontend issue, not migration; MT-5
   is not implemented anywhere. Note only.
7. Ownership of `goalId` on create/update (`goals.service.assert_owned`).

## Integration

- Writes `activities` rows via `activities.service` (check-in create/update/delete) — Phase 6a's tests must see them.
- `reviews.complete_review` pauses habits (`paused_from = next week start`) — Phase 7 calls `habits.service.pause_from`.
- Pet treats count check-ins (activities stats) — verify Today's pet after a check-in.

## Module-specific parity items

- [ ] Create habit (days / every N) from Today, Habits page and a goal page (goal preselected).
- [ ] Check in full → minimum → same level (undo) on today, −3 (allowed), −4 and +1 (refused AC-5).
- [ ] Extra session on a non-due day: counts in treats, marked on heatmap, not in streak/consistency.
- [ ] Note after check-in saved and shown in recent notes; empty note clears it.
- [ ] Edit schedule applies from today (HB-4), past check-ins unchanged; history rows visible in `schedules`.
- [ ] Pause / resume / archive (HB-5, HB-6) and Today grouping by time of day (HB-7).
- [ ] Streak, best, consistency, weekday insight and heatmaps equal on both stacks for the seed user.
