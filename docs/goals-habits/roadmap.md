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
- [ ] Pure rules (dates, schedules, stats, pet) have unit tests next to them.
- [ ] `pnpm check` and `pnpm build` pass.
- [ ] Exercised in the running app (desktop + 375 px, dark + light); the PR lists what was and wasn't verified.
- [ ] HTML prototype updated if the behaviour changed; spec updated if a rule changed.

---

## Phase 0: Foundations

- [x] Answer the open questions (spec §8 decisions log).
- [x] Install the official skills (`shadcn`, `supabase`, `supabase-postgres-best-practices`) into `.claude/skills` and
      `.agents/skills`; pinned in `skills-lock.json`.
- [x] Supabase CLI (devDependency of `apps/web`), project in `apps/web/supabase/`, local stack on Docker; local env in
      `.env.development.local` (gitignored).
- [x] Migration 1: `user_settings` (+ row created on sign-up by a trigger on `auth.users`), shared `updated_at` trigger,
      `private` schema helpers; RLS + pgTAP.
- [x] `lib/supabase/data.ts` (`createDataClient(accessToken)`), generated `database.types.ts` (spec §6.1).
- [x] `lib/dates.ts` (+ `lib/clock.ts` for the request-time read): local today (behind `io()`), week start, ranges (TM-1…TM-4) + unit tests.
- [x] `lib/cache-tags.ts`: tag helpers (spec §7.3).
- [x] `features/settings`: read/update settings; `timezone-sync.tsx` (timezone + locale week start, TM-2, TM-4) mounted in
      `app/(dashboard)/layout.tsx`.
- [x] Install the full shadcn set into `packages/ui` (minus `alert`, which has a repo variant, and the chat, code-block and
      carousel groups, which the app does not use) (`pnpm dlx shadcn@latest add --all` from `apps/web`); check
      `pnpm check` / `pnpm build` still pass; keep `style: "base-lyra"` in both `components.json`.
- [x] `components/shared/heatmap.tsx` (cell tooltips are native `title` for now; revisit in Phase 6) on top of shadcn `Tooltip` / `ScrollArea`; levels and tooltips as props (MT-7).
- [x] `config/navigation.ts`: Today replaces Overview at `/dashboard`. Habits, Tasks, Goals and Weekly review entries are
      added in the phase that creates each route, so the sidebar never links to a 404.
- [ ] `supabase/seed.sql`: demo user + prototype dataset.

Done when: signed in with Supabase locally, the dashboard shows "today" in the user's timezone and a heatmap from seeded
data, and the full shadcn set builds.

## Phase 1: Habits and check-ins

- [ ] `features/habits/schemas.ts`: Habit, Schedule, CheckIn DTOs + form schemas (HB-1, HB-2).
- [ ] `features/habits/stats.ts` (pure): due-on-date (HB-2…HB-5), streak, best, consistency, weekday rate (MT-1…MT-3,
      MT-6) + unit tests (pauses, `every n`, schedule history, non-due check-ins).
- [ ] Migration: `habits`, `habit_schedules`, `activities` (check-in part), RPC `toggle_check_in` (AC-2, AC-3, AC-5,
      AC-6); RLS + pgTAP (incl. the 3-day window and another user's habit).
- [ ] `server.ts` + `queries.ts`: list, detail, check-ins in range.
- [ ] `actions.ts`: create, edit (schedule history HB-4), pause/resume, archive, check-in toggle (AC-2, AC-3, AC-5),
      check-in note (AC-8).
- [ ] Components: habit row (optimistic toggle, minimum, note prompt), habit list, habit detail (metrics, 52-week heatmap,
      weekday chart, recent notes), new/edit habit dialog.
- [ ] Routes: `/dashboard/habits`, `/dashboard/habits/[habitId]`; Today page shows due habits by time of day.

Done when: a user can create a habit with either schedule, check in full/minimum/undo on Today, and see streak and
heatmap update; reload keeps the data.

## Phase 2: Activity log and Mochi

- [ ] Migration: activity log trigger (AC-5 for logs).
- [ ] `features/activities`: schemas, server, queries (range, by goal, week numbers), actions (log, edit note,
      delete) (AC-1, AC-5, AC-7, AC-9).
- [ ] Today: log form, "Done today" metric; overall heatmap 26 weeks comes from `features/habits` (MT-7).
- [ ] `features/pet`: `pet.ts` rules (PT-2…PT-4) + tests; sprite component (template, tail/eyes/tangerine overlays,
      reduced motion); pet card. Stats passed in as props from the page.
- [ ] Feeding feedback after check-in/log (PT-5).
- [ ] design-system.md: pet palette tokens (`--cat-*`, `--mikan*`) and the "second orange" exception.

Done when: every check-in or log raises treats, the pet changes stage/mood correctly, and deleting a log lowers it.

## Phase 3: Tasks

- [ ] Migration: `tasks`, RPC `log_task`; RLS + pgTAP.
- [ ] `features/tasks`: schemas, server, queries by list, actions: add with `#slug` (TK-3), complete/un-complete
      (TK-6, TK-7), keep/later/drop (TK-5), edit note/goal.
- [ ] Carry-over age on read (TK-4); stale prompt at ≥ 5 days.
- [ ] "Add to log?" offer → RPC `log_task` (TK-6).
- [ ] Routes: `/dashboard/tasks?tab=today|later|done`; Today shows today's tasks.

Done when: tasks roll over, stale prompt works, and a linked task can be logged to its goal.

## Phase 4: Goals

- [ ] Migration: `goals` (+ GL-3/GL-4 trigger), `checkpoints`, `chapters`, RPC `close_chapter`; RLS + pgTAP.
- [ ] `features/goals`: schemas, server, queries, actions: create (slug, GL-3), edit, status (GL-3, GL-4),
      checkpoints (CP-1…CP-4), close chapter (CH-1…CH-3).
- [ ] Goal list (Active n/3, Someday, Done) and goal detail page composing: activities (timeline, heatmap, counters,
      log form preset to the goal), habits linked (consistency), tasks linked (open), checkpoints, chapters.
- [ ] Sidebar "I'm becoming" section and the overview column's active goals.
- [ ] Routes: `/dashboard/goals`, `/dashboard/goals/[goalId]`.

Done when: an open-ended goal works with logs and chapters only, and a goal with checkpoints shows n/m and can be marked done.

## Phase 5: Weekly review

- [ ] Migration: `reviews`, RPC `complete_review`; RLS + pgTAP.
- [ ] `features/reviews`: schemas, server, queries (current week + stats), `completeReviewAction` (RV-1…RV-5)
      applying pauses and focus tasks in one write.
- [ ] Three-step page; "due" badge in the sidebar until saved.

Done when: finishing a review pauses the chosen habits from next week and moves focus tasks to Today.

## Phase 6: Hardening

- [ ] Empty states for every list (first-run: no habits, no goals, no tasks).
- [ ] Error and loading states; action failures revert optimistic UI.
- [ ] Accessibility pass (keyboard check-in, focus order, labels, contrast of heatmap levels).
- [ ] Instant-navigation check for the main routes (advanced-patterns.md §telemetry/instant tests).
- [ ] Supabase advisors (security + performance lints) clean; query plans checked for the Today and goal pages.
- [ ] Production project: `supabase db push`, env vars, auth redirect URLs.
