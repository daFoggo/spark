# lib/

App infrastructure, not tied to one feature. Server-only modules start with `import "server-only"`.

- `env.ts` / `env.public.ts`: validated env (server-only / browser-safe).
- `http.ts`: backend `fetch` wrapper (only feature `server.api.ts` files import it). A `401` on a token ends the session
  (`endRejectedSession`, shared with the Supabase data client).
- `errors.ts`: `ApiError`, `DataError`, `isExpectedDataError` (backend `4xx` or an expected Postgres code: return from
  actions as a value), `ruleOf`, `getErrorMessage`.
- `supabase/data.ts`: `createDataClient(accessToken)` (RLS as the user), `unwrap`; `database.types.ts` is generated
  (`supabase gen types typescript --local`).
- `dal.ts`: Data Access Layer: `getSession` (`"use cache: private"`, one read per request), `verifySession`. Call next to the data.
- `auth/`: provider adapters. **One provider per deployment** via `AUTH_PROVIDER=better-auth|supabase` (docs/providers.md).
  - `types.ts` contract, `config.ts` validated auth env (no `server-only`, the proxy uses it).
  - `better-auth/`: Better Auth in Next (`/api/auth/*`); JWT minted for FastAPI.
  - `supabase/`: `@supabase/ssr`; identity via `getClaims()`.
  - `proxy.ts` is the **only** place that refreshes tokens (called from `/proxy.ts`).
