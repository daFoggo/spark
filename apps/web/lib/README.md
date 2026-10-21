# lib/

App infrastructure, not tied to one feature. Server-only modules start with `import "server-only"`.

- `env.ts` / `env.public.ts`: validated env (server-only / browser-safe).
- `http.ts`: backend `fetch` wrapper (only feature `server.ts` files import it). A `401` on a token ends the session.
- `errors.ts`: `ApiError`, `isExpectedApiError` (backend `4xx`: return from actions as a value), `getErrorMessage`.
- `dal.ts`: Data Access Layer: `getSession` (`"use cache: private"`, one read per request), `verifySession`. Call next to the data.
- `auth/`: provider adapters. **One provider per deployment** via `AUTH_PROVIDER=backend|supabase`.
  - `types.ts` contract, `config.ts` validated auth env (no `server-only`, the proxy uses it).
  - `backend/`: session in one encrypted httpOnly cookie (iron-session); identity decrypted locally, no `users/me`.
  - `supabase/`: `@supabase/ssr`; identity via `getClaims()`.
  - `proxy.ts` is the **only** place that refreshes tokens (called from `/proxy.ts`).
