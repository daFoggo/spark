# Goals & Habits: delivery roadmap

Checklist for building [spec.md](spec.md) in `apps/web`. Work top to bottom; a phase starts only when the previous one is
done. Tick items in the PR that delivers them and reference rule IDs (`HB-3`) in commits/PRs.

## How every phase is done

**Skills to load before working:**

| When | Skill |
| :--- | :--- |
| Any route, query, action, cache, auth code | `next-mono-base` (then the linked doc in `docs/`) |
| Any migration, RLS policy, RPC, index, query shape | `supabase` + `supabase-postgres-best-practices` (official `supabase/agent-skills`) |
| Adding or composing shadcn components | `shadcn` (official `shadcn/ui` skill) |
| Any className, layout, component size, theme token | `spark-design-system` |
| Planning tests for a phase | `engineering:testing-strategy` |
| Before opening the PR | `code-review` (or `/code-review`), `design:accessibility-review` for new UI |
| Button labels, empty states, errors | `design:ux-copy` |
| Backend contract changes | `engineering:architecture` (record an ADR) |

**Definition of done (every phase):**

- [ ] Code follows the slice layout in spec §7.1; no cross-feature imports, no barrel files, `app/` only composes.
- [ ] Every read: `"use cache: private"` + `cacheLife` + `cacheTag`; inside `<Suspense>` with a sized fallback.
- [ ] Every action: `verifySession`, Zod, rule checks (IDs in comments), `updateTag`, minimal return; Postgres error codes
      mapped to `{ error }` (spec §6.1).
- [ ] Every new table: RLS template (spec §6.2), indexes, pgTAP allow/deny tests; types regenerated.
- [ ] UI built from shadcn components (spec §7.5); no hand-rolled replacement for an existing primitive.
- [ ] Pure rules (dates, schedules, stats, pet) have unit tests in the area's `__tests__/` folder (`*.test.ts`).
- [ ] Each page loads its data once per request (`React.cache` loader), starts independent reads together and keeps
      `cacheLife` stale at 5 min with `updateTag` on writes.
- [ ] `pnpm check` and `pnpm build` pass.
- [ ] Exercised in the running app (desktop + 375 px, dark + light); the PR lists what was and wasn't verified.
- [ ] HTML prototype updated if the behaviour changed; spec updated if a rule changed.

---

## Phase 0: Foundations

- [x] Answer the open questions (spec §8 decisions log).
- [x] Install the official skills (`shadcn`, `supabase`, `supabase-postgres-best-practices`) into `.claude/skills` and
      `.agents/skills`; pinned in `skills-lock.json`.
- [x] Supabase CLI (devDependency of `packages/db`), project in `packages/db/supabase/`, local stack on Docker; local env in
      `.env.development.local` (gitignored).
- [x] Migration 1: `user_settings` (+ row created on sign-up by a trigger on `auth.users`), shared `updated_at` trigger,
      `private` schema helpers; RLS + pgTAP.
- [x] `lib/data.ts` over `@workspace/db/server` (`createDataClient(accessToken)`), generated types in `@workspace/db/types` (spec §6.1).
- [x] `lib/dates.ts` (+ `lib/clock.ts` for the request-time read): local today (`"use cache: private"` request-time read), week start, ranges (TM-1…TM-4) + unit tests.
- [x] `lib/cache-tags.ts`: tag helpers (spec §7.3).
- [x] `features/settings`: read/update settings; `timezone-sync.tsx` (timezone + locale week start, TM-2, TM-4) mounted in
      `app/(dashboard)/layout.tsx`.
- [x] Install the full shadcn set into `packages/ui` (minus `alert`, which has a repo variant, and the chat, code-block and
      carousel groups, which the app does not use) (`pnpm dlx shadcn@latest add --all` from `apps/web`); check
      `pnpm check` / `pnpm build` still pass; keep `style: "base-lyra"` in both `components.json`.
- [x] `components/shared/heatmap.tsx` (cell tooltips are native `title` for now; revisit in Phase 6) on top of shadcn `Tooltip` / `ScrollArea`; levels and tooltips as props (MT-7).
- [x] `config/navigation.ts`: Today replaces Overview at `/dashboard`. Habits, Tasks, Goals and Weekly review entries are
      added in the phase that creates each route, so the sidebar never links to a 404.
- [x] `supabase/seed.sql`: demo user + prototype dataset (for a local `db reset` only; written in Phase 6, not run: there is no local stack).

Done when: signed in with Supabase locally, the dashboard shows "today" in the user's timezone and a heatmap from seeded
data, and the full shadcn set builds.

## Phase 1: Habits and check-ins

- [x] `features/habits/schemas.ts`: Habit, Schedule, CheckIn DTOs + form schemas (HB-1, HB-2).
- [x] `features/habits/stats.ts` (pure): due-on-date (HB-2…HB-5), streak, best, consistency, weekday rate (MT-1…MT-3,
      MT-6) + unit tests (pauses, `every n`, schedule history, non-due check-ins).
- [x] Migration: `habits`, `habit_schedules`, `activities` (check-in part), RPC `toggle_check_in` (AC-2, AC-3, AC-5,
      AC-6); RLS + pgTAP (incl. the 3-day window and another user's habit).
- [x] `server.ts` + `queries.ts`: list, detail, check-ins in range.
- [x] `actions.ts`: create, edit (schedule history HB-4), pause/resume, archive, check-in toggle (AC-2, AC-3, AC-5),
      check-in note (AC-8).
- [x] Components: habit row (optimistic toggle, minimum, note prompt), habit list, habit detail (metrics, 52-week heatmap,
      weekday chart, recent notes), new/edit habit dialog.
- [x] Routes: `/dashboard/habits`, `/dashboard/habits/[habitId]`; Today page shows due habits by time of day.
- [ ] Back-dating a check-in or log (Popover + Calendar, AC-5): the database enforces it, the picker UI is Phase 6.

Done when: a user can create a habit with either schedule, check in full/minimum/undo on Today, and see streak and
heatmap update; reload keeps the data.

## Phase 2: Activity log and Mochi

- [x] Migration: activity log trigger (AC-5 for logs), shipped with the Phase 1 migration for every source.
- [x] `features/activities`: schemas, server, queries (range, by goal, week numbers), actions (log, edit note,
      delete) (AC-1, AC-5, AC-7, AC-9).
- [x] Today: log form, "Done today" metric; overall heatmap 26 weeks comes from `features/habits` (MT-7).
- [x] `features/pet`: `pet.ts` rules (PT-2…PT-4) + tests; sprite component (template, tail/eyes/tangerine overlays,
      reduced motion); pet card. Stats passed in as props from the page.
- [x] Feeding feedback after check-in/log (PT-5).
- [x] design-system.md: pet palette tokens (`--cat-*`, `--mikan*`) and the "second orange" exception.

Done when: every check-in or log raises treats, the pet changes stage/mood correctly, and deleting a log lowers it.

## Phase 2.5: OpenAPI contract (historical)

Built while a FastAPI backend was planned: an OpenAPI file, generated types and per-feature contract tests. Removed when
FastAPI was dropped and Spark returned to Supabase (PostgREST + RLS); the schema of record is now
`packages/db/supabase/migrations` and the generated `@workspace/db/types`.

## Phase 3: Tasks

- [x] Migration: `tasks`, RPC `log_task`; RLS + pgTAP.
- [x] `features/tasks`: schemas, server, queries by list, actions: add with `#slug` (TK-3), complete/un-complete
      (TK-6, TK-7), keep/later/drop (TK-5), edit note/goal.
- [x] Carry-over age on read (TK-4); stale prompt at ≥ 5 days (unit-tested; not yet seen in the UI, needs a task older than 5 days).
- [x] "Add to log?" offer → RPC `log_task` (TK-6). Wired, but only appears for goal-linked tasks, so it is first exercised in Phase 4.
- [x] Routes: `/dashboard/tasks?tab=today|later|done`; Today shows today's tasks and the inspector lists "Up next".

Done when: tasks roll over, stale prompt works, and a linked task can be logged to its goal.

## Phase 4: Goals

- [x] Migration: `goals` (+ GL-3/GL-4 trigger), `checkpoints`, `chapters`, RPC `close_chapter`; RLS + pgTAP.
- [x] `features/goals`: schemas, server, queries, actions: create (slug, GL-3), edit, status (GL-3, GL-4),
      checkpoints (CP-1…CP-4), close chapter (CH-1…CH-3).
- [x] Goal list (Active n/3, Someday, Done) and goal detail page composing: activities (timeline, heatmap, counters,
      log form preset to the goal), habits linked (consistency), tasks linked (open), checkpoints, chapters.
- [x] Sidebar "Active goals" section (every active goal; its "I'm becoming" text when set) and "Someday", plus the inspector's active goals.
- [x] Breadcrumb shows the habit or goal name for an id in the URL (`DashboardCrumbs` passes an id-to-name map).
- [x] Routes: `/dashboard/goals`, `/dashboard/goals/[goalId]`.

- [ ] Not done yet: link or relink a task to a goal after it exists (only `#slug` at creation works), goal select inside the
      task note panel; pgTAP tests for the Phase 3 and 4 tables.

Done when: an open-ended goal works with logs and chapters only, and a goal with checkpoints shows n/m and can be marked done.

## Phase 5: Weekly review

- [x] Migration: `reviews`, RPC `complete_review`; RLS + pgTAP.
- [x] `features/reviews`: schemas, server, queries (current week + stats), `completeReviewAction` (RV-1…RV-5)
      applying pauses and focus tasks in one write.
- [x] Three-step page; "due" badge in the sidebar until saved.

- [x] `tasks.focus_from` (RV-4): focus tasks count as today tasks from next week start, or at once on the last day of the week.

Done when: finishing a review pauses the chosen habits from next week and moves focus tasks to Today.

## Phase 6: Hardening

- [x] Empty states for every list (first-run: no habits, no goals, no tasks).
- [x] Error and loading states (`dashboard/error.tsx`, `dashboard/not-found.tsx`, sized Suspense fallbacks); action failures revert optimistic UI (`useOptimistic` resets when the transition ends, the reason shows inline).
- [x] Accessibility pass: heatmap summary label, `aria-pressed` on Minimum, group labels on toggle groups, heat ramp raised to 3:1 in both themes. Not done: a screen-reader run and a full keyboard walk-through.
- [x] Instant-navigation check: dev validation shows no insights on Today, Habits, Tasks, Goals and a goal page; build prerenders every route as partial. Not done: `@next/playwright` `instant()` e2e tests (they need a signed-in session; no e2e setup exists yet).
- [x] Supabase advisors: security clean except leaked-password protection (an Auth dashboard setting); `SECURITY DEFINER` RPCs moved to `private` with invoker wrappers. Performance: only unused-index infos on foreign keys of young tables. Query plans not checked.
- [x] pgTAP tests for tasks, goals/checkpoints/chapters and reviews written (`supabase/tests`); not run: they need a local stack (`supabase test db`).
- [ ] Production project: every migration is already pushed to the linked project; env vars and auth redirect URLs for a deployed domain are still to do.

## Phase 7: Today and rhythm rework

Found while using the app with an empty account: Today mixed doing and reading, the log duplicated ticking a habit, back-dating
had no entry point, and the review badge showed all week. Principle 8 and AC-10 in the spec describe the result.

- [x] Day picking (`?day=`, today and 3 days back, AC-10) through the inspector's week strip (no second calendar on Today); habits and check-ins follow the picked day.
- [x] "Log progress" becomes a button + `ResponsiveDialog` on Today; the inline form goes away. The goal page keeps its form and the recent logs.
- [x] Today drops the metrics row and the activity map; the Habits page gets the week numbers and the overall map.
- [x] "due" badge only in the last two days of the week (RV-5).
- [x] "When…" wording for the habit trigger (done).
- Verified: `pnpm check`; empty-account Today on mobile and `?day=` pick in the browser. Not verified: checking in a back-dated habit on a real habit (no data after the reset).

Done when: a habit from two days ago is one tap on the strip, Today shows only what to do, and the badge is quiet on Monday.

## Phase 8: Goals lead

The goal is the top of the model (principle 9) but sat in the sidebar's fourth slot and nowhere on Today. Nothing becomes
mandatory; the goal is offered first.

- [x] Spec: principle 9; the habit form asks for the goal first.
- [x] Sidebar: Goals directly under Today.
- [x] Today: an "Active goals" band above the habits (name, habits done today, link); habit rows name their goal.
- [x] Onboarding: "Get started" begins with "Set a goal" (skippable); the habit form preselects the goal when opened from a goal page; empty Today offers both.
- [x] Habits page grouped by goal, habits without a goal last.
- [x] Design-system audit: off-tier spacing fixed (`gap-6`, `gap-12`, `p-5`); no arbitrary values or hex colors in `apps/web`. Pre-existing motion durations (`duration-300`, `duration-500`) are documented in the design system.

Done when: a new user sets a goal, creates a habit for it from the goal page, and sees both on Today.

## Phase 9: Less to learn

Found by using the app from zero: the goal page had too many equal blocks, chapters could not be found and were dropped, "Log progress" duplicated
ticking a habit, and the sidebar repeated the goals Today already shows.

- [x] No "Log progress" button or dialog anywhere (spec 5.2); extra effort is an extra tick or a counted task.
- [x] Goal page reordered and trimmed.
- [x] Chapters removed: UI, actions, queries, schema (`getGoalActivity` returns `total`), seed and pgTAP. Migration `20261020210000_drop_chapters.sql` drops the table and RPC; it is written but not pushed to the hosted project yet.
- [x] Sidebar lists only the pages; goals live on Today and the Goals page (the inspector no longer repeats them).
- [x] "Get started" has a button per step; Today no longer shows a second empty box next to it.

Done when: a new user can go from nothing to a goal, a habit on it and a ticked day without reading the Guide.
