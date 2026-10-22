# Report: back to Supabase, monorepo split, Vercel skills (2026-10-22/23)

Plan: `docs/superpowers/plans/2026-10-22-supabase-and-packages.md`. Everything below was verified with real command
output unless marked "not verified".

## 1. What was asked

1. Drop FastAPI (no host) and run the data layer on Supabase again, restoring the queries from git (`91c11f0`) and adapting
   them to the current code.
2. Reorganise the monorepo like `noi-that-khanh-linh` (separate `packages/auth` and `packages/db`).
3. Later: replace the Vercel env vars, remove the Members page, make sure GitHub Actions passes, measure performance,
   adopt Vercel's skills, then audit the codebase against the docs and those skills.

## 2. Timeline

| Step | Result |
| :--- | :--- |
| Scout both repos, plan with the planner (Opus) | Plan saved; `apps/admin` skipped (YAGNI); `AUTH_PROVIDER` default switched to `supabase`; Better Auth kept as identity foundation only |
| T1-T3 restore Supabase, remove FastAPI | `server.supabase.ts` -> `server.ts` (identical signatures, so UI untouched); `http`, `url`, `api/`, contract tests, `gen:api` removed |
| T4 `@workspace/db` | clients, errors, types, migrations, pgTAP, scripts moved to `packages/db` |
| T5 `@workspace/auth` | providers moved to `packages/auth`; per-app binding via `config/auth.ts` (cookie `spark-auth`) and `lib/auth.ts`. The agent was cut off mid-task (session closed) and resumed from the working tree |
| T6 docs and skills | providers/authentication/data-fetching/project-structure rewritten; `docs/migration` and `openapi.yaml` removed |
| T7 cloud DB | linked project `hpfoxckpnqetradspnwe`, 10 migrations pushed, advisors clean, types regenerated, access-token hook enabled, email confirmation off, redirect URLs added |
| pgTAP | 5 files converted from `pg_prove` style to the runner's `tap_out` convention: 50/50 pass |
| T8 e2e | 11/11 pass with `--workers=1` |
| T9 review (Opus) | no blocker; one real bug fixed: the 401 -> sign-out hook ran inside `fetch`, where postgrest-js swallows the redirect. `unwrap` is now async and handles 401/PGRST301/PGRST303 (`ensureOk`, 6 unit tests) |

## 3. Later requests

- **Vercel env:** all 17 old variables removed (Production + Preview); four re-added (`AUTH_PROVIDER`,
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_APP_URL`). Removing them does not
  revoke the old credentials at their provider. The first attempt was blocked by the auto-mode classifier until the
  user allowed it.
- **Members page:** route, nav entry, icon, smoke step and `members:*` permissions removed. `admin` and `member` now
  have the same permissions (the role seam is kept on purpose).
- **CI:** simulated from a clean state (`--frozen-lockfile`, placeholder env, no `.env.local`, `--force`): 13/13 tasks
  green. GitHub Actions on the pushed commits also went green.
- **Performance** (production build, from Vietnam): TTFB 6-11 ms (Partial Prerender shell); full content 0.5-3.6 s
  locally, dominated by the network to Tokyo (single requests 0.15-9 s that day, so absolute numbers are unreliable).
  The Vercel project ran in `iad1` while the DB is in Tokyo; `apps/web/vercel.json` now pins `hnd1`. After deploy:
  pages 0.34-0.84 s (account 1.7 s, not investigated). Single run, noisy.
- **Test data:** the fixed `admin@gmail.com` account (known weak password, role admin) was deleted from the DB. The
  smoke test now signs up a fresh user per run. `pnpm --filter @workspace/db db:clean-test-users` removes the
  `*@example.test` users the e2e runs leave behind (12 removed).
- **Vercel skills:** evaluated 9; installed 4 (`vercel-react-best-practices`, `vercel-composition-patterns`,
  `vercel-react-view-transitions`, `web-design-guidelines` with `command.md` pinned to `434b7f9`). Skipped
  `deploy-to-vercel` (uploads the whole directory to an unauthenticated endpoint), `vercel-cli-with-tokens` (prints
  tokens), `vercel-optimize` (needs a paid plan), `writing-guidelines`, `react-native-skills`. Overrides live in
  `docs/vercel-skills.md`; the earlier claim that no composition guidance existed was wrong (the rules were already in
  `docs/project-structure.md`).

## 4. Audit after the skills (finished)

A read-only audit (Opus) found three must-fix items and a list of low-risk ones; false positives were listed and left alone.

- Must fix: malformed ids in `/dashboard/goals/[id]` and `/habits/[id]` raise a 22P02 error page instead of 404; the
  Better Auth secret falls back to a public placeholder outside the build; a shadcn file (`packages/ui` `item.tsx`) was
  edited.
- Low risk: invalidate cache when a second write fails, validate `position`/`move`, parallelise reads on the habits
  pages, stale FastAPI/chapters comments, hard-coded routes, spinner `data-icon`, `useContext` -> `use`, dead
  `empty-state.tsx`, unused `options.fetch`.
- The user interrupted the work ("stop and record"); two implementers were stopped with a partial diff
  (`goals/[goalId]`, `goals`, `habits`, `habits/[habitId]` pages, `packages/auth` config and a new `config.test.ts`),
  then resumed from the working tree.

Outcome (plan `docs/superpowers/plans/2026-10-23-audit-fixes.md`, tasks 1-7, all on `main`):

- `c3c5147` fix(web): return 404 for malformed goal and habit ids
- `6edb1d0` fix(auth): fail loudly on a missing Better Auth secret outside the build
- `f208829` fix(ui): restore the upstream item component and set roles in the app
- `fc0492b` fix(web): keep caches fresh after partial writes and validate action input
- `75811ae` fix(web): reject checkpoint positions beyond int4
- `75b4154` perf(web): start habit page reads in parallel
- `d609364` refactor(web): follow React 19, shadcn and route-constant conventions
- Task 7 (dead code, stale copy, doc drift, import grouping): see the commit `chore: remove dead code and fix stale copy and docs`.

Parked, not fixed:

- The parity case "signing out ends the session" fails under `next dev`. Cause (diagnosed from the Next source, not
  reproduced with a browser): `next dev` runs `assessUpgrade` (`next/dist/server/lib/router-server.js` ~180,
  `lib/upgrade/nudge.js`) and flags Next 16.4.0 as having a known security vulnerability. The devtools then show an issue
  pill at bottom-left (the default `devIndicators` position) that covers the account button in the sidebar, so
  Playwright's click is intercepted by `<nextjs-portal>`. Not a code regression. Options: upgrade Next to the patched
  version (needs the user's go-ahead, separate commit), move `devIndicators` to bottom-right, or run e2e on `next start`.
- `next dev` prints a Next 16.4.0 notice to run `next upgrade --agent=security`; not acted on.
- Not touched on purpose (judged low value): robots, sitemap and an expired-session page; the dither-meter style;
  `activities/actions.ts`.

## 5. Commits on `main`

Pushed earlier: `b847dad` refactor (Supabase + packages), `2d2fe58` docs, `cb487a4` Members removal, `53890fe` hnd1,
`f18bbf2` smoke test, `8291728` db:clean-test-users, `54d2dfe` Vercel skills.

Audit fixes, pushed together with the commit `chore: finish audit follow-ups` that records them: `8a91a18`, `b980ee2`,
`c3c5147`, `6edb1d0`, `f208829`, `fc0492b`, `75811ae`, `75b4154`, `d609364`, `b2e2527`.

## 6. Known gaps

- `skills-lock.json` does not list the four new skills (the existing hash scheme could not be reproduced).
- A new session has not been used to confirm the skills trigger and the override block is read.
- Playwright with several workers is flaky against the dev server; use `--workers=1`. Cause not investigated.
- `/dashboard/settings/account` was the slowest page in the production measurement; not investigated.
- `apps/web/.env.prod` (untracked) still holds the old FastAPI variables.
