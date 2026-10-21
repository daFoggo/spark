# Providers: Better Auth + FastAPI, or Supabase

`apps/web` runs on one of two **stacks**, chosen by a single env var. Everything else (pages, queries, actions, cache,
components, DAL) is the same code. This file is the switching guide and the roadmap that built it.

| `AUTH_PROVIDER` | Identity | Data and business rules | Schema lives in |
| :--- | :--- | :--- | :--- |
| `better-auth` | Better Auth inside Next (`/api/auth/*`), EdDSA JWT | FastAPI (`spark-backend`) through `apiFetch` | `spark-backend/migrations` (Alembic) |
| `supabase` | Supabase Auth (GoTrue), ES256 JWT, cookies via `@supabase/ssr` | PostgREST + RLS + SQL functions through `createDataClient` | `apps/web/supabase/migrations` (Supabase CLI) |

Not supported on purpose (each would double the test matrix): mixing an identity with the other data path, switching at
runtime, a generic repository layer. Mixing is possible later: Supabase Auth + FastAPI only needs FastAPI to verify
Supabase JWTs (§6).

## 1. Switching

1. Copy the block of the stack from `apps/web/.env.example` into `apps/web/.env.local`; set `AUTH_PROVIDER`.
2. Start the data side:
   - `better-auth`: `docker compose up -d` in `spark-backend` (Postgres on host port 5433, API on 8000).
   - `supabase` local (from `apps/web`, prefix commands with `pnpm exec`): once per machine
     `supabase gen signing-key --algorithm ES256` and save the printed key as `supabase/signing_keys.json` (a JSON
     array, gitignored) so JWTs are ES256 like hosted projects and `getClaims()` verifies locally; then
     `supabase start` (add `-x realtime,storage-api,imgproxy,edge-runtime,logflare,vector,supavisor,mailpit,postgres-meta,studio`
     for a lighter stack) and `supabase db reset` (migrations + seed). It prints the URL and publishable key.
   - `supabase` hosted: `supabase login` (or `SUPABASE_ACCESS_TOKEN`, a scoped token), `supabase link --project-ref <ref>`,
     `supabase db push`, then enable the Custom Access Token Hook (`[auth.hook.custom_access_token]` in
     `config.toml`) and set the Auth URLs (site URL, `<app>/auth/callback` as a redirect URL). `supabase config push`
     pushes every property `config.toml` declares, including local-only ones (email rate limit, MFA off); to push
     only the hook, run it with `--workdir` pointing at a folder whose `supabase/config.toml` declares just that
     block, or use the dashboard (Authentication > Hooks). Push the migrations first: an enabled hook whose function
     is missing blocks every sign-in. New projects do not expose tables to the Data API by default; the migrations
     `grant` exactly what `authenticated` needs, so nothing else is required.
3. `pnpm --filter web dev`. Nothing else changes.

## 2. The seams (the only code that knows the provider)

| Seam | Files | Rule |
| :--- | :--- | :--- |
| Config | `lib/auth/config.ts` | Discriminated union on `AUTH_PROVIDER`; each stack lists only its own env vars |
| Identity | `lib/auth/{better-auth,supabase}/` | Implements `AuthProvider` (`types.ts`) + proxy `updateSession`; picked in `lib/auth/index.ts` and `lib/auth/proxy.ts` |
| Calendar in the token | `Session.calendar`, `AuthProvider.refreshSession`, `getCalendar()` (`features/settings/queries.ts`) | Optional: a provider that puts the user's timezone, week start and adoption date in the token sets `calendar`; `getCalendar()` falls back to the settings read |
| Feature data | `features/<x>/server.ts` → `server.api.ts` / `server.supabase.ts` | `server.ts` only picks: `const impl: typeof api = …`, so TypeScript fails when the two drift. Both return the same Zod-parsed DTOs |
| Errors | `lib/errors.ts` | `isExpectedDataError` covers both `ApiError` (4xx) and `DataError` (rule/constraint codes); a rejected token ends the session on both paths |
| OAuth callback | `app/auth/callback/route.ts` | Only Supabase uses it (`exchangeCode`); Better Auth handles its own callback |
| CSP | `next.config.ts` | `form-action` adds the Supabase origin only on the Supabase stack |

## 3. Behaviour that differs (documented, not hidden)

| | `better-auth` | `supabase` |
| :--- | :--- | :--- |
| "Today" | Python (`core/clock.py`, D11) | SQL `private.today_for()` using `user_settings.timezone` |
| Timezone names | Python `zoneinfo` | Postgres `pg_timezone_names`; checked in `validate_timezone` (TM-2) |
| Revocation delay | ≤ 5 min (cookie cache) | ≤ JWT expiry (1 h default); `verifySessionFresh` asks the server |
| Role source | `user.role` column → JWT claim | `app_metadata.role` (never `user_metadata`) |
| Email confirmation | Off (Q2) | Project setting; `signUp` returns `confirm-email` when on |
| Deleted user with a live token | API 401 → `/auth/expired` | Missing settings row → treated as an ended session |
| Timezone, week start for "today" | Settings read (API, ~5 ms locally) | JWT claims from the Custom Access Token Hook: no read before the today-keyed reads. Saving settings refreshes the token at once; another device sees the change at its next refresh (≤ 1 h) |

## 4. Roadmap

Tick in the PR that delivers each item. "Done" for the whole roadmap = §5 passes on both stacks.

### P0. Decisions
- [x] One switch (`AUTH_PROVIDER`) selects a whole stack; two stacks only.
- [x] Restore the Supabase stack from git (`520fc96^`, the last commit with it) instead of rewriting it.
- [x] The Supabase stack runs on a cloud project (migrations by `supabase db push`); the local CLI stack is optional,
      used here only to run pgTAP before pushing. Parity e2e passes on the cloud project (8/8).

### P1. Config and packages
- [x] `@supabase/ssr`, `@supabase/supabase-js` (dependencies), `supabase` CLI (devDependency) in `apps/web`.
- [x] `lib/auth/config.ts`: add the `supabase` branch; `.env.example` gets one block per stack; `turbo.json` env.

### P2. Identity
- [x] `lib/auth/supabase/{client,server,proxy}.ts`: `getClaims()` (local JWT check) in `getSession`, `getUser()` in
      `verifySessionFresh`, `scope: "local"` sign-out, OAuth start + `exchangeCode`.
- [x] `lib/auth/index.ts`, `lib/auth/proxy.ts`: pick by `AUTH_PROVIDER`; `app/auth/callback/route.ts`; Better Auth's
      `/api/auth/*` answers 404 on the Supabase stack.
- [x] CSP `form-action` for the Supabase origin.

### P3. Data seam
- [x] `lib/supabase/data.ts` (`createDataClient(accessToken)`, `DataError`, `unwrap`) + generated `database.types.ts`.
- [x] Every feature: `server.ts` picks `server.api.ts` (today's code) or `server.supabase.ts` (restored code).
- [x] `lib/errors.ts`: one predicate for expected errors on both paths; PostgREST 401 (`PGRST301`) ends the session.
- [x] ESLint: components may not import `**/server.*`; only `server.ts` may import `server.api` / `server.supabase`.

### P4. Schema (Supabase)
- [x] Restore `apps/web/supabase/` (config, 9 migrations, seed, pgTAP tests). The pgTAP files had never run; three
      needed fixes (fixed ids inserted as the user, a count that included the seed user). 50/50 pass.
- [x] Re-check the lessons of the FastAPI audit (`migration/known-issues.md` §5, §6): Supabase's Postgres image ships
      the legacy names (`Asia/Saigon`, `Asia/Calcutta`, `Europe/Kiev` all present), so `today_for()` in SQL is safe
      there. A deleted user with a live JWT: no settings row → `endRejectedSession` (read and write), as FastAPI's 401.
- [x] `supabase db advisors --local`: no issues.

### P5. Verification (both stacks)
- [x] `pnpm check`, `pnpm build` with each `AUTH_PROVIDER`.
- [x] `supabase test db` (pgTAP: RLS allow/deny, rules).
- [x] `e2e/parity.spec.ts` (§5) passes on both stacks (8/8 each). PostgREST probed with real user tokens: AC-5 (day −3 allowed, −4 refused), GL-3,
      cross-user read/update/delete/RPC refused, anon and forged tokens refused (13/13).

### P6. Docs
- [x] `docs/authentication.md`, `AGENTS.md`, `apps/web/.env.example`, skill `next-mono-base` (seams, "never call a
      backend outside `server.*.ts`").

### P7. Latency (Supabase cloud)
- [x] Measured: each PostgREST call costs the network round trip (~150 ms from Vietnam to ap-south-1, Postgres
      ~0.06 ms), so a page costs its number of *sequential* round trips. Settings had to be read before every
      today-keyed read: two in a row.
- [x] Hook `private.custom_access_token_hook` (migration `calendar_claims_hook`) puts `timezone`, `week_start`,
      `adopted_on` in the JWT; pages read them through `getCalendar()`. The goal page reads the goal alongside the rest.
      Hard load until data shown: ~630 ms → ~315 ms on all six dashboard pages, the same as local FastAPI (the rest
      is React's Suspense reveal). Deploying Next in the project's region removes most of what is left.

## 5. Parity checklist (run on both stacks)

Automated in `apps/web/e2e/parity.spec.ts` (switch `AUTH_PROVIDER`, restart `next dev`, run it again).

- [x] Sign up → Today, timezone synced from the browser; sign out → sign in; wrong password keeps the email.
- [x] Goal → habit from the goal page → full / minimum / undo → reload keeps it; streak updates.
- [x] Back-date day −3 allowed; −4 refused (AC-5).
- [x] `#slug` task → done → "Add to log?" → activity on the goal; pet +1.
- [x] 4th active goal refused (GL-3).
- [x] Weekly review with a pause and two focus tasks (RV-3, RV-4).
- [x] Preferences: timezone (browser list), week start, pet name persist.
- [x] Changing the timezone moves Today at once (the token claims are refreshed; fails without it).
- [x] Another user's ids: nothing readable, nothing writable.
- [x] Session ended on the server → next navigation reaches sign-in without a loop.

## 6. Adding a third stack later

Implement `AuthProvider` + `updateSession` in `lib/auth/<name>/`, a `server.<name>.ts` per feature, extend the config
union and `.env.example`, then run §5. If only the identity changes (e.g. Supabase Auth with FastAPI), skip the
`server.*.ts` files: point FastAPI's `AUTH_JWKS_URL`/`AUTH_ISSUER`/`AUTH_AUDIENCE` at the provider instead
(Supabase: `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json`, issuer `https://<ref>.supabase.co/auth/v1`,
audience `authenticated`).
