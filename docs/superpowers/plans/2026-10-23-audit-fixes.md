# Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the verified findings of the 2026-10-23 audit of `apps/web`, `packages/auth`, `packages/db` against the project docs and the vendored Vercel skills.

**Architecture:** Seven small, ordered tasks; each ends with `pnpm check` green and its own commit. Project rules win over third-party skill rules (`docs/vercel-skills.md`).

**Tech Stack:** Next 16.4 (Cache Components), React 19.3, Supabase (PostgREST + RLS), zod 4, Playwright, vitest.

**Spec:** the audit report (this conversation) and the rules in `CLAUDE.md`, `docs/data-fetching.md`, `docs/design-system.md`, `docs/vercel-skills.md`. Reference only: `git stash show -p stash@{0}` holds an unreviewed partial attempt by earlier agents; use it as a hint, never apply it blindly.

## Global Constraints
- pnpm only. Conventional Commits, no co-author lines. One commit per task (the implementer commits).
- Read the matching doc before changing an area (AGENTS.md table). No arbitrary Tailwind values; no sub-`text-xs`; durations 150/200/300/500.
- Never edit shadcn-generated files in `packages/ui` (Task 3 restores one that was edited).
- A failed request throws; it never becomes `[]`. Expected errors are returned as values; unexpected ones throw to `error.tsx`.
- `diff -rq --strip-trailing-cr .agents/skills .claude/skills` must stay empty.
- Verification per task: `pnpm check`; Tasks 1, 3, 4, 5, 6 also `pnpm build` and, where UI behaviour changes, the relevant Playwright spec with `--workers=1` against a dev server (stop only the process you started), then `pnpm --filter @workspace/db db:clean-test-users`.

## Review Focus
- `/dashboard/goals/abc` and `/dashboard/habits/abc` show not-found, not the error boundary.
- A missing `BETTER_AUTH_SECRET` outside the production build must fail loudly, not fall back to a public placeholder.
- A write followed by a failing second step must still invalidate the cache tag.
- `position`/`move` inputs that are floats, NaN or out of range are rejected before reaching Postgres.

---

### Task 1: Malformed ids return 404

**Files:**
- Modify: `apps/web/app/(dashboard)/dashboard/goals/[goalId]/page.tsx`, `apps/web/app/(dashboard)/dashboard/habits/[habitId]/page.tsx`
- Test: `apps/web/e2e/parity.spec.ts`

**Interfaces:**
- Consumes: the existing goal id schema in `features/goals/schemas.ts` (`GoalIdSchema`) and `z.uuid()` for habits.
- Produces: nothing new.

- [ ] **Step 1:** Add a parity case "malformed ids show not-found": signed-in user opens `/dashboard/goals/abc` and `/dashboard/habits/abc`; assert the not-found UI and that "This page could not load" is absent. Run it; expected FAIL.
- [ ] **Step 2:** At the top of each page (before any read), validate the param with `safeParse` and call `notFound()` on failure.
- [ ] **Step 3:** Run the spec and `pnpm check`; expected PASS. Commit `fix(web): return 404 for malformed goal and habit ids`.

### Task 2: Secrets and leftover FastAPI config in packages

**Files:**
- Modify: `packages/auth/src/config.ts`, `packages/auth/src/better-auth/auth.ts`, `apps/web/.env.example`, `packages/db/src/server.ts`, `packages/db/README.md`
- Test: `packages/auth/src/__tests__/config.test.ts`

**Interfaces:**
- Consumes: `authConfig` consumers in `apps/web` (must keep working with `AUTH_PROVIDER=supabase` and only the three CI placeholder variables).
- Produces: `createDataClient(accessToken: string)` in `@workspace/db/server` (the unused `options.fetch` parameter is removed).

- [ ] **Step 1:** Write `config.test.ts`: with `AUTH_PROVIDER=better-auth` and no `BETTER_AUTH_SECRET`, parsing throws unless `NEXT_PHASE === "phase-production-build"`; with a real secret it passes; `AUTH_PROVIDER=supabase` needs neither. Run; expected FAIL.
- [ ] **Step 2:** Allow the public placeholder secret and the `DATABASE_URL` fallback only during the production build; otherwise zod fails.
- [ ] **Step 3:** Remove FastAPI-specific wording and the `http://localhost:2210` audience default if nothing else uses it (otherwise reword); remove `options.fetch` from `createDataClient` and the contradicting comments.
- [ ] **Step 4:** `pnpm check` and `pnpm build` (CI placeholders only) pass. Commit `fix(auth): fail loudly on a missing Better Auth secret outside the build`.

### Task 3: Restore the edited shadcn file

**Files:**
- Modify: `packages/ui/src/components/item.tsx` (restore upstream), usage sites of `ItemGroup`/`Item` in `apps/web`

**Interfaces:**
- Produces: the upstream `Item`/`ItemGroup` API unchanged; list semantics handled at usage sites.

- [ ] **Step 1:** Find what commit `da06809` changed (`git show da06809 -- packages/ui/src/components/item.tsx`) and why (a11y: `role="list"` on `ItemGroup`).
- [ ] **Step 2:** Restore the upstream file exactly; keep the a11y intent in `apps/web` by passing `role` explicitly where `ItemGroup`/`Item` are used (props spread last).
- [ ] **Step 3:** `pnpm check`, `pnpm build`; confirm no `packages/ui` diff other than the restore. Commit `fix(ui): restore the upstream item component and set roles in the app`.

### Task 4: Write-path correctness in server actions

**Files:**
- Modify: `apps/web/features/habits/actions.ts`, `apps/web/features/settings/actions.ts`, `apps/web/features/goals/actions.ts`, `apps/web/features/goals/schemas.ts`, `apps/web/features/auth/actions.ts`
- Test: matching `__tests__` files if present, else extend `apps/web/e2e/parity.spec.ts` only for behaviour reachable from the UI

**Interfaces:**
- Consumes: `updateTag`, tag constants, `ensureOk`/`unwrap` from `@/lib/data`.
- Produces: `position` schema `z.number().int().nonnegative()` and `move` schema `z.literal(-1).or(z.literal(1))` in `features/goals/schemas.ts`.

- [ ] **Step 1:** `updateHabit`: call `updateTag(habitsTag)` on every path after the first write succeeded (including the early `fail` return).
- [ ] **Step 2:** Settings actions: `updateTag` must run even if `refreshSessionClaims()` throws (call it first or `try/finally`).
- [ ] **Step 3:** Goals actions validate `position` and `move`; invalid input returns the expected-error value.
- [ ] **Step 4:** Auth actions: unexpected errors throw to `error.tsx` (data-fetching.md §8.1); drop the wrong "verify database connection" copy; expected auth errors stay returned values.
- [ ] **Step 5:** Unit tests for the new schemas; `pnpm check`, `pnpm build`, parity spec `--workers=1`. Commit `fix(web): keep caches fresh after partial writes and validate action input`.

### Task 5: Remove read waterfalls on the habits pages

**Files:**
- Modify: `apps/web/app/(dashboard)/dashboard/habits/page.tsx`, `apps/web/app/(dashboard)/dashboard/habits/[habitId]/page.tsx`

- [ ] **Step 1:** Start independent reads (`getHabits`, `getHabit`, `getGoals`, calendar/today) before the first `await`, as `goals/page.tsx` and `review/page.tsx` do (data-fetching.md §4.2). Keep behaviour identical.
- [ ] **Step 2:** `pnpm check`, `pnpm build`, parity spec `--workers=1`. Commit `perf(web): start habit page reads in parallel`.

### Task 6: Conventions from React 19, shadcn and the design system

**Files:**
- Modify: `apps/web/components/layout/inspector.tsx`, spinner-in-Button sites (`features/auth/components/sign-in-form.tsx`, `sign-up-form.tsx`, `features/goals/components/goal-dialog.tsx`, `goal-new.tsx`, `features/habits/components/habit-dialog.tsx`, `features/settings/components/settings-form.tsx`, `features/tasks/components/task-add.tsx`), `apps/web/app/global-error.tsx`, `apps/web/config/routes.ts` and the hard-coded route sites, `(dashboard)/layout.tsx`, `components/layout/main-header-start.tsx`, `features/goals/components/checkpoint-list.tsx`, `apps/web/hooks/use-hotkey.ts`

- [ ] **Step 1:** `inspector.tsx`: `use(Ctx)` and `<Ctx value>` (client-state.md). Spinners in Buttons get `data-icon="inline-start"` and lose `mr-2` (shadcn skill). Checkpoint input `aria-label` includes the checkpoint title.
- [ ] **Step 2:** Replace hard-coded `/dashboard/...` strings with `@/config/routes` constants (add missing constants only if needed); logo links use `DASHBOARD_PATH`.
- [ ] **Step 3:** `global-error.tsx`: read `node_modules/next/dist/docs` for the current error prop name (`reset` vs `retry`) and for whether global CSS loads there; fix raw colors per the result and comment the reason if inline styles remain.
- [ ] **Step 4:** `use-hotkey.ts`: use `useEffectEvent` if it exists in the installed React types so the listener is not re-registered.
- [ ] **Step 5:** `pnpm check`, `pnpm build`, full Playwright `--workers=1`, cleanup users. Commit `refactor(web): follow React 19, shadcn and route-constant conventions`.

### Task 7: Dead code, stale copy and doc drift

**Files:**
- Modify: `apps/web/app/layout.tsx`, `apps/web/lib/auth.ts`, `apps/web/features/goals/components/goal-dialog.tsx`, `apps/web/config/help.ts`, stale comments (`features/settings/timezones.ts`, `goals/[goalId]/page.tsx`, `features/habits/queries.ts`, `features/goals/actions.ts`), `docs/project-structure.md`, `docs/goals-habits/roadmap.md`, `docs/goals-habits/spec.md`, `docs/providers.md`, `docs/superpowers/reports/2026-10-22-supabase-migration-report.md`
- Delete: `apps/web/components/shared/empty-state.tsx`

- [ ] **Step 1:** Delete the unused `empty-state.tsx` and point the doc example at shadcn `Empty`. Remove unused re-exports from `lib/auth.ts`. Real Spark description in `app/layout.tsx` metadata.
- [ ] **Step 2:** Remove "Shows in the sidebar." (goal dialog); fix the help sentence about deleting an activity (no UI exists); fix the stale comments (Python zoneinfo, "API also refuses", "today in the key", "CH-1…").
- [ ] **Step 3:** Docs: roadmap Phase 2 "[x] Today: log form" matches the code; spec §5.1 action name `checkInNoteAction`; remaining FastAPI/2210/2211 mentions only where intentional history; update the report's section 4 with the final outcome.
- [ ] **Step 4:** `pnpm check`, `pnpm build`, `diff -rq --strip-trailing-cr .agents/skills .claude/skills` empty. Commit `chore: remove dead code and fix stale copy and docs`.
