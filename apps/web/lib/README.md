# lib/

App infrastructure, not tied to one feature. Server-only modules start with `import "server-only"`.

- `env.public.ts`: validated browser-safe env.
- `errors.ts`: `DataError`, `isExpectedDataError` (an expected Postgres code: return from actions as a value),
  `ruleOf`, `getErrorMessage`.
- `data.ts`: wraps `@workspace/db/server`: `createDataClient(accessToken)` (RLS as the user), `unwrap`,
  `endRejectedSession` (a `401` on a token ends the session). Only feature `server.ts` files import it. Generated types
  and migrations live in `packages/db` (`pnpm --filter @workspace/db db:types|db:push|db:test`).
- `auth.ts`: binds `@workspace/auth/server` to `config/auth.ts` (`AUTH_OPTIONS`, cookie `spark-auth`).
- `dal.ts`: Data Access Layer: `getSession` (`"use cache: private"`, one read per request), `verifySession`,
  `refreshSessionClaims` (after a write that changes a token claim). Call next to the data.
- Auth adapters live in `packages/auth` (`@workspace/auth/{config,permissions,types,server,proxy,better-auth-handler}`),
  **one provider per deployment** via `AUTH_PROVIDER=supabase|better-auth` (default `supabase`; Better Auth is an
  identity foundation only; docs/providers.md). `@workspace/auth/proxy` is the **only** place that refreshes tokens
  (called from `/proxy.ts`).
