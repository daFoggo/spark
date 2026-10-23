# Instant Navigation Verification Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox syntax.

**Goal:** Measure how instant Spark's navigations already are, lock that in with `instant()` tests, and change production code only where a failing test proves a gap and a before/after measurement proves the fix is not worse.

**Why measure first:** Spark already follows the model of the blog (Next 16.4 "Improving navigation experience in v0"): `cacheComponents` + `partialPrefetching`, `"use cache: private"` for session data (`lib/dal.ts`, `lib/clock.ts`, every `queries.ts`), `updateTag` on writes, `prefetch` on nav links and detail links. The blog's own lesson is that the first rollout raised prefetch requests 2.9x and had to be tuned. So the safe order is: tests and numbers, then (maybe) changes.

**Sources read:** the blog; `DOCS/02-guides/{instant-navigation,optimizing-prefetching,adopting-partial-prefetching}.md`; `DOCS/03-api-reference/04-functions/navigation.md`; `exposeTestingApiInProductionBuild.md` (`DOCS/` = `apps/web/node_modules/next/dist/docs/01-app/`).

## Facts that shape the plan
- `instant(page, fn, { baseURL })` takes `page` first. `docs/advanced-patterns.md` §1.3 shows `instant(async () => ...)` (no `page`): doc bug, fix in Task 1.
- Automatic prefetching does **not** run in `next dev`; prefetch behaviour is only testable on a production build. The testing API is only in a production build when `experimental.exposeTestingApiInProductionBuild` is on, so it is gated by an env var used for the test build only (never shipped).
- A per-link `prefetch` costs one server invocation per visible link; skip it where the App Shell already makes the page instant or the content must be fresh.
- `navigation()` only defers cacheable work; it needs a `<Suspense>` above it and `"use cache"` below. Not adopted until a test shows a section that should not be prefetched.
- `"use cache: remote"` (shared across users) does not apply: all Spark data is per-user.

## Global Constraints
- pnpm only; Conventional Commits, no co-author lines; one commit per task; commit/push only when the user asks.
- `exposeTestingApiInProductionBuild` is enabled only when `EXPOSE_TESTING_API=1`; a normal `pnpm build` must produce the same bundle as today.
- No production-code change in a task whose job is "tests" (Tasks 1-3). Any change in Tasks 4+ needs: a failing `instant()` test first, the same test passing after, and a measurement table (before/after) in the report.
- Read `docs/data-fetching.md` §9, `docs/vercel-skills.md` and the DOCS pages above before touching the area.
- Verification per task: `pnpm check`; Tasks 2+ also `pnpm build` and the new spec with `--workers=1` against `next start`, then `pnpm --filter @workspace/db db:clean-test-users`.

## Review Focus
- A normal build contains no testing API; CI `build` job unchanged.
- Each test asserts real UI (headings, testids already in the markup), not just "no skeleton".
- Each test also has the reverse check: content that must wait is absent inside `instant()` and present after.
- No new `prefetch` link without a recorded request-count comparison.

---

### Task 1: Tooling and doc fix (no behaviour change)
**Files:** `apps/web/package.json`, `apps/web/next.config.ts`, `docs/advanced-patterns.md` §1, `docs/data-fetching.md` §9, `pnpm-lock.yaml`
- [ ] Add `@next/playwright` as a devDependency, exact `16.4.2` (same version as `next`).
- [ ] `next.config.ts`: `experimental.exposeTestingApiInProductionBuild: process.env.EXPOSE_TESTING_API === "1"`.
- [ ] Fix §1.3 of `advanced-patterns.md` to the real signature, the prod-build requirement, the `EXPOSE_TESTING_API=1` build and `waitForURL` before asserting; `data-fetching.md` §9 gets one line pointing to it.
- [ ] Verify: `pnpm check`, plain `pnpm build` still passes; `pnpm build` without the env var has no testing API (grep the build output).
- Commit: `chore(web): add @next/playwright and expose the testing API for test builds only`

### Task 2: Baseline `instant()` tests that pass on today's code
**Files:** `apps/web/e2e/instant.spec.ts` (new), `apps/web/package.json` (script `test:e2e:instant`)
- [ ] Sign up a fresh `*@example.test` user (same helper style as `smoke.spec.ts`), create the minimum data (one goal, one habit, one task).
- [ ] For each source link, one test, written to pass now: Today -> Goals, Goals -> goal detail, Habits -> habit detail, Today -> Tasks, sidebar -> Weekly review, sidebar -> Account. Inside `instant()`: click, `waitForURL`, assert the page heading and the already-cached content are visible, assert the dynamic-only part is absent; after the callback assert it appears.
- [ ] Run against `next start` built with `EXPOSE_TESTING_API=1`. Record for every test: pass/fail, and which of heading / content / skeleton is visible. A test that fails now is a finding, not a bug in the test: list it, do not fix it here.
- Commit: `test(web): lock in instant navigation for the main flows`

### Task 3: Measure the baseline (read-only)
- [ ] On the same production build, per source page count prefetch requests and server invocations while idle on the page (Playwright `page.on("request")`, RSC prefetch headers) and after hovering/scrolling the longest list (habits, goals).
- [ ] Record Time-to-first-content for client navigations (click -> heading visible) over 5 runs each, plus the numbers already in `docs/providers.md` §5.
- [ ] Output: table in `docs/superpowers/reports/2026-10-23-instant-navigation-report.md`. This is the "cannot get worse" yardstick for every later task.

### Task 4: Fix only what Tasks 2-3 show (decision gate)
Each candidate is a separate sub-task and is done only if the evidence says so:
- [ ] **Gap**: a Task 2 test that fails (content missing in the prefetched UI). Fix with the smallest cache change (`cacheLife`/`cacheTag` already used) or a Suspense boundary move; failing test first, then green.
- [ ] **Cost**: if Task 3 shows many per-link prefetch invocations from list rows (`habit-row.tsx`, `goal-board.tsx`, `today-sections.tsx`, `review-flow.tsx`), switch those links to the blog's intent pattern (`prefetch={intent ? true : "auto"}` with hover/focus/touch) via one small shared client component under `apps/web/components/shared`. Accept only if the request count drops and the matching `instant()` test (hover first, then click) still passes.
- [ ] **Defer**: `navigation()` only if a section (e.g. the weekly review history) is expensive and a test shows it should wait; otherwise not adopted.
- [ ] If nothing qualifies, Task 4 ends with "no change needed" and that is a valid outcome.

### Task 5: CI and docs
- [ ] Add the `instant` spec to CI only if it is stable over 5 consecutive local runs and the run needs no secrets beyond the existing ones; otherwise keep it as a documented local gate (`docs/advanced-patterns.md`).
- [ ] `docs/data-fetching.md` §9 / checklist and `docs/vercel-skills.md`: record what was adopted and what was deliberately not (`navigation()`, `"use cache: remote"`, the optimizer skill).
- [ ] Final whole-branch review (Opus) against this plan; update the report.

## Not in scope
- The `next-partial-prefetching-optimizer` skill (it edits code autonomously; add only with the user's OK and a `docs/vercel-skills.md` override).
- `"use cache: remote"`, `ensureStatic`, route-level `prefetch = 'partial'` (already global).
- Fixing the multi-worker Playwright flakiness and the slow Account page (separate tasks).

## Rollback
Tasks 1-3 add only tests, one dev dependency and an env-gated flag: revert the commits. Task 4 changes are independent commits, each revertible alone.
