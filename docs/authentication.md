# Authentication

How authentication works in Spark (`apps/web`) and why.
Applies to Next.js 16.4 with Cache Components enabled.

## 1. Overview

Authentication is powered by **Better Auth** (`AUTH_PROVIDER=better-auth`):

| Provider | Description | Session lives in |
|---|---|---|
| `better-auth` | Self-hosted auth backed by PostgreSQL `auth` schema; issues EdDSA JWTs via JWKS for FastAPI | Secure httpOnly session cookies handled by Better Auth |

Better Auth implements `AuthProvider` and exposes `Session { userId, accessToken }`, so the DAL, Server Actions and HTTP client interact through a standard, decoupled contract.

Principles:

1. **No network call to learn who the user is on each request**: sessions are validated locally via the session cookie and verified via cached JWKS on the FastAPI backend.
2. **Tokens are refreshed transparently in `proxy.ts`**: Server Components cannot write cookies; proxy manages session extension.
3. **Authorize next to the data** (DAL, Server Actions), not in layouts; `proxy.ts` performs optimistic redirects.
4. **Server Actions are public endpoints**: each authenticates and validates its own input.
5. **Per-user data uses `"use cache: private"`**; secrets never become cache keys or tags. The DAL's `getSession()` is
   private too, so all queries in one request share a single session read and token mint (not one per cache scope).

## 2. Architecture

```
Browser ─cookie─▶ proxy.ts ─▶ updateSession (Better Auth): decrypt/refresh, set cookies, isAuthenticated
                     ▼
   Server Component / Action / Route Handler ─▶ lib/dal.ts (getSession · verifySession · verifySessionFresh)
                     ▼
        getAuthProvider() ─▶ lib/auth/better-auth/server.ts
                     ▼
         apiFetch ─Bearer JWT─▶ FastAPI Backend (/v1/*)
                                  ▼
                              JWKS (EdDSA) verification at backend
```

Paths relative to `apps/web/`:
- `proxy.ts`: updates session cookies via Better Auth handler.
- `lib/auth/better-auth/auth.ts`: Better Auth instance with Postgres pool (`search_path=auth`), JWT plugin with EdDSA JWKS, `nextCookies()`.
- `lib/auth/better-auth/server.ts`: `betterAuthProvider` implementing `AuthProvider`.
- `lib/auth/better-auth/proxy.ts`: cookie refresh during routing.
- `app/api/auth/[...all]/route.ts`: Better Auth API route handler.
- `lib/http.ts`: `apiFetch` sending Bearer JWT to FastAPI backend (`API_BASE_URL`).

## 3. JWT & JWKS Verification in FastAPI

FastAPI (`spark-backend`) verifies JWTs using PyJWKClient / PyJWT:
1. `GET /api/auth/jwks` serves the public Ed25519 keys published by Better Auth.
2. FastAPI caches keys and validates `sub`, `aud` (`API_AUDIENCE`), `iss` (`BETTER_AUTH_URL`), and `exp`.
3. Injected `CurrentUser(id, email, role)` dependency is available across all protected endpoints.
