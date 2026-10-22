# Supabase + @workspace/auth/db Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox syntax.

**Goal:** Drop FastAPI, run Spark's data layer on Supabase again, and split auth/db into `packages/auth` and `packages/db` to mirror `D:\Dev Projects\noi-that-khanh-linh`.

**Architecture:** `features/<x>/server.ts` call Supabase (PostgREST + RLS) through `@/lib/data` (thin wrapper over `@workspace/db/server`). Auth providers (supabase default, better-auth kept as identity foundation) live in `@workspace/auth`, bound per app via `config/auth.ts` + `lib/auth.ts`. Migrations/tests/seed live in `packages/db/supabase`.

**Tech Stack:** Next 16.4, pnpm + turbo, @supabase/ssr + supabase-js, Better Auth (foundation).

**Spec:** user request 2026-10-22 (no separate design doc: user opted out of brainstorming Q&A).

## Global Constraints
- Use pnpm. Conventional Commits, no co-author lines. Commit only when the user asks.
- No `apps/admin` (YAGNI). `@workspace/auth` omits `./schemas`; `@workspace/db` omits `./public` and `./format`.
- Default `AUTH_PROVIDER` is `supabase` (intentional difference from the reference repo).
- Supabase cloud project `hpfoxckpnqetradspnwe`; publishable key only in gitignored `.env.local`.
- `pnpm check` and `pnpm build` must pass after every task.

## Review Focus
- A failed request must throw, never return `[]`.
- Session cookie renamed (`spark-auth`): old sessions are logged out.
- Hook enabled before its function exists blocks all sign-ins: push migrations first.
- ESLint boundaries: components never import `@/lib/data`, `@workspace/db/server`, `@workspace/auth/{server,config,better-auth-handler}`.

---

### Task 1: Restore DB artefacts
`git checkout 91c11f0 -- apps/web/supabase/migrations apps/web/supabase/tests apps/web/supabase/seed.sql apps/web/lib/supabase/database.types.ts` (keep HEAD `config.toml`). Verify `pnpm --filter web typecheck`.

### Task 2: Features on Supabase
For goals, habits, tasks, activities, reviews, settings: `git show 91c11f0:apps/web/features/<x>/server.supabase.ts` becomes `server.ts`; keep export names/signatures of HEAD `server.ts` (compare with `git show 91c11f0:.../server.api.ts`). Adapt any `actions.ts`/`queries.ts` callers. Verify typecheck, lint, test.

### Task 3: Remove FastAPI path
Delete `lib/{http,url,env}.ts`, `lib/__tests__/url.test.ts`, `lib/api/`, `features/*/__tests__/contract.test.ts`, `gen:api` script, `openapi-typescript`/`yaml` devDeps. `git mv lib/supabase/data.ts lib/data.ts` (exports `createDataClient`, `unwrap`, `endRejectedSession`). `lib/errors.ts`: drop `ApiError`. Default `AUTH_PROVIDER=supabase` (config, vitest, CI, `.env.example`, `.env.local`); drop `API_BASE_URL` from turbo/CI. Update eslint groups. Verify: grep for `apiFetch|API_BASE_URL|lib/http|lib/api` is empty; `pnpm check && pnpm build`.

### Task 4: `@workspace/db`
Create `packages/db` (package.json, tsconfig, eslint, vitest, README, `scripts/test-db.mjs` copied from the reference; exports `./env ./server ./errors ./types`; scripts `db:types db:push db:test`). `src/errors.ts` keeps Spark's `unwrap` (null => `DataError("PGRST116")`). `createDataClient(accessToken, options?: { fetch? })`. `git mv` `database.types.ts` and `apps/web/supabase` into the package. `apps/web/lib/data.ts` wraps it and adds the 401 => `endRejectedSession` fetch hook. Move `supabase` CLI devDep to db. Tests for env + errors. Verify filtered turbo run, then `pnpm check && pnpm build`.

### Task 5: `@workspace/auth`
Create `packages/auth` from the reference `src/**` minus `schemas.ts`; patch Spark specifics (roles `member`/`admin`, permissions, `calendarOf` claim, defaults API_AUDIENCE 2210/DB 2211, `BETTER_AUTH_DEFAULT_ROLE="member"`). In web: add `config/auth.ts` (`cookieName: "spark-auth"`), `lib/auth.ts`, update `lib/dal.ts`, `proxy.ts` (keep `/` redirect; read Next proxy docs first), `app/api/auth/[...all]/route.ts`, nav imports, eslint groups; delete `lib/auth/`. Move deps (`better-auth`, `pg`, `@supabase/ssr`) to auth. Verify grep `@/lib/auth/` is empty, `pnpm check && pnpm build`.

### Task 6: Docs and skills (parallel with Task 7)
Update docs/providers.md, authentication.md, data-fetching.md, project-structure.md (§6 justification), AGENTS.md, CLAUDE.md §1, features/README, lib/README, CONTRIBUTING, README, goals-habits/roadmap.md. Delete `docs/migration/`, `docs/goals-habits/openapi.yaml`. Sync next-mono-base skill in `.agents/skills` and `.claude/skills` (`diff -rq --strip-trailing-cr` clean). Create `docs/superpowers/{specs,reports}/.gitkeep`.

### Task 7: Cloud DB
Needs `supabase login`/link (user or access token). `link --project-ref hpfoxckpnqetradspnwe`, `db push`, regenerate types, enable the custom-access-token hook after push, disable email confirmation, seed, pgTAP. Fallback: report unverified.

### Task 8: E2E
Run `parity.spec.ts` against the running app once Task 7 is done.

### Task 9: Final review
`reviewer` (Opus) reviews the whole diff against this plan.
