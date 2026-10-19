# Goals & Habits: product and domain spec

Status: **draft for review**. Source of truth for the goals/habits product in `apps/web`. The interactive prototype lives in
[`docs/design-system/habit-goal-preview.html`](../design-system/habit-goal-preview.html); where the two disagree, this
document wins and the prototype is updated. Delivery order and checklists: [roadmap.md](roadmap.md).

Rule IDs (`HB-3`, `TK-5`, …) are stable: reference them from code comments, tests, PRs and the roadmap.

---

## 0. Scope

**In:** goals, habits with schedules, activity log (check-ins and free logs), tasks, weekly review, a pet (Mochi) that
reflects the activity log, heatmaps and simple stats. Single user, private data.

**Out (for now):** AI features, social/sharing, notifications/push, recurring tasks, mobile app, multiple pets,
import/export, team workspaces.

### Glossary

| Term | Meaning |
| :--- | :--- |
| Local date | The calendar date in the user's timezone. Every "today", streak and heatmap is computed on local dates. |
| Goal | Where the user is headed. Only a name is required. |
| Checkpoint | Optional step inside a goal, added when the next step is visible. Not a fixed plan. |
| Chapter | A closed stretch of a goal: the user decides "this is enough", names it, and the counters restart. |
| Habit | A schedule plus a promise ("Run on Mon/Wed/Fri"). It stores no history. |
| Activity | One thing the user did on a local date: a habit check-in, a free log, or a logged task. |
| Check-in | An activity with a `habit_id`, level `full` or `minimum`. |
| Task | Something still to do. One-off, free text. |
| Review | The weekly look back. |
| Treat | One activity, as counted by the pet. |

---

## 1. Product principles

1. **No upfront planning.** A goal starts with a name. Structure (checkpoints, chapters) is added when the user wants it.
2. **Log first.** What the user did is the core record (Activity). Progress is shown as accumulated evidence, not as a
   percentage of an imagined plan. A percentage appears only when there is a real denominator (checkpoints).
3. **Every link is optional.** Habits, tasks and logs work alone; linking them to a goal only groups and counts them.
4. **Forgiving rhythm.** One miss never breaks a streak; two in a row does ("never miss twice"). A low-energy day can log
   the minimum version and it still counts.
5. **Few active goals.** At most 3 active goals; the rest wait in Someday.
6. **Familiar words.** UI copy uses everyday terms (Streak, Checkpoint, "If it gets hard"), never method names
   (WOOP, implementation intention, lead/lag measure).
7. **Fast daily loop.** Checking in a habit or adding a task takes one action and gives instant feedback.

---

## 2. Domain model

```
User (settings: timezone, week_start, pet_name, adopted_at)
 ├── Goal ──┬── Checkpoint (0..n, ordered)
 │          └── Chapter    (0..n, closed stretches)
 ├── Habit ───────────── goal_id? ──▶ Goal
 ├── Activity ── habit_id? ──▶ Habit
 │             ├ goal_id?  ──▶ Goal
 │             └ task_id?  ──▶ Task
 ├── Task ────── goal_id?  ──▶ Goal
 └── Review (one per week)
```

- Activity is the only history table. Habit heatmaps, goal timelines, weekly numbers and the pet all read from it.
- Every arrow marked `?` is optional and nullable.
- Pet state is **derived** (never stored except its name and adoption date in user settings).

---

## 3. Business rules

### 3.1 Time (TM)

- **TM-1** All dates are local dates in `user.timezone` (IANA, e.g. `Asia/Ho_Chi_Minh`). Stored as `date` (no time).
- **TM-2** The timezone is taken from the browser on first visit and saved to user settings; the user can change it in
  Settings. Until saved, the server falls back to UTC.
- **TM-3** "Today" is computed on the server behind `io()` (clock access) from the user's timezone, never from the
  server's local time.
- **TM-4** A week starts on `user.week_start`, taken from the browser locale on first visit
  (`new Intl.Locale(navigator.language).getWeekInfo().firstDay`, falling back to Monday where the API is missing) and
  editable in Settings. Weekly targets, reviews and "This week" use it.
- **TM-5** Changing the timezone does not rewrite stored dates.

### 3.2 Goals (GL)

- **GL-1** Required: `name` (1–120 chars). Optional: `why`, `becoming` ("I'm becoming…", 1–60 chars), `target_date`,
  `if_hard` (`obstacle` + `plan`, both ≤ 280 chars).
- **GL-2** Status is one of `active`, `someday`, `done`, `archived`.
- **GL-3** At most **3** goals are `active`. Creating a goal when 3 are active creates it as `someday` and says so.
  Activating a 4th is refused with "Move one to Someday first".
- **GL-4** `done` is allowed only when the goal has a target date or at least one checkpoint (there is something to be done
  with). Open-ended goals close chapters instead.
- **GL-5** `archived` hides the goal everywhere except Settings → Archive. History (activities) stays.
- **GL-6** Deleting a goal is a soft delete (`archived`). Hard delete is out of scope.
- **GL-7** Linked habits, tasks and activities keep their `goal_id` when a goal changes status. When a goal is archived,
  its habits keep running unlinked in the UI (the link is hidden, not removed).

### 3.3 Checkpoints (CP)

- **CP-1** A checkpoint has `title` (1–120 chars), `position`, optional `done_at`.
- **CP-2** Checkpoints are optional. With none, the goal shows no percentage (principle 2).
- **CP-3** Progress = done / total. Toggling done sets/clears `done_at` (local date).
- **CP-4** Checkpoints can be reordered, renamed and deleted. They are never auto-completed by tasks or activities.

### 3.4 Chapters (CH)

- **CH-1** "Close this chapter" requires at least one activity in the current chapter and a title (1–120 chars).
- **CH-2** Closing stores `title`, `closed_on` (local date), `activity_count` and `hours` (snapshots), and
  `last_activity_id` (the highest activity id included).
- **CH-3** The current chapter = activities of the goal with `id > last chapter's last_activity_id`. Goal counters
  ("This chapter", Time, Last 7 days) use the current chapter; the heatmap and timeline show all chapters.
- **CH-4** Chapters are append-only (rename allowed, no delete, no reopen).

### 3.5 Habits (HB)

- **HB-1** Required: `name` (1–80 chars), `schedule`. Optional: `cue` ("After I…", ≤ 120 chars), `full` (what a full
  session is, ≤ 60), `minimum` (the low-energy version, ≤ 60), `time_of_day` (`morning` | `afternoon` | `evening`,
  default `morning`), `goal_id`.
- **HB-2** Schedule kinds:
  - `days`: a non-empty set of weekdays (`0`=Sun … `6`=Sat).
  - `every`: every `n` days, `2 ≤ n ≤ 7`, counted from `starts_on`.
  A habit is **due** on local date `d` if `d ≥ starts_on`, it is not paused on `d`, and the schedule matches `d`.
- **HB-3** `starts_on` defaults to the creation date. Days before `starts_on` are "not scheduled", never "missed".
- **HB-4** Editing the schedule applies from the edit date forward; past check-ins are kept as they are. (Implementation:
  store schedule history as `habit_schedules(valid_from)` rows, the latest row whose `valid_from ≤ d` applies.)
- **HB-5** Pause: `paused_from` (local date) and optional `paused_until`. Paused days are "not scheduled": they do not
  break streaks and do not count in consistency.
- **HB-6** Archive hides the habit from Today and lists; check-ins stay and still feed goals and the pet.
- **HB-7** Habits are listed on Today grouped by `time_of_day`, then by `position`.

### 3.6 Activities and check-ins (AC)

- **AC-1** Fields: `date` (local), `source` (`habit` | `log` | `task`), `habit_id?`, `goal_id?`, `task_id?`, `level`
  (`full` | `minimum`, check-ins only; logs and tasks are `full`), `note?` (≤ 280 chars), `hours?` (0 < h ≤ 24, one
  decimal), `topic?` (≤ 40 chars, free text).
- **AC-2** At most **one check-in per habit per local date** (unique `habit_id, date` where `source = habit`).
- **AC-3** Check-in actions on a habit for a date:
  - `full` when none exists → create (level full).
  - `minimum` when none exists → create (level minimum).
  - same level as existing → delete (undo).
  - other level → change level.
- **AC-4** Check-ins are allowed on a date where the habit is **not due** ("extra session"). An extra session:
  - counts as a treat and in goal timelines (it is real effort);
  - does not enter consistency (MT-3) or streaks (MT-1), which are about keeping the schedule, so doing more never hides a
    missed due day;
  - shows on the habit heatmap as a filled cell with a dot marker and the tooltip "Extra session".
  On Today, habits that are not due sit in a collapsed "Not scheduled today (n)" group, so an extra session is one tap
  away without cluttering the list.
- **AC-5** Back-dating: check-ins and logs may be created or changed for today and the previous **3** local dates.
  Older dates are read-only. Enforced in the database (§6.3).
- **AC-6** `goal_id` of a check-in is **copied** from the habit at creation (snapshot). Relinking a habit later does not
  move its past check-ins.
- **AC-7** Free log (`source = log`): `note` required (1–280 chars), `goal_id`, `hours`, `topic` optional.
- **AC-8** A note can be added to a check-in after the fact (inline prompt after checking in, skippable).
- **AC-9** Deleting an activity is a hard delete (the user's own log). It lowers counters and the pet (PT-2).

### 3.7 Tasks (TK)

- **TK-1** Required: `title` (1–200 chars). Optional: `note` (≤ 2000), `goal_id`.
- **TK-2** List: `today` or `later` (no date). There are no due dates or times in this version.
- **TK-3** Quick add parses `#<goal-slug>` to link a goal (the token is removed from the title). Unknown slugs stay in the
  title as typed.
- **TK-4** An open `today` task created before today **carries over** automatically and shows its age
  (`today − created_on` days).
- **TK-5** When the age is **≥ 5 days**, the row asks "Still want to do this?" with Keep (age resets: `created_on = today`),
  Later (moves to `later`), Drop (deletes).
- **TK-6** Completing a task sets `done_on = today`. Completing a task linked to a goal offers "Add to log?"; accepting
  creates an activity `source = task`, `task_id`, `goal_id`, `note = title`. Declining does nothing. The offer is shown
  once, right after completion.
- **TK-7** Un-completing a task clears `done_on`. It does **not** delete an activity created by TK-6 (the user deletes it
  from the log if wanted).
- **TK-8** Done tasks stay in the Done tab for 30 days, then are hidden (not deleted).

### 3.8 Weekly review (RV)

- **RV-1** One review per user per week (`week_start_on` unique). It can be started any day of the week and re-opened
  until the week ends.
- **RV-2** Step 1 "Look back": check-ins done/scheduled, logs, tasks done, hours for the week, per-habit done/scheduled,
  optional reflection text (≤ 2000).
- **RV-3** Step 2 "Adjust": per active habit choose Keep, Make easier (opens habit edit after finishing), Pause (sets
  `paused_from = next week start`). Habits under 50% in the last 14 days are highlighted with the suggestion to make them
  easier.
- **RV-4** Step 3 "Next week": pick up to **3** open tasks as focus. Focus tasks are moved to `today` on the next week
  start (or immediately if the review is done on the last day).
- **RV-5** Finishing saves the review (`completed_at`). The sidebar shows "due" until the current week's review is saved.

### 3.9 Pet (PT)

- **PT-1** Name defaults to "Mochi", editable in Settings (1–20 chars). `adopted_at` = account creation date.
- **PT-2** Treats = number of activities with `date ≥ adopted_at`. Derived on read; deleting an activity lowers it.
- **PT-3** Stages by treats: Kitten 0, Young cat 30, Chubby cat 90, Round cat 200, Absolute unit 400. Stage index =
  number of tangerines on the head. Body size `f = min(1, treats / 400)`.
- **PT-4** Mood from the last activity date: none today or yesterday → `sleepy`; activity today and this week's check-in
  rate ≥ 60% → `happy`; otherwise `idle`. The pet never gets sick, hungry or dies.
- **PT-5** Feeding feedback (bounce + heart) plays when an action of this request increased treats. Respects
  `prefers-reduced-motion`.

### 3.10 Metrics (MT)

All metrics are computed from activities and schedules on local dates (TM-1).

- **MT-1 Habit streak**: walk back over the habit's due dates from today. Today counts only if checked in. A due date with a
  check-in adds 1; one missed due date is tolerated if the next older due date has a check-in; two missed due dates in a
  row stop the walk. Not-scheduled and paused days are skipped.
- **MT-2 Best streak**: the longest MT-1 run over the habit's whole history.
- **MT-3 Consistency (30d)**: check-ins on due dates / due dates, over the last 30 local dates including today. Check-ins
  on non-due dates are not counted (they can't raise it above 100%).
- **MT-4 Weekly target**: 80% of this week's due check-ins. Today shows "N more to hit your weekly target".
- **MT-5 Overall streak (weeks)**: consecutive weeks with ≥ 70% due check-ins done; the current week is skipped while
  below target; two weak weeks in a row stop it.
- **MT-6 Weekday rate**: per weekday, done/due over the last 364 days. Insight ("Thursday is your toughest day") appears
  only after the habit has ≥ 10 check-ins.
- **MT-7 Heatmap levels** (0–4):
  - Habit: not due and no check-in → "not scheduled"; missed → 0; minimum → 2; full → 4; a check-in on a non-due date
    uses the same level plus the extra-session marker (AC-4).
  - Overall day: sum of habit values (full 2, minimum 1) / (2 × due habits): 0 → 0, < .3 → 1, < .6 → 2, < .85 → 3, else 4.
  - Goal day: activity count 0 → 0, 1 → 2, 2 → 3, ≥ 3 → 4.

---

## 4. Schema

Supabase Postgres, schema `public`, written as migrations in `apps/web/supabase/migrations/` (§6). Every table has
`user_id uuid not null default auth.uid() references auth.users on delete cascade`, `created_at` and `updated_at
timestamptz`; omitted below. Access is limited to the owner by RLS (§6.2).

```sql
user_settings (
  user_id      uuid primary key,
  timezone     text not null default 'UTC',          -- TM-2
  week_start   smallint not null default 1,          -- 0..6, TM-4
  pet_name     text not null default 'Mochi',        -- PT-1
  adopted_at   date not null                         -- PT-1
)

goals (
  id           uuid primary key,
  slug         text not null,                        -- for #slug in quick add (TK-3), unique per user
  name         text not null check (char_length(name) between 1 and 120),
  why          text, becoming text, target_date date,
  if_hard_obstacle text, if_hard_plan text,
  status       text not null check (status in ('active','someday','done','archived')),
  position     int not null default 0,
  unique (user_id, slug)
)
-- GL-3 (≤ 3 active) is enforced in the write path, not by a constraint.

checkpoints (
  id uuid primary key, goal_id uuid not null references goals on delete cascade,
  title text not null, position int not null, done_on date
)

chapters (
  id uuid primary key, goal_id uuid not null references goals on delete cascade,
  title text not null, closed_on date not null,
  last_activity_id bigint not null, activity_count int not null, hours numeric(6,1) not null
)

habits (
  id uuid primary key,
  goal_id uuid references goals on delete set null,
  name text not null, cue text, full_version text, minimum_version text,
  time_of_day text not null default 'morning' check (time_of_day in ('morning','afternoon','evening')),
  starts_on date not null, paused_from date, paused_until date,
  archived_at timestamptz, position int not null default 0
)

habit_schedules (                                    -- HB-4: schedule history
  id uuid primary key, habit_id uuid not null references habits on delete cascade,
  valid_from date not null,
  kind text not null check (kind in ('days','every')),
  weekdays smallint[],                               -- kind = days, non-empty
  every_n smallint check (every_n between 2 and 7),  -- kind = every
  unique (habit_id, valid_from)
)

activities (
  id bigserial primary key,                          -- monotonic: chapters use it (CH-2)
  date date not null,
  source text not null check (source in ('habit','log','task')),
  habit_id uuid references habits on delete cascade,
  goal_id uuid references goals on delete set null,
  task_id uuid references tasks on delete set null,
  level text not null default 'full' check (level in ('full','minimum')),
  note text, hours numeric(3,1) check (hours > 0 and hours <= 24), topic text,
  check ((source = 'habit') = (habit_id is not null))
)
create unique index activities_one_checkin on activities (habit_id, date) where source = 'habit';  -- AC-2
create index activities_user_date on activities (user_id, date);
create index activities_goal on activities (goal_id, id);

tasks (
  id uuid primary key, goal_id uuid references goals on delete set null,
  title text not null, note text,
  list text not null check (list in ('today','later')),
  created_on date not null,                          -- reset by "Keep" (TK-5)
  done_on date
)

reviews (
  id uuid primary key, week_start_on date not null,
  reflection text, habit_choices jsonb not null default '{}',  -- {habitId: 'keep'|'easier'|'pause'}
  focus_task_ids uuid[] not null default '{}',                 -- ≤ 3 (RV-4)
  completed_at timestamptz,
  unique (user_id, week_start_on)
)
```

**DTOs** are defined with Zod in each feature's `schemas.ts` (camelCase, dates as `YYYY-MM-DD` strings). Server code
parses every backend response with them (data-fetching §4.5).

---

## 5. Operation flows

Each flow lists: trigger → preconditions → steps → result. All writes are Server Actions that call `verifySession()`,
validate with Zod, check ownership, write through `server.ts`, invalidate tags and return a minimal value
([data-fetching §8](../data-fetching.md#8-mutations)). Expected failures (validation, rule violations) return
`{ error }`; anything else throws to `error.tsx`.

### 5.1 Habit check-in (Today, habit list)

1. User taps a habit row (full) or its "Minimum" button.
2. UI applies the change optimistically (`useOptimistic`): checkbox state, mini heatmap, counters, pet bounce.
3. `checkInAction(habitId, level, date?)` → RPC `toggle_check_in` (local today from the user's timezone, AC-3, AC-5,
   AC-6) → returns the resulting level.
4. Invalidates `checkins:<userId>`, `activities:<userId>`.
5. On create, the row expands an optional note field (AC-8); saving calls `updateActivityNoteAction(activityId, note)`.
6. Failure: optimistic state reverts; inline error on the row.

### 5.2 Free log (Today "Log", goal page)

1. User types a note, optionally picks a goal (preselected on a goal page) and hours, submits.
2. `logActivityAction` validates AC-7, creates `source = log` for today (or a chosen date within AC-5; the database trigger rejects older dates).
3. Invalidates `activities:<userId>`. Form resets; the pet bounces (PT-5).

### 5.3 Create habit

1. "New habit" opens a dialog: name, cue, minimum, schedule (days / every N days), time of day, goal.
2. `createHabitAction` validates HB-1/HB-2, writes the habit + first `habit_schedules` row (`valid_from = today`).
3. Invalidates `habits:<userId>`. Navigates to the habit's page.

### 5.4 Edit, pause, archive habit

- Edit name/cue/versions/goal: plain update. Goal change does not move past check-ins (AC-6).
- Edit schedule: inserts a `habit_schedules` row `valid_from = today` (or replaces today's row) (HB-4).
- Pause/resume, archive: HB-5, HB-6. Invalidate `habits:<userId>`, `checkins:<userId>`.

### 5.5 Tasks

- **Add**: quick-add input; TK-3 parsing; list = current tab (`today` on Today). Invalidate `tasks:<userId>`.
- **Complete / un-complete**: TK-6/TK-7. On completion of a linked task, the action returns `{ offerLog: taskId }` and
  the row shows "Add to log?". Accept → `logTaskAction(taskId)` → RPC `log_task`, invalidate
  `activities:<userId>`.
- **Carry over / stale**: computed on read (TK-4). Keep / Later / Drop actions per TK-5.
- **Edit note / goal**: inline panel under the row; note saves on blur (debounced), goal on change.

### 5.6 Goals

- **Create**: name only, from the Goals list input. Status per GL-3. Slug generated from the name (unique per user).
- **Edit**: name, why, becoming, target date, "if it gets hard".
- **Change status**: the `goals` trigger enforces GL-3/GL-4; the action maps `P0001` to `{ error }` with the rule's message.
- **Checkpoints**: add (title), toggle done, rename, reorder, delete (CP-1…CP-4).
- **Close chapter**: title in a dialog → RPC `close_chapter` (CH-1/CH-2).
- Invalidate `goals:<userId>` (+ `goal:<goalId>`).

### 5.7 Weekly review

1. Opening the page loads (or creates in memory) the current week's review.
2. Steps 1–3 are client-side state in one form; nothing is written until "Finish".
3. `completeReviewAction` → RPC `complete_review`: saves the review, applies habit pauses (RV-3) and focus tasks (RV-4) in
   one transaction, invalidates
   `reviews:<userId>`, `habits:<userId>`, `tasks:<userId>`.
4. If any habit was set to "Make easier", the result screen links to those habits' edit dialogs.

### 5.8 Reads per page

| Page | Reads (all per user, `"use cache: private"`) |
| :--- | :--- |
| Today | settings (today, tz), today's due habits + 7-day check-ins, today tasks, week stats, overall heatmap (26 w), pet stats, active goals (for the log form) |
| Habits | habit list + 7-day check-ins; selected habit: 52-week check-ins, stats, recent notes |
| Tasks | tasks for the tab (`?tab=today|later|done`) |
| Goals | goal list; selected goal: checkpoints, chapters, linked habits + stats, open tasks, activities (26 w + recent) |
| Review | week stats, per-habit week numbers, 14-day consistency, open tasks, existing review |

---

## 6. Backend: Supabase

The backend is Supabase (Postgres + Auth), with `AUTH_PROVIDER=supabase`. There is no separate API server: feature
`server.ts` files query Postgres through `supabase-js`, and Row Level Security is the authorization boundary. Rules that
must hold under concurrency or across tables run inside the database (constraints, triggers, RPC functions).

Sources: [Supabase RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security),
[Supabase SSR for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs), the official
[`supabase/agent-skills`](https://github.com/supabase/agent-skills) (`supabase-postgres-best-practices`).

### 6.1 Data client and boundaries

- The repo already authenticates with Supabase (`lib/auth/supabase/*`): the proxy refreshes the session, and
  `verifySession()` returns a verified `userId` plus the `accessToken` (claims checked with `getClaims()`).
- **Data client:** `lib/supabase/data.ts` (`import "server-only"`) exports `createDataClient(accessToken)`, a
  `supabase-js` client with the publishable key and `global.headers.Authorization = Bearer <accessToken>`,
  `auth.persistSession = false`. Requests run as the `authenticated` role, so RLS applies.
- Why a token client instead of the cookie client: `server.ts` must not read cookies or the DAL
  (project-structure §3). It receives the token from `queries.ts` / `actions.ts`, exactly like the backend provider does,
  and the token never becomes a cache key (data-fetching §5.2).
- **No secret / service-role key** in `apps/web`. It bypasses RLS and is only for future admin jobs outside the app.
- **No browser data access.** The browser client stays for auth UI only; all reads are Server Components, all writes
  Server Actions (data-fetching §3).
- Types: `supabase gen types typescript --local > apps/web/lib/supabase/database.types.ts` after every migration;
  `createDataClient` is typed with `Database`. `server.ts` still maps rows to camelCase DTOs through the feature's Zod
  schemas.
- Errors: `server.ts` throws on any Supabase error. Actions map expected Postgres errors to `{ error }` values by code:
  `23505` unique violation, `23514` check violation, `P0001` raised by our functions (message = rule ID, e.g. `GL-3`).

### 6.2 RLS policy template (every table)

```sql
alter table public.habits enable row level security;
revoke all on table public.habits from anon, authenticated;
grant select, insert, update, delete on table public.habits to authenticated;

create policy "habits_select_own" on public.habits for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "habits_insert_own" on public.habits for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "habits_update_own" on public.habits for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "habits_delete_own" on public.habits for delete to authenticated
  using ((select auth.uid()) = user_id);

create index habits_user_id on public.habits (user_id);
```

- One policy per operation, always `to authenticated`, `auth.uid()` wrapped in `select` (evaluated once per statement).
- Every column used in a policy or a foreign key gets a btree index.
- Child rows (checkpoints, chapters, habit_schedules) also carry `user_id`, so their policies need no join.
- Insert policies also check that referenced rows (`goal_id`, `habit_id`, `task_id`) belong to the user, through a
  `security definer` helper in a private schema (`private.owns_goal(id)`, search_path pinned, execute granted to
  `authenticated` only).
- Views, if any, use `with (security_invoker = true)`.
- pgTAP tests per table in `apps/web/supabase/tests/`: allow and deny for each operation (`supabase test db`).

### 6.3 Rules enforced in the database

| Rule | Mechanism |
| :--- | :--- |
| AC-2 one check-in per habit per day | partial unique index (§4) |
| AC-3 / AC-5 check-in toggle and 3-day window | RPC `toggle_check_in(habit_id, date, level)`: computes the user's local today from `user_settings.timezone`, rejects dates outside `[today − 3, today]` (`P0001 'AC-5'`), then creates / changes / deletes in one statement; returns the resulting level or null |
| AC-5 for logs | `before insert or update` trigger on `activities` for `source <> 'habit'` |
| AC-6 goal snapshot | `toggle_check_in` copies `habits.goal_id` |
| GL-3 max 3 active goals | `before insert or update` trigger on `goals` (`P0001 'GL-3'`) |
| GL-4 done needs a target or checkpoint | same trigger (`P0001 'GL-4'`) |
| CH-1 / CH-2 close chapter | RPC `close_chapter(goal_id, title)`: snapshots counts in one transaction |
| TK-6 log a task | RPC `log_task(task_id)` |
| RV-3 / RV-4 finish review | RPC `complete_review(week_start, reflection, choices, focus_task_ids)`: saves the review, pauses habits, moves focus tasks, all or nothing |
| `updated_at` | shared trigger `private.set_updated_at()` |

RPC functions are `security invoker` (RLS still applies) unless stated otherwise, live in `public` only when the app
calls them, and pin `search_path = ''`.

### 6.4 Reads and stats

- Pages read raw rows for a date range (check-ins ≤ 1 year per habit, activities for the goal) and compute stats in pure
  TypeScript (`features/habits/stats.ts`, `features/pet/pet.ts`), which keeps the rules unit-testable.
- If a page gets slow, move a computation into a `security_invoker` view or SQL function; do not cache across users.

### 6.5 Local development

- Supabase CLI project in `apps/web/supabase/` (the only consumer; repo root holds only tooling). Commands run with
  `--workdir apps/web` or from `apps/web`.
- Loop: `supabase migration new <name>` → edit SQL → `supabase db reset` (applies migrations + `seed.sql`) →
  `supabase gen types typescript --local` → `supabase test db` → commit. Deploy with `supabase db push`.
- `supabase/seed.sql` creates one demo user with the dataset of the HTML prototype (habits, a year of check-ins, goals, tasks).
- Env: the existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`apps/web/.env.example`).
  Docker is required for the local stack.

## 7. Architecture mapping

Follows [project-structure.md](../project-structure.md) and [data-fetching.md](../data-fetching.md).

### 7.1 Feature slices

Features never import each other; pages in `app/` compose them. Cross-domain writes (a check-in creates an activity,
logging a task creates an activity, a review pauses habits) are single RPC calls from the owning feature's `server.ts`
(§6.3), so no feature writes another feature's tables from TypeScript.

| Feature | Owns | Files |
| :--- | :--- | :--- |
| `features/habits` | habits, schedules, check-ins, habit stats (MT-1…MT-6), overall heatmap (MT-7 overall), week check-in numbers | `schemas.ts`, `server.ts`, `queries.ts`, `actions.ts`, `stats.ts` (pure), `components/` |
| `features/activities` | free logs, timelines, goal heatmap, treat count and last-activity date for the pet | `schemas.ts`, `server.ts`, `queries.ts`, `actions.ts`, `components/` |
| `features/settings` | user settings (timezone, week start, pet name), timezone sync | `schemas.ts`, `server.ts`, `queries.ts`, `actions.ts`, `components/timezone-sync.tsx` |
| `features/tasks` | tasks, quick-add parsing, carry-over | `schemas.ts`, `server.ts`, `queries.ts`, `actions.ts`, `components/` |
| `features/goals` | goals, checkpoints, chapters | `schemas.ts`, `server.ts`, `queries.ts`, `actions.ts`, `components/` |
| `features/reviews` | weekly review | `schemas.ts`, `server.ts`, `queries.ts`, `actions.ts`, `components/` |
| `features/pet` | Mochi sprite + stage/mood rules (pure, props in) | `pet.ts` (pure rules), `components/` |

Shared, non-domain pieces:

| Piece | Location | Why |
| :--- | :--- | :--- |
| Heatmap grid, legend, mini strip | `components/shared/heatmap.tsx` | Used by habits, activities, goals; pure props |
| Local-date helpers (today in tz, week start, ranges) | `lib/dates.ts` | Infrastructure, used by several features' server code |
| Cache tag helpers (`checkinsTag(userId)` …) | `lib/cache-tags.ts` | One naming scheme for tags written by several features |
| Supabase data client + generated types | `lib/supabase/data.ts`, `lib/supabase/database.types.ts` | Server-only infrastructure (§6.1) |

`features/settings/components/timezone-sync.tsx` is mounted by `app/(dashboard)/layout.tsx`, not placed in
`components/providers/`: `components/` may not import features (project-structure §4).

The pet needs data from two features (treats and last activity from `activities`, the week check-in rate from `habits`).
The page reads both and passes plain numbers to `features/pet` components, which import neither.

### 7.2 Routes (`app/(dashboard)/dashboard/`)

| Route | Page composes |
| :--- | :--- |
| `/dashboard` (replaces the current overview) | Today: habits (due today, overall heatmap, week numbers), tasks (today), activities (log form), pet card |
| `/dashboard/habits`, `/dashboard/habits/[habitId]` | habit list; habit detail |
| `/dashboard/tasks?tab=` | task tabs (URL state) |
| `/dashboard/goals`, `/dashboard/goals/[goalId]` | goal list; goal detail + linked habits/tasks/activities |
| `/dashboard/review` | weekly review |

Pages never `await` runtime data at the top level; each section is an async Server Component inside `<Suspense>` with a
sized skeleton. Navigation entries go to `config/navigation.ts` (with an icon each) under the existing
`dashboard:view` permission.

### 7.3 Caching and invalidation

- Every read is per user and needs the token → `"use cache: private"` + `cacheLife` + `cacheTag`.
- Tags: `goals:<userId>`, `goal:<goalId>`, `habits:<userId>`, `checkins:<userId>`, `activities:<userId>`,
  `tasks:<userId>`, `reviews:<userId>`, `settings:<userId>`.
- Each action calls `updateTag` for every tag its write changes (listed per flow in §5).

### 7.4 Client state

- No client data library and no Zustand store. Instant feedback uses `useOptimistic` + `useTransition` (check-ins,
  task toggles) and `useActionState` (forms).
- Selected tab lives in the URL (`?tab=`); selected habit/goal is the route param.
- Review steps are local component state until "Finish" (5.7).

### 7.5 UI

- Follow [design-system.md](../design-system.md) and the `spark-design-system` skill: tokens only, Tailwind scale, component
  sizes via props. New tokens (pet palette, heatmap levels) are added to the design system first, then used.
- **Use shadcn, don't reinvent.** Install the full shadcn component set into `packages/ui` with the official `shadcn`
  skill / CLI (`pnpm dlx shadcn@latest add --all` from `apps/web`, `style: "base-lyra"`). Never edit generated files;
  compose them in `apps/web/components/` or feature components. A custom component is only allowed when no shadcn
  primitive fits (the pixel pet and the heatmap grid).
- Layouts vary by job, inside the dashboard shell (sidebar · main · inspector, design-system §8):

| Need | shadcn component(s) |
| :--- | :--- |
| Habit / task rows, list sections | `Item` (+ `ItemGroup`), `Checkbox`, `ButtonGroup` for Full / Minimum |
| Metrics row | `components/shared/metrics.tsx` (`dl`), no stat cards |
| Tabs (Tasks today/later/done, habit detail sections) | `Tabs` with `variant="line"` |
| New/edit habit, goal settings | `Dialog` (desktop), `Drawer` (mobile) with `Field`, `Input`, `Textarea`, `Select`, `ToggleGroup` (weekdays), `RadioGroup` (schedule kind) |
| Back-dating a check-in or log (≤ 3 days) | `Popover` + `Calendar` with disabled dates |
| Quick add with `#goal` | `Command` (inline suggestions) or `InputGroup` |
| Row actions (edit, pause, archive, delete) | `DropdownMenu`; destructive ones confirm with `AlertDialog` |
| Undo after drop / delete | `Sonner` toast with an Undo action |
| Heatmap cell details | `Tooltip`; overflow in `ScrollArea` |
| Checkpoint progress | `Progress` |
| "Not scheduled today", chapters history | `Collapsible` |
| Weekly review steps | `Tabs` or a stepper built from `Button` + `Separator` |
| Inspector below `xl`, task details on mobile | `Sheet` |
| Empty states | `Empty` |
| Shortcuts hints | `Kbd` |
| Loading | `Skeleton` sized like the content |

- The pet is the second orange element on screen; record it in design-system.md as an exception next to the logo.
- Pixel sprite: hand-drawn template + overlays (tail, eyes, tangerines), `shape-rendering="crispEdges"`, `steps()`
  animations under `motion-safe`.

---

## 8. Decisions log

| # | Question | Decision |
| :--- | :--- | :--- |
| 1 | Backend | Supabase (Postgres + RLS + RPC), `AUTH_PROVIDER=supabase` (§6) |
| 2 | Week start | From the browser locale, editable (TM-4) |
| 3 | Back-dating window | 3 days (AC-5) |
| 4 | Check-ins on non-due days | Allowed as "extra sessions": count as treats and in goals, not in streak/consistency, marked on the heatmap (AC-4) |
| 5 | Overview page | Today replaces the current `/dashboard` overview |
