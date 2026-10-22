# Providers: Supabase (default) and the Better Auth foundation

Spark runs on **Supabase**: identity from Supabase Auth, data through PostgREST + RLS + SQL functions. Better Auth is
kept only as an **identity foundation** (sign-in/sign-up work, but no data path exists behind it since the FastAPI
backend was dropped; `spark-backend` and commit `f095cf9`/`91c11f0` are history). The provider is chosen by one env var;
pages, queries, actions, cache, components and the DAL do not know which one is active.

| `AUTH_PROVIDER` | Identity | Data | Schema lives in |
| :--- | :--- | :--- | :--- |
| `supabase` (default) | Supabase Auth (GoTrue), ES256 JWT, cookies via `@supabase/ssr` | PostgREST + RLS + SQL functions through `createDataClient` | `packages/db/supabase/migrations` (Supabase CLI) |
| `better-auth` | Better Auth inside Next (`/api/auth/*`), session in the `auth` schema of a Postgres | none (identity only) | n/a |

With `AUTH_PROVIDER=better-auth` a user can sign in, but feature data is read through Supabase PostgREST with the token
the provider mints, which Supabase does not accept: it is not runnable end-to-end. Pick it only to start a project whose
data layer is not Supabase.

Not supported on purpose (each would double the test matrix): switching at runtime, a generic repository layer.

## 1. Where things live

| Piece | Files | Notes |
| :--- | :--- | :--- |
| Auth adapters | `packages/auth` (`@workspace/auth/{config,permissions,types,server,proxy,better-auth-handler}`) | Zero Spark business rules; Just-in-Time TypeScript source behind `exports` |
| Per-app binding | `apps/web/config/auth.ts` (`AUTH_OPTIONS`, cookie `spark-auth`), `apps/web/lib/auth.ts`, `lib/dal.ts`, `proxy.ts`, `app/api/auth/[...all]/route.ts` | The app picks the cookie name and calls the adapters |
| Data client | `packages/db` (`@workspace/db/{env,server,errors,types}`), wrapped by `apps/web/lib/data.ts` | `createDataClient(accessToken)`: requests run as the user so RLS applies; `lib/data.ts` adds the 401 => `endRejectedSession` fetch hook; `unwrap` throws `DataError` |
| Schema, tests, seed | `packages/db/supabase/{migrations,tests,seed.sql,config.toml}` | Commands below |
| Errors | `apps/web/lib/errors.ts` | `isExpectedDataError` covers rule/constraint codes; actions return rule errors as values |
| OAuth callback | `app/auth/callback/route.ts` | `exchangeCodeForSession`; only Supabase uses it |
| Calendar in the token | `Session.calendar`, `AuthProvider.refreshSession`, `getCalendar()`, `refreshSessionClaims()` | Timezone / week start / adoption date from the Custom Access Token Hook (§5) |
| CSP | `next.config.ts` | `form-action` adds the Supabase origin on the Supabase provider |

ESLint: components never import `@/lib/data`, `@workspace/db/server`, or `@workspace/auth/{server,config,better-auth-handler}`.

## 2. Running

### 2.1 Spark (Supabase)
1. `apps/web/.env.local`: `AUTH_PROVIDER=supabase`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   (publishable key only; never a secret or `service_role` key). See `apps/web/.env.example`.
2. `pnpm --filter web dev`.

### 2.2 Schema workflow (from the repo root)
Create the Supabase project in the region closest to **where Next will be deployed**: every data call is one network
round trip (§5).
1. `pnpm --filter @workspace/db exec supabase login` (or `SUPABASE_ACCESS_TOKEN`, a scoped token), then
   `supabase link --project-ref <ref>` from `packages/db`.
2. `supabase migration new <name>` in `packages/db`, write the SQL (rules in §4).
3. `pnpm --filter @workspace/db db:push`. Push the migrations **before** enabling the hook: an enabled hook whose
   function is missing blocks every sign-in.
4. `pnpm --filter @workspace/db db:types` regenerates `src/database.types.ts` (consumed through `@workspace/db/types`).
5. `pnpm --filter @workspace/db db:test` runs pgTAP (`packages/db/supabase/tests`; runs against the linked project through the Management API, no Docker or local stack).
6. Auth settings: site URL and `<app>/auth/callback` as a redirect URL, in the dashboard or with `supabase config push`.
   `config push` writes **every** property `config.toml` declares, including local-only ones (email rate limit, MFA
   off): to push one block, run it with `--workdir <dir>` whose `supabase/config.toml` declares only that block, and
   preview with `supabase config diff`. Enable `[auth.hook.custom_access_token]` only after step 3.

### 2.3 A new project from this base
Reuse the packages: set the env vars, point `packages/db/supabase` at the new project (§2.2), write the feature
`server.ts` files with `createDataClient` + `unwrap` (example: `features/goals/server.ts`), run the parity checklist (§7)
for the flows the project has.

## 3. The seams (the only code that knows the provider)

| Seam | Files | Rule |
| :--- | :--- | :--- |
| Config | `@workspace/auth/config` | Discriminated union on `AUTH_PROVIDER`; each provider lists only its own env vars |
| Identity | `packages/auth/src/{supabase,better-auth}/` | Implements `AuthProvider` (`@workspace/auth/types`) + proxy `updateSession`; picked in `@workspace/auth/server` and `@workspace/auth/proxy` |
| Feature data | `features/<x>/server.ts` -> `@/lib/data` -> `@workspace/db/server` | Returns Zod-parsed DTOs; nothing else touches the database |
| Errors | `lib/errors.ts` | `isExpectedDataError` covers `DataError` rule/constraint codes; a rejected token ends the session |
| Calendar in the token | `Session.calendar`, `AuthProvider.refreshSession`, `getCalendar()` (`features/settings/queries.ts`) | Optional: without it `getCalendar()` falls back to the settings read |
| OAuth callback | `app/auth/callback/route.ts` | Only Supabase uses it; Better Auth handles its own callback |

## 4. Developing on Supabase

Data calls live only in `features/<x>/server.ts` and the DAL; components never import them (ESLint).
- `server.ts` throws (`DataError`); actions return `isExpectedDataError` cases as values (message without the `XX-n:`
  prefix, `rule` from `ruleOf`) and rethrow the rest. A failed read throws; it never becomes `[]`.
- A token PostgREST rejects, or a user deleted while the token lives, calls `endRejectedSession()` (-> `/auth/expired`).
- Data that changes a token claim (`calendar`): the action calls `refreshSessionClaims()` after the write.
- Every table in `public`: RLS on, explicit `grant`s (new projects do not expose tables to the Data API), policies
  `to authenticated` with the ownership check in `using` **and** `with check` for updates.
- Rules that span rows or must not be bypassed go in SQL (`check`, triggers, RPCs). `security definer` only in the
  `private` schema, with an `auth.uid()` check, `set search_path = ''`, `execute` revoked from `public`/`anon`.
- Roles from `app_metadata` (never `user_metadata`). `getClaims()` for identity, `getUser()` before sensitive actions,
  `getSession()` only to forward the token. Tokens are refreshed only in `proxy.ts`.
- Unknown schema? Read `packages/db/supabase/migrations` and the generated types (`@workspace/db/types`); do not guess.
- After each migration: `db:push`, `supabase db advisors --linked`, `db:types`.

## 5. Latency: what was measured and what to do

Measured on Supabase cloud (ap-south-1) from Vietnam, production build:
- Postgres time per query ~0.06 ms (`supabase inspect db calls --linked`); the network round trip ~150 ms. A page costs
  its number of **sequential** round trips, not its number of queries. Indexes and query tuning do not help at this size.
- Pages read settings (timezone) before the today-keyed reads: two round trips in a row, hard load ~630 ms.
- Timezone, week start and adoption date in the JWT (hook) + the goal read started alongside the rest: ~315 ms on all six
  dashboard pages. The floor is React's Suspense reveal, not data.

Re-measured 2026-10-22 on the Spark project (ap-northeast-1, Tokyo), production build run locally from Vietnam:
- TTFB 6-11 ms (the Partial Prerender shell); full streamed content 0.5-3.6 s. The wait is the Supabase round trips: the
  link was unstable that day (single requests 0.15-9 s), so treat the absolute numbers as unreliable. The sequential
  round-trip count is unchanged from the design above.
- The Vercel project defaulted to `iad1` (US East) while the database is in Tokyo, which adds ~150-200 ms per round trip.
  `apps/web/vercel.json` pins functions to `hnd1`. Re-measure on the deployed app after changing the region.

Rules:
1. Deploy Next in the database's region; choose the region by where Next runs. This alone turns 150 ms into a few ms.
   `apps/web/vercel.json` (`regions: ["hnd1"]`) does this for the Tokyo database; change both together.
2. Count sequential awaits that hit the network. Start every independent read before the first `await`
   ([data-fetching §4.2](data-fetching.md#42-parallel-and-sequential-reads)).
3. A per-user value most pages need first and that rarely changes belongs in the token: a Custom Access Token Hook
   adds the claim; the provider exposes it on `Session`; the action that changes it refreshes the token. The e2e test
   must fail when the refresh is removed (`parity.spec.ts`: "changing the timezone moves Today at once").
4. A not-found check need not run first: start the dependent reads, mark them handled (`reads.catch(() => {})`), check
   the entity, then `await` the reads.
5. Measure before and after in the same conditions: A/B the same build with a switch, check that the server on the port
   is the one you started.

## 6. Behaviour notes

| | `supabase` |
| :--- | :--- |
| "Today" | SQL `private.today_for()` using `user_settings.timezone` |
| Timezone names | Postgres `pg_timezone_names`; checked in `validate_timezone` (TM-2) |
| Revocation delay | <= JWT expiry (1 h default); `verifySessionFresh` asks the server |
| Role source | `app_metadata.role` (never `user_metadata`) |
| Email confirmation | Project setting; `signUp` returns `confirm-email` when on |
| Deleted user with a live token | Missing settings row -> treated as an ended session |
| Timezone, week start for "today" | JWT claims from the hook. Saving settings refreshes the token at once; another device sees the change at its next refresh (<= 1 h) |

## 7. Parity checklist

Automated in `apps/web/e2e/parity.spec.ts` against the running app.

- Sign up -> Today, timezone synced from the browser; sign out -> sign in; wrong password keeps the email.
- Goal -> habit from the goal page -> full / minimum / undo -> reload keeps it; streak updates.
- Back-date day -3 allowed; -4 refused (AC-5).
- `#slug` task -> done -> "Add to log?" -> activity on the goal; pet +1.
- 4th active goal refused (GL-3).
- Weekly review with a pause and two focus tasks (RV-3, RV-4).
- Preferences: timezone (browser list), week start, pet name persist.
- Changing the timezone moves Today at once (the token claims are refreshed).
- Another user's ids: nothing readable, nothing writable.
- Session ended on the server -> next navigation reaches sign-in without a loop.

## 8. Adding another provider

Implement `AuthProvider` + `updateSession` in `packages/auth/src/<name>/`, extend the config union in
`packages/auth/src/config.ts` and `apps/web/.env.example`, wire it in `server.ts` / `proxy.ts` of the package, then run
§7. A provider that is not Supabase also needs its own data path in `features/<x>/server.ts`; the DB token must be one
PostgREST accepts (Supabase's JWKS) or the data layer must change.

## 9. History

`91c11f0` built both stacks (Better Auth + FastAPI, Supabase) behind one switch with parity 8/8 on each. `f095cf9` kept
only the Supabase foundation and ran Spark on Better Auth + FastAPI. The FastAPI backend was then dropped: Spark is back
on Supabase and auth/db are split into `packages/auth` and `packages/db`.
