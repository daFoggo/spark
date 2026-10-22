# Authentication

How authentication works in Spark (`apps/web`) and why.
Applies to Next.js 16.4 with Cache Components enabled.

## 1. Overview

One provider per deployment, chosen by `AUTH_PROVIDER` (default `supabase`). The adapters live in `packages/auth`
(`@workspace/auth`) and are bound to Spark by `apps/web/config/auth.ts` and `apps/web/lib/auth.ts`
(see [providers.md](providers.md) for the seams):

| Provider | Description | Session lives in |
|---|---|---|
| `supabase` (default) | Supabase Auth via `@supabase/ssr`; ES256 JWT checked locally with `getClaims()`; data through PostgREST + RLS | Cookies named from `AUTH_OPTIONS.cookieName` (`spark-auth`), refreshed only in `proxy.ts` |
| `better-auth` | Identity foundation only: Better Auth backed by a PostgreSQL `auth` schema, EdDSA JWTs via JWKS. No data path behind it since FastAPI was dropped | Secure httpOnly session cookie handled by Better Auth |

Both implement `AuthProvider` and expose `Session { userId, accessToken, role, name, email, calendar? }`, so the DAL,
Server Actions and data clients interact through a standard, decoupled contract.

Principles:

1. **No network call to learn who the user is on each request**: sessions are validated locally (`getClaims()` verifies
   the JWT against cached JWKS; Better Auth decrypts its cookie).
2. **Tokens are refreshed transparently in `proxy.ts`**: Server Components cannot write cookies; proxy manages session extension.
3. **Authorize next to the data** (DAL, Server Actions), not in layouts; `proxy.ts` performs optimistic redirects.
4. **Server Actions are public endpoints**: each authenticates and validates its own input.
5. **Per-user data uses `"use cache: private"`**; secrets never become cache keys or tags. The DAL's `getSession()` is
   private too, so all queries in one request share a single session read (not one per cache scope).

## 2. Architecture

```
Browser -cookie-> proxy.ts -> @workspace/auth/proxy updateSession (refresh, set cookies, isAuthenticated)
                     v
   Server Component / Action / Route Handler -> lib/dal.ts (getSession, verifySession, verifySessionFresh)
                     v
        lib/auth.ts getAuthProvider() -> @workspace/auth/server (supabase | better-auth)
                     v
        features/<x>/server.ts -> lib/data.ts createDataClient(accessToken) -> PostgREST as the user (RLS)
```

Paths relative to `apps/web/` unless prefixed by `packages/`:
- `config/auth.ts`: `AUTH_OPTIONS` (cookie name `spark-auth`, so Spark never collides with another app on the host).
- `lib/auth.ts`: binds `@workspace/auth/server` to `AUTH_OPTIONS`; re-exports the session types.
- `proxy.ts`: calls `@workspace/auth/proxy` to refresh the session cookies; keeps the `/` redirect.
- `lib/dal.ts`: `getSession`, `verifySession`, `verifySessionFresh`, `refreshSessionClaims`.
- `lib/data.ts`: `createDataClient(accessToken)` wrapping `@workspace/db/server`; a `401` on a request that carried a
  token calls `endRejectedSession` (renders redirect to `/auth/expired`, actions sign out).
- `app/api/auth/[...all]/route.ts`: Better Auth handler (`@workspace/auth/better-auth-handler`); 404 on the Supabase provider.
- `app/auth/callback/route.ts`: finishes OAuth (`exchangeCodeForSession`) on Supabase.
- `packages/auth/src/supabase/{server,proxy}.ts`: `supabaseProvider`; `getClaims()` verifies identity, `getUser()` backs
  `verifySessionFresh`, `getSession()` only forwards the already verified token.
- `packages/auth/src/better-auth/*`: Better Auth instance with Postgres pool (`search_path=auth`), JWT plugin, `nextCookies()`.
- `packages/auth/src/{config,permissions,types}.ts`: validated env, roles (`member`, `admin`) and `requirePermission`, the `AuthProvider` contract.

When a Custom Access Token Hook adds `timezone`, `week_start`, `adopted_on` claims they become `Session.calendar`
([providers.md](providers.md) §5); `refreshSession()` reissues the token after settings change (`refreshSessionClaims()`
in the DAL).

## 3. Roles and the database

`role` comes from verified claims only (`app_metadata.role`, never `user_metadata`). RLS policies in
`packages/db/supabase/migrations` own the data rules; the app-side `requirePermission()` is a second check, not a
replacement. Better Auth's JWT is not accepted by PostgREST, which is why that provider has no data path.
