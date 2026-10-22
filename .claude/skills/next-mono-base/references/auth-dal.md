# Authentication & Data Access Layer (DAL)

## 1. When to Use
Use when checking user sessions, protecting endpoints, or making authorized backend calls.

## 2. Architecture & Call Paths
- **`proxy.ts`**: Optimistic check & token refresh only. Writes refreshed cookies to request and response.
- **`lib/dal.ts`**: System-of-record authorization. Exports `getSession()`, `verifySession()`, `verifySessionFresh()`.
- **`lib/data.ts`**: `createDataClient(accessToken)` (wraps `@workspace/db/server`): PostgREST as the user, RLS applies; throws `DataError`. A 401 ends the session (`endRejectedSession`).
- **`lib/auth.ts`** binds `@workspace/auth/{server,proxy}` to `config/auth.ts` (`AUTH_OPTIONS`). The adapters live in `packages/auth`.

## 3. Canonical Pattern

```ts
// In queries or actions:
import { verifySession } from "@/lib/dal"

export async function getUserItems() {
  const session = await verifySession() // Redirects to /auth/expired if unauthenticated
  return fetchItems(session.accessToken)
}
```

`getSession()` in `lib/dal.ts` is `"use cache: private"`: every private query in a request joins one session read (`React.cache` would run once per cache scope), and Better Auth's `Date.now()` expiry check runs per request, never in the static shell.

## 4. Role and Permission Checks
`Session` is `{ userId, accessToken, role, name, email, calendar? }`. `role` comes from verified claims only (Supabase: `app_metadata`, never `user_metadata`); check it with `requirePermission()` from every `queries.ts` and `actions.ts` that touches the protected data (Server Actions are public endpoints, so a page-level check does not cover them). Hiding a nav link is a UI hint, not authorization.

`calendar` (timezone, week start, adoption date) is set only when the provider carries them in the token; read them through `getCalendar()` (falls back to the settings read). An action that changes them calls `refreshSessionClaims()` after the write, or other pages keep the old values until the token refreshes.

## 5. Never Do
- ❌ **Never treat `proxy.ts` as the authorization boundary**: it is an optimistic redirect for unauthenticated users. The real check is `verifySession()` in the data path.
- ❌ **Never authorize in `layout.tsx`**: Layouts do not re-render on sub-navigation. Always authorize close to the data in `queries.ts` or `actions.ts`.
- ❌ **Never attempt to write cookies in Server Components**: Cookies can only be mutated in `proxy.ts`, Server Actions, or Route Handlers.

## 6. Source of Truth (Deep Dive)
- Complete provider design (`better-auth` vs `supabase`): [docs/authentication.md §1-2](../../../../docs/authentication.md#1-overview)
- Providers, `packages/auth` / `packages/db`, per-provider rules, latency: [docs/providers.md](../../../../docs/providers.md)
- Proxy token refresh flow: [docs/authentication.md §4](../../../../docs/authentication.md#4-provider-backend)
