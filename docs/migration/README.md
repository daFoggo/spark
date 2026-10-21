# Migration: Supabase → Better Auth + FastAPI + PostgreSQL + Docker

Status: **plan, not started**. This folder is the single source of truth for the migration. Agents that get a migration
task read this file first, then the file their task points to. Nothing here changes the product: every rule in
[`goals-habits/spec.md`](../goals-habits/spec.md) (rule IDs `HB-3`, `TK-5`, …) must behave the same after the migration.

| File | What it is | Who reads it |
| :--- | :--- | :--- |
| `README.md` (this) | Goal, target architecture, decisions, phases, global checklists, how to hand out work | Everyone |
| [`target-architecture.md`](target-architecture.md) | FastAPI layout, conventions, errors, DB, OpenAPI, tests, Docker | Platform + every module agent |
| [`auth-better-auth.md`](auth-better-auth.md) | Better Auth design inside Next.js and token verification in FastAPI (built from scratch) | Auth agent; module agents read §5 |
| [`module-playbook.md`](module-playbook.md) | The step-by-step procedure for migrating one module, with templates and the agent prompt | Every module agent |
| [`modules/*.md`](modules) | Baseline inventory of each module (what exists today) + its parity checklist | The agent of that module |

---

## 1. Goal and definition of done

At the end of the migration:

1. `apps/web` runs with **`AUTH_PROVIDER=better-auth`** only. The `supabase` provider, `@supabase/*` packages,
   `lib/supabase/*`, `apps/web/supabase/` and the `backend` iron-session provider are deleted.
2. **Better Auth** runs inside Next.js (`/api/auth/*`) and owns identity (users, sessions, accounts, Google OAuth).
3. **FastAPI** (`apps/api`) owns all domain data and business rules; every `features/*/server.ts` calls it through
   `lib/http.ts` (`apiFetch`) with a Better Auth JWT as Bearer token.
4. One **PostgreSQL** holds two schemas: `auth` (Better Auth tables) and `public` (domain tables). Alembic is the only
   tool that applies migrations.
5. **Docker Compose** starts `db`, `migrate`, `api`, `web` for local and production-like runs.
6. Every module has a ticked parity checklist (`modules/<name>.md`) comparing before vs after, and the global checklist
   in §7 is ticked.
7. `pnpm check` and `pnpm build` pass (they include the Python checks through `apps/api/package.json`), the backend test
   suite passes, and the flows in §7.3 were exercised in the running stack.

## 2. What exists today (summary)

Details per module are in `modules/*.md`. Facts that shape the plan:

- **Two auth providers already exist** behind one interface (`lib/auth/types.ts` `AuthProvider`, `Session { userId,
  accessToken, role, name, email }`): `supabase` (used in practice) and `backend` (iron-session cookie around a REST
  backend's access/refresh tokens, never used with a real backend). DAL (`lib/dal.ts`), `proxy.ts` and Server Actions
  only talk to the interface.
- **Feature data goes through Supabase**, not through `apiFetch`: `features/*/server.ts` call `createDataClient(accessToken)`
  (`lib/supabase/data.ts`), i.e. PostgREST with RLS. Business rules live **in Postgres**: RPCs (`toggle_check_in`,
  `create_habit`, `set_habit_schedule`, `create_goal`, `set_checkpoint_done`, `move_checkpoint`, `set_task_done`,
  `log_task`, `complete_review`), triggers (`check_activity_window`, `enforce_goal_rules`, `validate_timezone`,
  `handle_new_user`, `set_updated_at`), RLS policies with `auth.uid()` and ownership helpers (`private.owns_*`), column
  grants.
- **The seam is `server.ts`**: queries/actions call `server.ts` functions that take `accessToken` and return Zod-parsed
  camelCase DTOs. A contract already exists: [`goals-habits/openapi.yaml`](../goals-habits/openapi.yaml) (OpenAPI 3.1),
  with types generated into `lib/api/schema.d.ts` and `features/*/__tests__/contract.test.ts` failing when a DTO drifts.
  Migrating a module is therefore: implement the contract in FastAPI, then rewrite that module's `server.ts` to
  `apiFetch`. Queries, actions, components, cache tags and pages should not need changes beyond error mapping.
- **Pure rules stay in TypeScript**: `habits/stats.ts`, `pet/pet.ts`, `tasks/rules.ts`, `goals/rules.ts`,
  `reviews/rules.ts`, `lib/dates.ts` compute stats from raw rows. They are not moved (§4, D7).
- Known gaps to resolve during the migration (each module file lists its own): request schemas that miss fields the
  app sends (`TaskCreate`/`TaskPatch` lack `goalId`/`focusFrom`, `ReviewComplete` vs path `weekStart`); `RuleViolation`
  (`{ rule, message }`) does not match what `lib/http.ts` reads (`detail`); the Supabase sign-up can answer "confirm your
  email" (unreachable after Q2); there is no password reset flow (out of scope, Q2/Q5).

## 3. Target architecture

Two services, two domains (Q4): `web` at `https://app.<domain>` and `api` at `https://api.<domain>`, deployed and
scaled separately, sharing one PostgreSQL.

```
Browser ──cookie (better-auth.session_token, host app.<domain>)──▶ web: Next.js (apps/web)  https://app.<domain>
                                             ├─ /api/auth/*  Better Auth (sign-in/up/out, Google, /jwks)          
                                             ├─ proxy.ts     session refresh + optimistic redirect
                                             ├─ lib/dal.ts   getSession → { userId, role, name, email, accessToken = JWT }
                                             └─ features/*/server.ts ──HTTPS, Bearer JWT──▶ api: FastAPI (apps/api)  https://api.<domain>/v1/*
                                                                                              ├─ verifies JWT: iss = app.<domain>, aud = api.<domain>,
                                                                                              │  keys from https://app.<domain>/api/auth/jwks (cached)
                                                                                              └─ SQLAlchemy ─▶ PostgreSQL schema "public"
                                             Better Auth (pg Pool) ─────────────────────────────▶ PostgreSQL schema "auth"
```

- The browser still never calls FastAPI (D15): Next.js Server Components/Actions call it server-to-server. No CORS, no
  cross-domain cookies, no token in the browser. The API domain is public, so it is hardened as an internet-facing
  service (target-architecture §8).
- Identity is decided by Better Auth; FastAPI trusts only a valid JWT (`sub` = user id). Domain tables keep `user_id`
  with a foreign key to `auth."user"(id)`.

## 4. Decisions

Each decision has a short reason. Changing one is an ADR (`engineering:architecture` skill) and an edit here.

| # | Decision | Reason / alternative rejected |
| :--- | :--- | :--- |
| D1 | Better Auth runs **in Next.js**, mounted at `/api/auth/[...all]`; FastAPI does not issue identity | Better Auth is a TypeScript library; a FastAPI auth server would mean writing auth by hand |
| D2 | FastAPI authenticates with the Better Auth **JWT plugin** (EdDSA, JWKS at `/api/auth/jwks`), verified with PyJWT + `PyJWKClient` | Stateless, standard, testable with a fixture key. Rejected: FastAPI reading the `session` table (couples it to Better Auth's schema, one DB hit per call) |
| D3 | One Postgres, schema `auth` for Better Auth, `public` for domain; **Alembic owns every migration**, Better Auth SQL comes from its CLI `generate` and is committed as an Alembic revision | One migration history; `migrate` from the Better Auth CLI is not used in deployments |
| D4 | User ids are **UUID** (`advanced.database.generateId: "uuid"`), so domain `user_id uuid` columns keep their type | Keeps the domain schema unchanged. Gate: verify the generated column type (auth §3) |
| D5 | **Business rules move to Python services** (`service.py`); declarative invariants stay in the DB (CHECK, NOT NULL, FK, unique and partial unique indexes). PL/pgSQL RPCs and `auth.uid()` triggers are removed | Testable in pytest, one place for rules. Concurrency-sensitive rules use row locks (`SELECT … FOR UPDATE`) or a DB constraint, recorded per rule in the module file |
| D6 | **No RLS**. Every repository query filters by `user_id = current_user.id`; referenced ids (`goal_id`, `habit_id`, `task_id`) are checked for ownership in the service; someone else's id answers **404** | FastAPI connects as one DB role; RLS would need `set_config` per transaction. Covered by mandatory cross-user tests in every module |
| D7 | Stats/pet rules stay in TypeScript and keep reading raw rows from the API (`listCheckIns`, `listActivities`, …) | Spec §6.4; avoids a second implementation. Moving them is a later, separate change |
| D8 | `docs/goals-habits/openapi.yaml` stays the **contract (OpenAPI 3.1)**; FastAPI's `/openapi.json` is diffed against it in CI. Upgrade to 3.2 only when FastAPI and `openapi-typescript` both support it (neither does today) | Contract-first is already wired (`contract.test.ts`) |
| D9 | JSON on the wire is **camelCase** (Pydantic `alias_generator=to_camel`), dates `YYYY-MM-DD` | Matches the contract and the Zod DTOs |
| D10 | Errors are **RFC 9457 problem details** (`application/problem+json`): `{ type, title, status, detail, rule? , errors? }`; rule violations are `422` with `rule` = spec ID | `lib/http.ts` already reads `detail`; actions read `rule`. The contract's `RuleViolation` is updated accordingly |
| D11 | "Today" is computed in Python from `user_settings.timezone` through one injectable clock (`core/clock.py`) | Replaces `private.today_for`; lets tests freeze time (AC-5, TK-4) |
| D12 | `user_settings` row is created by an Alembic-owned trigger `after insert on auth."user"` | Same behaviour as `handle_new_user` (atomic with sign-up); no network hop between Better Auth and FastAPI |
| D13 | Migration is incremental on `main`: during the migration each module's `server.ts` picks its implementation by `AUTH_PROVIDER` (`supabase` → old code, `better-auth` → `apiFetch`); the old branch is deleted at cutover (Phase 9) | Keeps `main` deployable and lets the same seed data be compared on both stacks (parity). Rejected: one long-lived branch |
| D14 | Python tooling: `uv`, Python 3.13, FastAPI, SQLAlchemy 2 async + asyncpg, Alembic, Pydantic v2 + pydantic-settings, PyJWT[crypto], pytest + httpx `AsyncClient`, ruff, pyright. `apps/api/package.json` exposes `lint`/`typecheck`/`test`/`dev` so Turborepo runs them | Fits the monorepo's `pnpm check` / `pnpm build` definition of done |

| D15 | The browser never calls FastAPI; `web` calls `api` server-to-server over HTTPS | Keeps spec §6.1 (no browser data access); avoids CORS, cross-domain cookies and exposing the JWT to JavaScript |

Answered by the user on 2026-10-21:

| # | Question | Answer |
| :--- | :--- | :--- |
| Q1 | Import existing Supabase users and data? | **No.** Start with an empty database; no import phase |
| Q2 | Email verification and password reset? | **Neither for now** (`requireEmailVerification: false`, no reset). The app sends no email, so no email provider is needed (Q5). Adding reset later: auth-better-auth §10 |
| Q3 | Minimum password length? | **6** (current form), since Better Auth lets `minPasswordLength` be configured; fall back to 8 only if gate G8 shows it cannot be lowered |
| Q4 | Deployment? | **Two services on two domains** (`web`, `api`) → §3, D15, target-architecture §8 |

| Q5 | Email provider (SMTP)? | **Not needed**: no feature sends email (no reset, no verification) |
| Q6 | Remove the unused `backend` (iron-session) provider at Phase 9 together with Supabase? | **Yes**, delete it (P9.1) |

## 5. Phases (roadmap)

A phase starts when the previous one is done, except where "parallel" is written. Each phase ends with its checklist
ticked in the PR that delivers it. Rule IDs and checklist IDs (`P1.3`) go in commit messages and PRs.

### Phase 0: Inventory sign-off

- [x] P0.1 Each `modules/<name>.md` "Inventory" section is checked against the code by its module agent (step 1 of the
      playbook) and the gaps it found are listed under "Open questions".
- [x] P0.2 Open decisions Q1–Q6 answered (2026-10-21).
- [x] P0.3 Contract fixes agreed: `RuleViolation` → problem details (D10); 404s documented where the code can miss a
      row; request schemas completed (`TaskCreate.goalId`, `TaskPatch.goalId/focusFrom`, `HabitPatch.archived` vs
      `archivedAt`, `editCheckpoint` as `oneOf` rename|move); every other mismatch listed in the module files.

### Phase 1: Platform (backend skeleton, DB, Docker, contract tooling)

Read [`target-architecture.md`](target-architecture.md). One agent.

- [x] P1.1 `apps/api` created with the layout of target-architecture §2; `uv` project; `package.json` scripts; added to
      the pnpm workspace and Turborepo (`lint`, `typecheck`, `test` run from `pnpm check`).
- [x] P1.2 `core/config.py` (pydantic-settings), `core/db.py` (async engine, `get_session` dependency with one
      transaction per request), `core/errors.py` (problem details + handlers for `RuleViolation`, `NotFound`,
      `RequestValidationError`, `HTTPException`), `core/clock.py`, `core/security.py` (stub: verifies a JWT against a
      configured JWKS; real issuer wired in Phase 2).
- [x] P1.3 `GET /healthz` (no auth) and `GET /v1/me` (auth, returns `{ userId }`) — the smallest end-to-end check.
- [x] P1.4 Alembic configured (async), naming convention for constraints, revision 0001 creates schema `auth` (empty)
      and `private` helpers that are still needed (none expected; record if any).
- [x] P1.5 Test harness: Postgres from Docker (`compose` service or testcontainers), schema created once per session by
      Alembic, each test in a rolled-back transaction, `token_for(user_id)` fixture signing with a test Ed25519 key served
      as a fake JWKS, `frozen_today` fixture.
- [x] P1.6 OpenAPI: `generate_unique_id_function` returns the route `name` so operationIds equal the contract's
      (`listHabits`, …); `scripts/export_openapi.py` writes `apps/api/openapi.json`; CI step diffs it against
      `docs/goals-habits/openapi.yaml` (tool: `oasdiff breaking`, or a pytest that compares paths, operationIds and
      schema properties; pick one and document it).
- [x] P1.7 Docker: `apps/api/Dockerfile` (multi-stage, `uv sync --frozen`, non-root), `apps/web/Dockerfile` (Next
      `output: "standalone"`), each buildable and deployable on its own (two domains, Q4); root `compose.yaml` for local
      runs with `db` (postgres:17), `migrate` (alembic upgrade head, runs once), `api`, `web`; healthchecks;
      `.env.example` per app. `docker compose up` serves `/healthz`.
- [x] P1.10 Internet-facing API hardening (target-architecture §8): TLS at the edge, `TrustedHostMiddleware`, proxy
      headers from the edge only, `/docs` and `/openapi.json` off in production, request size limit, rate limit per IP.
- [x] P1.8 CI: Python job (uv, ruff, pyright, pytest with a Postgres service), the OpenAPI diff, and the existing Node job.
- [x] P1.9 `.claude/launch.json` gets an `api` configuration; `AGENTS.md` and `docs/README`-level tables mention
      `apps/api` and this folder.

### Phase 2: Auth (Better Auth in Next.js, JWT in FastAPI)

Read [`auth-better-auth.md`](auth-better-auth.md). One agent. Parallel with Phase 1 after P1.2.

- [x] P2.1 Better Auth installed in `apps/web`, version pinned; `lib/auth/better-auth/` (`auth.ts` instance,
      `server.ts` provider, `proxy.ts`), route handler `app/api/auth/[...all]/route.ts`.
- [x] P2.2 `AUTH_PROVIDER=better-auth` added to `lib/auth/config.ts` (discriminated union), `getAuthProvider`,
      `updateSession`, `turbo.json` env, `.env.example`, CI placeholders, `vitest.config.ts`.
- [x] P2.3 Schema: Better Auth CLI `generate` output (schema `auth`, uuid ids, plugins `jwt`, `admin` or the `role`
      field) committed as an Alembic revision; `user_settings` trigger (D12).
- [x] P2.4 `AuthProvider` implemented: `getSession` (session + JWT), `verifySessionFresh` (no cookie cache),
      `signIn`, `signUp`, `signOut`, `isExpectedError`, `oauth.start` (Google). OAuth callback handled by Better Auth;
      `app/auth/callback/route.ts` removed when Supabase goes (Phase 9). `minPasswordLength: 6` (Q3).
- [x] P2.5 FastAPI `core/security.py` verifies Better Auth JWTs (issuer = web URL, audience = API URL, EdDSA, `exp`)
      via the public JWKS of `web`; `CurrentUser` dependency; 401 problem details on failure.
- [x] P2.6 Auth parity checklist ([`modules/auth.md`](modules/auth.md)) ticked.

### Phase 3–7: Modules (backend + frontend switch)

Follow [`module-playbook.md`](module-playbook.md) for each. Order follows the data dependencies (a module's foreign
keys and cross-module writes must already exist):

| Phase | Module | Depends on | Cross-module writes it must reproduce |
| :--- | :--- | :--- | :--- |
| 3 | [`settings`](modules/settings.md) | Auth (user row, trigger) | — (everything else reads its timezone/week start) |
| 4 | [`goals`](modules/goals.md) (+ checkpoints) | settings | — (habits/tasks/activities reference goals) |
| 5 | [`habits`](modules/habits.md) (+ schedules, check-ins) | settings, goals | check-in writes an `activities` row, copies `goal_id` (AC-6) |
| 6a | [`activities`](modules/activities.md) | habits, goals | — |
| 6b | [`tasks`](modules/tasks.md) | goals, activities | `log_task` writes an `activities` row (TK-6) |
| 7 | [`reviews`](modules/reviews.md) | habits, tasks | `complete_review` pauses habits (RV-3), sets `tasks.focus_from` (RV-4) |
| — | [`pet`](modules/pet.md) | activities, habits | none (pure, props in); only a parity check of the page |

Parallel work: backend work of 6a and 6b can run in parallel once Phase 5 is merged (they touch different files).
`activities` table DDL lands in Phase 5 (check-ins need it); 6a adds its endpoints.

### Phase 8: (none) Data import from Supabase

Dropped (Q1): production starts with an empty database. Existing Supabase users must sign up again. The local Supabase
stack stays usable until Phase 9 only as the "before" side of parity checks (seed data).

### Phase 9: Cutover and cleanup

- [x] P9.1 Every module's `server.ts` has only the `apiFetch` implementation; `lib/supabase/`, `lib/auth/supabase/`,
      `lib/auth/backend/`, `app/auth/callback/route.ts`, `apps/web/supabase/`, `@supabase/*`, `supabase` CLI and
      `iron-session` removed (Q6); `SESSION_SECRET`/`SESSION_COOKIE_NAME` removed from config, `turbo.json`, CI and
      `vitest.config.ts`; `AUTH_PROVIDER` accepts only `better-auth` (or the switch is removed entirely).
- [x] P9.2 `next.config.ts` CSP: Supabase origin removed from `form-action`; `accounts.google.com` kept.
- [x] P9.3 Docs updated: `docs/authentication.md` rewritten for Better Auth, `goals-habits/spec.md` §4/§6 (backend:
      FastAPI), `data-fetching.md` examples, `AGENTS.md` table, roadmap entries; skills that mention Supabase as the
      backend (`next-mono-base` references) updated.
- [x] P9.4 Global checklist §7 ticked; production env of both services, DNS/TLS for `app.<domain>` and
      `api.<domain>`, and Google redirect URI set.

## 6. Handing out work

- One agent per phase or per module. Give it this prompt (fill the brackets):

  > You are migrating **[module]** of Spark from Supabase to FastAPI (+ Better Auth). Read, in order:
  > `docs/migration/README.md`, `docs/migration/target-architecture.md`, `docs/migration/module-playbook.md`,
  > `docs/migration/modules/[module].md`, and the rules for this module in `docs/goals-habits/spec.md`. Follow the
  > playbook steps 1–9 in order. Do not skip step 1 (re-inventory from code): the module file is a baseline, the code is
  > the truth. Update `modules/[module].md` as you go; your PR is done only when every box in its parity checklist is
  > ticked or explicitly marked "N/A because …". Report what was and was not verified.

- An agent never edits another module's files except through the "cross-module" rows its module file lists, and records
  any contract change in `openapi.yaml` in the same PR.
- Reviews: run `/code-review` on each PR; the reviewer re-runs the parity checklist on a sample (not just reads it).

## 7. Global checklists

### 7.1 Before/after inventory (filled at Phase 9)

| Item | Before (count) | After (count) | Notes |
| :--- | :--- | :--- | :--- |
| OpenAPI operations in `openapi.yaml` | 31 | | Every operation implemented and tested in FastAPI |
| Server Actions in `features/*/actions.ts` | 28 (4 auth + 24 domain) | | Same names and return shapes |
| `server.ts` exported functions | 32 | | Same signatures; only `apiFetch` inside |
| DB tables (domain) | 8 | | `user_settings, goals, checkpoints, habits, habit_schedules, activities, tasks, reviews` |
| RPC functions (public) | 9 | 0 | Each mapped to an endpoint + service (module files) |
| Triggers with business rules | 4 | | `check_activity_window`, `enforce_goal_rules`, `validate_timezone`, `handle_new_user` → where now |
| pgTAP test files | 5 | 0 | Each assertion ported to pytest (module files) |
| Vitest test files | 17 | same or more | No test deleted without a replacement |

### 7.2 Cross-cutting behaviour

- [ ] Every endpoint requires a valid JWT except `/healthz`; missing/expired/forged token → 401 problem details.
- [ ] Every endpoint scoped to the caller: another user's id → 404 (tested per endpoint).
- [ ] A rule violation returns 422 with `rule`; the action shows `detail` without the rule prefix (same text as before).
- [ ] Unexpected errors (5xx, network) still reach `error.tsx`; never turned into `{ error }`.
- [ ] A backend 401 during a render redirects through `/auth/expired`; during an action signs out and goes to `/sign-in`
      (flow 4 in `authentication.md`), with Better Auth's sign-out.
- [ ] Cache tags and `updateTag` calls unchanged (same tag per write as the module file lists).
- [ ] "Today" equals the user's local date at the edges (23:30 and 00:30 local, a UTC+14 and a UTC−10 zone).
- [ ] No token, password or email in logs, cache keys or tags.
- [ ] CSP: no violation in the console during sign-in (email and Google).

### 7.3 End-to-end flows (running Docker stack, desktop + 375 px)

- [ ] Sign up → lands on Today → timezone synced (settings row exists with the browser timezone).
- [ ] Sign out → sign in with email → Today. Wrong password shows the form error, values kept.
- [x] Google sign-in (new user and returning user).
- [ ] Create goal → create habit from the goal page → check in full, minimum, undo → streak/heatmap update → reload keeps it.
- [ ] Back-date a check-in on day −3 (allowed) and day −4 (refused with the AC-5 message).
- [ ] Add task with `#slug` → complete → "Add to log?" → activity appears on the goal page; pet treats +1.
- [x] Goal rules: 4th active refused (GL-3), done without target/checkpoint refused (GL-4); checkpoint add/toggle/move/rename/delete.
- [ ] Weekly review: finish with a pause and 2 focus tasks → habit paused from next week, tasks in Today per RV-4.
- [ ] Settings: change timezone, week start, pet name; invalid timezone refused (TM-2).
- [ ] Session expiry: delete the session row in `auth.session` → next navigation goes to sign-in without a loop.
