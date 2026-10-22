# Providers: Better Auth + FastAPI, or Supabase

`apps/web` is built to run on one of two **stacks**, chosen by a single env var. Pages, queries, actions, cache,
components and the DAL do not know which one is active.

| `AUTH_PROVIDER` | Identity | Data and business rules | Schema lives in |
| :--- | :--- | :--- | :--- |
| `better-auth` | Better Auth inside Next (`/api/auth/*`), EdDSA JWT | FastAPI (`spark-backend`) through `apiFetch` | `spark-backend/migrations` (Alembic) |
| `supabase` | Supabase Auth (GoTrue), ES256 JWT, cookies via `@supabase/ssr` | PostgREST + RLS + SQL functions through `createDataClient` | `apps/web/supabase/migrations` (Supabase CLI) |

**Current state.** Spark runs on `better-auth`. The Supabase **foundation** stays in the base (§1) so a new project can
start on Supabase without setup work. Spark's own Supabase data path (schema, RLS, SQL functions, pgTAP tests, the
`server.supabase.ts` files, the calendar hook) was built, passed parity on both stacks, then removed; it is kept in
commit `91c11f0` as a complete reference (§2.3). With today's code, `AUTH_PROVIDER=supabase` signs users in but feature
data still goes to FastAPI, which does not know Supabase users: it is not runnable end-to-end until §2.2 or §2.3 is done.

Not supported on purpose (each would double the test matrix): switching at runtime, a generic repository layer, mixing an
identity with the other data path without the backend work in §8.

## 1. The Supabase foundation (kept in the base)

Paths relative to `apps/web/`.

| Piece | Files | What it gives a new project |
| :--- | :--- | :--- |
| Config | `lib/auth/config.ts`, `.env.example`, `turbo.json` env | `AUTH_PROVIDER` union; the `supabase` branch needs only URL + publishable key |
| Identity | `lib/auth/supabase/{client,server,proxy}.ts`, `lib/auth/index.ts`, `lib/auth/proxy.ts` | `getClaims()` (local JWT check), `getUser()` for fresh checks, token refresh only in the proxy, `scope: "local"` sign-out, OAuth start |
| OAuth callback | `app/auth/callback/route.ts` | `exchangeCodeForSession`; Better Auth's `/api/auth/*` answers 404 on this stack |
| Data client | `lib/supabase/data.ts`, `lib/supabase/database.types.ts` (placeholder) | `createDataClient(accessToken)`: requests run as the user so RLS applies; a PostgREST 401 ends the session; `unwrap` throws `DataError` |
| Errors | `lib/errors.ts` | `DataError` + `isExpectedDataError` cover both paths; actions return rule errors as values |
| Calendar seam | `Session.calendar`, `AuthProvider.refreshSession`, `getCalendar()`, `refreshSessionClaims()` | A provider that puts timezone / week start / adoption date in the token saves a settings read per page (§5) |
| CLI project | `supabase/config.toml`, `supabase/.gitignore` | Local stack settings, ES256 signing keys path, hook block (commented) |
| CSP | `next.config.ts` | `form-action` adds the Supabase origin on this stack |
| ESLint | `eslint.config.js` | Only `server.ts` may import `server.api` / `server.supabase`; components import no `server.*` |

## 2. Running each stack

### 2.1 Better Auth + FastAPI (Spark today)
1. `apps/web/.env.local`: the `better-auth` block of `.env.example`.
2. `docker compose up -d` in `spark-backend` (Postgres on host port 2211, API on 2210).
3. `pnpm --filter web dev`.

### 2.2 A new project on Supabase (from this base)
Commands run from `apps/web` with `pnpm exec`.
1. Create the project in the region closest to **where Next will be deployed** (and to users): every data call is one
   network round trip (§5). `.env.local`: `AUTH_PROVIDER=supabase`, `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Never a secret or `service_role` key.
2. `supabase login` (or `SUPABASE_ACCESS_TOKEN`, a scoped token), `supabase link --project-ref <ref>`.
3. Schema: `supabase migration new <name>`, write the SQL (rules in §4), `supabase db push`,
   `supabase db advisors --linked`, then `supabase gen types typescript --linked > lib/supabase/database.types.ts`.
4. Feature data: a project with one stack writes `features/<x>/server.ts` directly with `createDataClient` + `unwrap`.
   A repo that keeps both stacks uses the selector: `server.ts` picks `server.api.ts` or `server.supabase.ts` and types
   the second as `typeof api`, so `tsc` fails when they drift (example: `git show 91c11f0:apps/web/features/goals/server.ts`).
5. Auth settings: site URL and `<app>/auth/callback` as a redirect URL, in the dashboard or with `supabase config push`.
   `config push` writes **every** property `config.toml` declares, including local-only ones (email rate limit, MFA
   off): to push one block, run it with `--workdir <dir>` whose `supabase/config.toml` declares only that block, and
   preview with `supabase config diff`.
6. `pnpm --filter web dev`; then the parity checklist (§7) for the flows the project has.

### 2.3 Spark back on Supabase
Everything is in commit `91c11f0`:
1. For each feature: `git mv features/<x>/server.ts features/<x>/server.api.ts`, then
   `git checkout 91c11f0 -- features/<x>/server.ts features/<x>/server.supabase.ts`.
2. `git checkout 91c11f0 -- supabase/migrations supabase/tests supabase/seed.sql lib/supabase/database.types.ts`.
3. `supabase db push`, then enable the hook (uncomment `[auth.hook.custom_access_token]`; push only that block as in
   §2.2.5). Push the migrations first: an enabled hook whose function is missing blocks every sign-in.
4. `e2e/parity.spec.ts` on both stacks (8/8 each at `91c11f0`).

## 3. The seams (the only code that knows the provider)

| Seam | Files | Rule |
| :--- | :--- | :--- |
| Config | `lib/auth/config.ts` | Discriminated union on `AUTH_PROVIDER`; each stack lists only its own env vars |
| Identity | `lib/auth/{better-auth,supabase}/` | Implements `AuthProvider` (`types.ts`) + proxy `updateSession`; picked in `lib/auth/index.ts` and `lib/auth/proxy.ts` |
| Feature data | `features/<x>/server.ts` (+ `server.api.ts` / `server.supabase.ts` when both exist) | Returns the same Zod-parsed DTOs on every path; nothing else calls a backend |
| Errors | `lib/errors.ts` | `isExpectedDataError` covers `ApiError` (4xx) and `DataError` (rule/constraint codes); a rejected token ends the session on both paths |
| Calendar in the token | `Session.calendar`, `AuthProvider.refreshSession`, `getCalendar()` (`features/settings/queries.ts`) | Optional: without it `getCalendar()` falls back to the settings read |
| OAuth callback | `app/auth/callback/route.ts` | Only Supabase uses it; Better Auth handles its own callback |
| CSP | `next.config.ts` | `form-action` adds the Supabase origin only on the Supabase stack |

## 4. Developing on each provider

Both stacks:
- Backend calls live only in `features/<x>/server*.ts` and the DAL; components never import them (ESLint).
- `server*.ts` throws (`ApiError` / `DataError`); actions return `isExpectedDataError` cases as values (message without
  the `XX-n:` prefix, `rule` from `ruleOf`) and rethrow the rest. A failed read throws; it never becomes `[]`.
- A token the backend rejects, or a user deleted while the token lives, calls `endRejectedSession()` (→ `/auth/expired`).
- Data that changes a token claim (`calendar`): the action calls `refreshSessionClaims()` after the write.

Supabase specifically (Supabase skill: `.agents/skills/supabase`):
- Every table in `public`: RLS on, explicit `grant`s (new projects do not expose tables to the Data API), policies
  `to authenticated` with the ownership check in `using` **and** `with check` for updates.
- Rules that span rows or must not be bypassed go in SQL (`check`, triggers, RPCs). `security definer` only in the
  `private` schema, with an `auth.uid()` check, `set search_path = ''`, `execute` revoked from `public`/`anon`.
- Roles from `app_metadata` (never `user_metadata`). `getClaims()` for identity, `getUser()` before sensitive actions,
  `getSession()` only to forward the token. Tokens are refreshed only in `proxy.ts`.
- After each migration: `db push`, `db advisors --linked`, `gen types`. pgTAP (`supabase test db`) needs the local CLI
  stack; this project works on the cloud project only.

FastAPI specifically: the API contract is `spark-backend`'s OpenAPI (`/openapi.json`); regenerate `lib/api/schema.d.ts`
after it changes. Business rules are enforced in the service layer and mirrored in `features/<x>/rules.ts` for the UI.

## 5. Latency: what was measured and what to do

Measured on Supabase cloud (ap-south-1) from Vietnam, production build:
- Postgres time per query ~0.06 ms (`supabase inspect db calls --linked`); the network round trip ~150 ms. A page costs
  its number of **sequential** round trips, not its number of queries. Indexes and query tuning do not help at this size.
- Pages read settings (timezone) before the today-keyed reads: two round trips in a row, hard load ~630 ms.
- Timezone, week start and adoption date in the JWT (hook) + the goal read started alongside the rest: ~315 ms on all six
  dashboard pages, the same as local FastAPI. The floor is React's Suspense reveal, not data.

Rules:
1. Deploy Next in the database's region; choose the region by where Next runs. This alone turns 150 ms into a few ms.
2. Count sequential awaits that hit the network. Start every independent read before the first `await`
   ([data-fetching §4.2](data-fetching.md#42-parallel-and-sequential-reads)).
3. A per-user value most pages need first and that rarely changes belongs in the token: a Custom Access Token Hook
   (Supabase) adds the claim; the provider exposes it on `Session`; the action that changes it refreshes the token. The
   e2e test must fail when the refresh is removed (`parity.spec.ts`: "changing the timezone moves Today at once").
4. A not-found check need not run first: start the dependent reads, mark them handled (`reads.catch(() => {})`), check
   the entity, then `await` the reads. Trade-off on FastAPI: the refused read is logged as a server error on that 404.
5. Measure before and after in the same conditions: A/B the same build with a switch, check that the server on the port
   is the one you started.

## 6. Behaviour that differs (documented, not hidden)

| | `better-auth` | `supabase` |
| :--- | :--- | :--- |
| "Today" | Python (`core/clock.py`, D11) | SQL `private.today_for()` using `user_settings.timezone` |
| Timezone names | Python `zoneinfo` | Postgres `pg_timezone_names`; checked in `validate_timezone` (TM-2) |
| Revocation delay | ≤ 5 min (cookie cache) | ≤ JWT expiry (1 h default); `verifySessionFresh` asks the server |
| Role source | `user.role` column → JWT claim | `app_metadata.role` (never `user_metadata`) |
| Email confirmation | Off (Q2) | Project setting; `signUp` returns `confirm-email` when on |
| Deleted user with a live token | API 401 → `/auth/expired` | Missing settings row → treated as an ended session |
| Timezone, week start for "today" | Settings read (API, ~5 ms locally) | JWT claims from the hook. Saving settings refreshes the token at once; another device sees the change at its next refresh (≤ 1 h) |

## 7. Parity checklist

Automated in `apps/web/e2e/parity.spec.ts`: switch `AUTH_PROVIDER`, restart `next dev`, run it again.

- Sign up → Today, timezone synced from the browser; sign out → sign in; wrong password keeps the email.
- Goal → habit from the goal page → full / minimum / undo → reload keeps it; streak updates.
- Back-date day −3 allowed; −4 refused (AC-5).
- `#slug` task → done → "Add to log?" → activity on the goal; pet +1.
- 4th active goal refused (GL-3).
- Weekly review with a pause and two focus tasks (RV-3, RV-4).
- Preferences: timezone (browser list), week start, pet name persist.
- Changing the timezone moves Today at once (the token claims are refreshed).
- Another user's ids: nothing readable, nothing writable.
- Session ended on the server → next navigation reaches sign-in without a loop.

## 8. Adding a third stack, or mixing

Implement `AuthProvider` + `updateSession` in `lib/auth/<name>/`, the feature data per §2.2.4, extend the config union and
`.env.example`, then run §7. If only the identity changes (e.g. Supabase Auth with FastAPI), skip the data files: point
FastAPI's `AUTH_JWKS_URL` / `AUTH_ISSUER` / `AUTH_AUDIENCE` at the provider (Supabase:
`https://<ref>.supabase.co/auth/v1/.well-known/jwks.json`, issuer `https://<ref>.supabase.co/auth/v1`, audience
`authenticated`) and make FastAPI accept users it did not create (today `get_existing_user` returns 401 for them).

## 9. History

Built in `91c11f0`: one switch for the whole stack; Supabase stack restored from `520fc96^` instead of rewritten; schema
pushed to a cloud project; three never-run pgTAP files fixed (50/50); advisors clean; PostgREST probed with real tokens
(13/13: AC-5, GL-3, cross-user read/update/delete/RPC refused, anon and forged tokens refused); parity 8/8 on both
stacks; the latency work of §5. The next commit kept only the foundation (§1).
