# Authentication & Data Access Layer (DAL)

## 1. When to Use
Use when checking user sessions, protecting endpoints, or making authorized backend calls.

## 2. Architecture & Call Paths
- **`proxy.ts`**: Optimistic check & token refresh only. Writes refreshed cookies to request and response.
- **`lib/dal.ts`**: System-of-record authorization. Exports `getSession()`, `verifySession()`, `verifySessionFresh()`.
- **`lib/http.ts`**: Injects Bearer token from session; throws `ApiError` on non-2xx. A 401 ends the session.

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
`Session` is `{ userId, accessToken }` today: there is no `role`. To authorize by role, add the claim to the `Session` type (`lib/auth/types.ts`) and populate it in both providers from verified claims only. Put the check in a DAL helper next to `verifySession()` and call it from every `queries.ts` and `actions.ts` that touches the protected data (Server Actions are public endpoints, so a page-level check does not cover them). Hiding a nav link is a UI hint, not authorization.

## 5. Never Do
- ❌ **Never treat `proxy.ts` as the authorization boundary**: it is an optimistic redirect for unauthenticated users. The real check is `verifySession()` in the data path.
- ❌ **Never authorize in `layout.tsx`**: Layouts do not re-render on sub-navigation. Always authorize close to the data in `queries.ts` or `actions.ts`.
- ❌ **Never attempt to write cookies in Server Components**: Cookies can only be mutated in `proxy.ts`, Server Actions, or Route Handlers.

## 6. Source of Truth (Deep Dive)
- Complete provider design (`backend` vs `supabase`): [docs/authentication.md §1-5](../../../../docs/authentication.md#1-overview)
- Proxy token refresh flow: [docs/authentication.md §4](../../../../docs/authentication.md#4-provider-backend)
