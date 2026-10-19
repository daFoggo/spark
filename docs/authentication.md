# Authentication

How authentication works in this base (`apps/web`) and why. Claims carry a citation like `[N1]`; the table is in section 9.
Applies to Next.js 16.4 with Cache Components enabled [C1].

## 1. Overview

One auth provider is active per deployment (`AUTH_PROVIDER`):

| Provider | Use it when | Session lives in |
|---|---|---|
| `backend` | You own a REST backend that issues access/refresh tokens | One encrypted httpOnly cookie sealed by this app |
| `supabase` | You use Supabase Auth (email/password, Google) | Supabase's cookies (`@supabase/ssr`) |

Both implement `AuthProvider` and expose `Session { userId, accessToken }`, so the DAL, Server Actions and HTTP client do not know
which one runs [C3]. A misconfigured provider fails validation instead of degrading silently [C2].

Principles:

1. **No network call to learn who the user is on each request**: sessions are stateless and verified locally [N1].
2. **Tokens are refreshed only in `proxy.ts`**: Server Components cannot write cookies [N2] and refresh tokens may be single use.
3. **Authorize next to the data** (DAL, Server Actions), not in layouts [N3]; `proxy.ts` is an optimistic redirect only [N4].
4. **Server Actions are public endpoints**: each authenticates and validates its own input [N11][N12].
5. **Per-user data uses `"use cache: private"`**; secrets never become cache keys or tags [N8].

## 2. Architecture

```
Browser ─cookie─▶ proxy.ts ─▶ updateSession (provider): decrypt/refresh, set cookies, isAuthenticated (optimistic)
                     ▼
   Server Component / Action / Route Handler ─▶ lib/dal.ts (getSession · verifySession · verifySessionFresh)
                     ▼
        getAuthProvider() ─▶ lib/auth/backend/server.ts | lib/auth/supabase/server.ts
```

Paths relative to `apps/web/`: [proxy.ts](../apps/web/proxy.ts), [config/routes.ts](../apps/web/config/routes.ts),
[lib/auth/](../apps/web/lib/auth) (`config.ts`, `types.ts`, `index.ts`, `backend/`, `supabase/`), [lib/dal.ts](../apps/web/lib/dal.ts),
[lib/http.ts](../apps/web/lib/http.ts) (`apiFetch`: Bearer header, RFC 7807 errors → `ApiError`, `401` ends the session, see flow 4),
[features/auth/actions.ts](../apps/web/features/auth/actions.ts), [app/auth/callback/route.ts](../apps/web/app/auth/callback/route.ts)
(OAuth code exchange), [app/auth/expired/route.ts](../apps/web/app/auth/expired/route.ts) (clears the session after a backend `401`).
`lib/auth/config.ts` has no `server-only` because the proxy uses it, and it holds `SESSION_SECRET`: client code must not import it
(ESLint enforces this for `components/` and `features/*/components/`, see [eslint.config.js](../apps/web/eslint.config.js)).

## 3. Core concepts

- **Stateless session**: the session lives in a cookie verified on every request; use a library such as iron-session or Jose [N1].
  Recommended cookie options: `HttpOnly`, `Secure`, `SameSite`, `Expires`, `Path` [N5]. The secret comes from `openssl rand` and lives
  in an environment variable [N7].
- **Optimistic vs secure checks**: reading the cookie is cheap and fine in `proxy.ts` (it also runs on prefetches); authorization against
  the system of record belongs in the DAL and in the backend call itself [N4][N10].
- **Refresh in the proxy**: it writes the refreshed cookie on the request (so Server Components in the same request see it) and on the
  response (so the browser stores it) [N9].

## 4. Provider `backend`

### Contract (zod-enforced in [backend/server.ts](../apps/web/lib/auth/backend/server.ts) and [backend/proxy.ts](../apps/web/lib/auth/backend/proxy.ts) [C4])

| Endpoint (relative to `API_BASE_URL`, which may include a path like `/api/v1/`) | Request | Response |
|---|---|---|
| `POST auth/sign-in` | `{ email, password }` | `{ access_token, refresh_token, expiration, refresh_expiration, user_info: { id, name?, email?, role? } }` |
| `POST auth/sign-up` | `{ name, email, password }` | Any `2xx`; the body is ignored and the provider signs the user in right after |
| `POST auth/refresh` | `{ refresh_token }` | `{ access_token, refresh_token, expiration, refresh_expiration }` |
| Protected APIs | `Authorization: Bearer <access_token>` | `401` when the token is not accepted |

Expirations may be ISO strings or unix seconds/milliseconds. Errors are RFC 7807 (`detail` becomes the message) [C5]. The backend must
validate the token and the user's status on every call; the frontend cannot verify an HS256 signature and does not try. For a backend
with another shape, change only the zod schemas and paths in those two files.

### Session cookie

One cookie (`SESSION_COOKIE_NAME`, default `session`) holds an iron-session seal of
`{ userId, accessToken, refreshToken, accessExpiresAt, refreshExpiresAt }` ([cookie.ts](../apps/web/lib/auth/backend/cookie.ts)):

- `sealData`/`unsealData` with `SESSION_SECRET` (≥ 32 chars); the seal `ttl` equals the refresh lifetime; an expired seal is rejected [N6][N7].
- `httpOnly`, `secure` in production, `sameSite: "lax"`, `path: "/"`, `expires = refreshExpiresAt` [N5].
- The seal is authenticated encryption, so `userId` is trustworthy without asking the backend (safe as a `"use cache"` argument [N8]).
- Size: two 283-character tokens seal to 1,182 characters, two 600-character tokens to 2,036 (browser limit ~4 KB); a test enforces
  < 3,000 for the 600-character case [E1].

### Flows

1. **Sign in**: `auth/sign-in` → parse → set cookie from a Server Action (cookies are writable only in Server Functions/Route Handlers [N2]).
2. **Each request** (`proxy.ts`): cookie not unsealable → delete it, unauthenticated · more than 2 min of access token left → pass through ·
   otherwise `auth/refresh` and re-seal on request + response · refresh failed but access still valid → continue, else clear the session.
3. **Read the session**: `await io()`, then unseal (section 7).
4. **Backend returns `401`** on a call that sent a token (e.g. deactivated user). During a render, `apiFetch` redirects to
   `/auth/expired`, which clears the cookie and goes to sign-in; a route is needed because Server Components cannot delete cookies [N2],
   and clearing prevents a loop. Inside a Server Action (request header `next-action`) it signs out directly and redirects to `/sign-in`:
   an action can only soft-navigate to a page, and redirecting it to the route left the old UI on screen (seen in testing).
5. **Sign up**: `auth/sign-up`, then the sign-in flow above, so the user lands signed in. Backend errors (for example a duplicate email) are returned to the form as values.
6. **Sign out**: delete the cookie.

### Limits

Stateless tokens cannot be revoked by the frontend: sign-out deletes the cookie, but a copied token stays valid until it expires unless
the backend revokes it. A deactivated user is detected at the next backend call, not on every page view.

## 5. Provider `supabase`

Verified from the installed `@supabase/auth-js` 2.117.3 source [S5]:

- `getClaims()` verifies the JWT **locally** (WebCrypto + JWKS) for asymmetric keys with a `kid`; for symmetric (`HS*`) keys, no `kid`
  or no WebCrypto it falls back to `getUser()`, a network call (`GoTrueClient.ts` 6739–6762).
- The JWKS is fetched from `<project>/auth/v1/.well-known/jwks.json` and kept in a module-level cache shared by per-request clients,
  TTL 10 minutes (`GoTrueClient.ts` 6587–6620, `constants.ts` 58). A warm server therefore authenticates with **no** Supabase request
  when the project uses an asymmetric key; check with `curl <project>/auth/v1/.well-known/jwks.json` (expect `ES256`/`RS256`) [S3].
- If the access token is about to expire, `getClaims()` first refreshes the session (JSDoc, line 6647); in a Server Component that refresh
  cannot persist cookies, so the proxy must run `getClaims()` first. `getClaims()` does not detect revoked sessions [S2].

Implementation:

- Client created **per request** from that request's cookies [S1] ([client.ts](../apps/web/lib/auth/supabase/client.ts)). Supabase cookies are
  intentionally not httpOnly (the browser needs them) and are chunked [S1].
- [proxy.ts](../apps/web/lib/auth/supabase/proxy.ts): `getClaims()`, new cookies on request + response, and the cache headers from `setAll`
  copied to the response so CDNs do not cache a `Set-Cookie` response.
- [server.ts](../apps/web/lib/auth/supabase/server.ts): `getSession` = `await io()` → `getClaims()` for the verified `userId` →
  `getSession()` only to forward `access_token` to your API [S1]; `signOut({ scope: "local" })` (the default `global` scope signs out every
  device [S2]); OAuth start/exchange.
- **Sensitive actions** (change password/email, delete account, payments) call `verifySessionFresh()` from the DAL, which runs
  `supabase.auth.getUser()` (a round trip to the Auth server) because `getClaims()` cannot see revocation [S2]. For the `backend`
  provider it is the same as `getSession` since the backend checks the token on every call. No action in the base needs it yet.
- **Sign up**: `auth.signUp` with the name stored as user metadata. If the project requires email confirmation no session is returned, and
  the form shows "Check your email" instead of signing in.

Google OAuth (PKCE): `signInWithGoogleAction` → authorize URL (verifier cookie stored) → Google → Supabase → `/auth/callback?code=` →
`exchangeCodeForSession` [S4]. Setup: a Google Cloud OAuth client whose redirect URI is `https://<project>.supabase.co/auth/v1/callback`;
enable Google in Supabase → Authentication → Providers; add `<NEXT_PUBLIC_APP_URL>/auth/callback` to Redirect URLs and set the Site URL.

## 6. DAL and Server Actions

| Function | Use when | Notes |
|---|---|---|
| `getSession()` | You only need to know if a session exists | `React.cache`-memoized |
| `verifySession()` | A Server Component/Action requires a session | No session → `redirect(SESSION_EXPIRED_PATH)`, which clears any leftover cookie and goes to sign-in (this also prevents a proxy/DAL redirect loop) [N10] |
| `verifySessionFresh()` | Sensitive actions | Also asks the identity system whether the session was revoked (extra round trip on Supabase) |
| `requirePermission(p)` | A page or action needs a permission | `verifySession()`, then `forbidden()` (403, [app/forbidden.tsx](../apps/web/app/forbidden.tsx)) when the role lacks `p`; needs `experimental.authInterrupts` |

**Roles and permissions** ([lib/auth/permissions.ts](../apps/web/lib/auth/permissions.ts)): `Session` carries `role` (`member` | `admin`),
`name` and `email`. A role maps to permissions (`dashboard:view`, `settings:view`, `members:view`, `members:manage`); unknown or missing
roles become `member`. Sources:

- `supabase`: `app_metadata.role` (writable only with the service role). `user_metadata` is editable by the user, so it supplies the
  display name only, never the role.
- `backend`: optional `user_info.name`, `user_info.email`, `user_info.role` in the `auth/sign-in` response, sealed into the cookie.
  Cookies sealed before these fields existed still unseal (role `member`). A role change shows after the next sign-in.

The dashboard nav hides links a role lacks ([config/navigation.ts](../apps/web/config/navigation.ts)); that is UI only. Every page and
action still calls `requirePermission`, and the backend authorizes every API call.

- Check next to the data: layouts do not re-render on navigation and do not control child segments [N3]. Client Components cannot import
  the DAL; pass data as props [N3].
- The DAL works inside `"use cache: private"` too (it reads cookies and uses `io()`, both allowed there), so per-user cached reads call
  `verifySession()` themselves (section 7).
- Server Actions: call `verifySession()` and validate input with zod in each one; a page-level check does not cover them [N11][N12][N18].
  A proxy matcher that excludes a path also skips Server Function calls there, so never rely on the proxy alone [N22].
- **Expected** failures (validation, backend `4xx`) are **returned as values** and read with `useActionState`; **unexpected** ones throw to
  `error.tsx`, which receives `retry` in this version [N19][N20]. The auth actions ask the active provider: `provider.isExpectedError(error)`
  is true for a backend `4xx` (`ApiError`) or a Supabase `AuthError` with a `4xx` status (wrong password, email taken, weak password,
  rate limit); network failures, `5xx` and unexpected responses are rethrown. `redirect()` throws, so keep it outside `try/catch` [N21].

## 7. Cache Components and auth

1. `cookies()` is runtime data: its readers must sit inside `<Suspense>` [N8][N13].
2. `use cache` / `use cache: remote` cannot read `cookies()`; `use cache: private` can, and stays in browser memory only [N8][N14].
3. `connection()` is prohibited in both `use cache` and `use cache: private` [N14][N15]; `io()` resolves immediately inside cache scopes [N25].
4. Cache keys and `cacheTag` values are plain text: never put tokens in them; use a stable id like `userId`. Export a getter that resolves
   the user, then calls an **unexported** `use cache` function taking `userId` [N8].
5. `updateTag` works only in Server Actions and expires the tag immediately [N16]. Private `stale` must be ≥ 30 s for per-link prefetching
   and ≥ 5 min to be in the App Shell [N14].
6. Comparing a token's expiry with the clock after `await cookies()` fails prerender ("unstable value `Date.now()`"); `await connection()`
   first opts into request-time rendering [N17]. Both providers' `getSession` call `await io()` instead, which suspends only while
   prerendering and, unlike `connection()`, does not block prefetches [N25].

Pattern for per-user private caching: `"use cache: private"` calling `verifySession()` + `cacheTag("<domain>:<userId>")` +
`cacheLife({ stale: 300, revalidate: 300, expire: 3600 })`; the mutation action authenticates, validates, writes, then calls `updateTag`.

Differences from the official example [N8]: identity comes from the sealed cookie, not a per-request lookup (trade-off in section 4);
per-user data is cached in the browser, not on the server. For data shared across users use the unexported `use cache` pattern and never
pass a token as an argument (one entry per user, misses after every refresh, stored in plain text).

## 8. Security and verification

- `SESSION_SECRET` ≥ 32 random chars, different per environment, never `NEXT_PUBLIC_`; env files gitignored [N7]. Supabase cookies are
  readable by JavaScript by design, so XSS defenses matter more with that provider.
- **CSP**: nonces require dynamic rendering of every page and are **incompatible with Partial Prerendering**, which this base enables, so
  [next.config.ts](../apps/web/next.config.ts) sets a header CSP without nonces (`script-src 'self' 'unsafe-inline'`, plus `'unsafe-eval'` and
  websockets in development only, `upgrade-insecure-requests` in production only) [N24]. With the `supabase` provider `form-action` also
  allows `https://accounts.google.com` and the Supabase origin, because the OAuth redirect starts from a form. Tighten with experimental
  SRI if you need a stricter policy while keeping static generation [N24]. The policy is computed at build time, so build with the same
  `AUTH_PROVIDER` you deploy.
- Rate limiting, password reset and email verification are not part of the base; rate limiting belongs to the backend/Supabase [N23].
- Unexpected errors render [error.tsx](../apps/web/app/error.tsx) (`retry`) and unknown URLs [not-found.tsx](../apps/web/app/not-found.tsx).
- Signed-in users requesting `/sign-in` or `/sign-up` are redirected to the dashboard in `proxy.ts`; the redirect copies the refreshed
  session cookies, otherwise single-use refresh tokens would be lost.
- Forms keep non-secret values (email, name) after an error because React resets a form when its action finishes; passwords are never echoed.
- **CI**: auth config is validated while `next build` collects routes, so the workflow sets placeholder `AUTH_PROVIDER`, `API_BASE_URL` and
  `SESSION_SECRET` ([ci.yml](../.github/workflows/ci.yml)). The CI command passed locally without `.env.local`; the workflow has not run on
  GitHub yet.
- **Automated** (`pnpm check`): `parseExpirationMs`, seal/unseal round trip, tampered/malformed cookie rejection, cookie size, `apiUrl` [E1].
- **Verified against a stand-in backend + production build**: no per-request identity call; token refresh; profile update + `updateTag`;
  backend `401` → sign-in without a loop; sign-up (duplicate email shown as a form error with values kept, then success → dashboard);
  signed-in redirect away from `/sign-in`; not-found page; CSP header present with no violations logged; with `AUTH_PROVIDER=supabase`
  the Google button reaches the Supabase authorize URL under the CSP (the request was intercepted there, nothing was sent to Google).
- **Verified manually with real services** during development: email sign-in on both providers and Google sign-in on Supabase, with no
  errors in the dev server log. Not yet exercised against real services: sign-up, `verifySessionFresh()` and the Supabase
  confirm-email path.

## 9. Citations

Next.js docs shipped with the package, `apps/web/node_modules/next/dist/docs/01-app/` (`DOCS/`), line numbers for 16.4.0. Re-read after
upgrading Next.

| ID | Source | Cited for |
|---|---|---|
| N1 | `DOCS/02-guides/authentication.md` 519–528 | Stateless vs database sessions; iron-session/Jose |
| N2 | `DOCS/03-api-reference/04-functions/cookies.md` 6, 76–81 | Cookies readable in Server Components, writable only in Server Functions/Route Handlers |
| N3 | `DOCS/02-guides/authentication.md` 1356–1374 | No auth in layouts; check near data; Client Components cannot import the DAL |
| N4 | `DOCS/02-guides/authentication.md` 1026–1033 | Proxy = optimistic checks |
| N5 | `DOCS/02-guides/authentication.md` 627–637 | Cookie options |
| N6 | `DOCS/02-guides/authentication-with-cache-components.md` 56, 62–81 | `sealData`/`unsealData`, expired seal rejected |
| N7 | `DOCS/02-guides/authentication.md` 544–548 | Secret via `openssl`, env var |
| N8 | `DOCS/02-guides/authentication-with-cache-components.md` 47–60, 83–113, 229–269, 312 | Private cache, Suspense, unexported function with `userId`, plain-text keys/tags |
| N9 | `DOCS/03-api-reference/03-file-conventions/proxy.md` 344 | Cookies on request and response in the proxy |
| N10 | `DOCS/02-guides/authentication.md` 1131–1150 | DAL + `verifySession` + `React.cache` |
| N11 | `DOCS/02-guides/authentication.md` 1467–1469 | Server Actions are public endpoints |
| N12 | `DOCS/02-guides/data-security.md` 337–350 | Page checks do not cover actions |
| N13 | `DOCS/02-guides/authentication-with-cache-components.md` 115–117 | Session reader behind `<Suspense>` |
| N14 | `DOCS/03-api-reference/01-directives/use-cache-private.md` 14–16, 154, 168–173 | Private scope, stale minimums, `connection()` prohibited |
| N15 | `DOCS/02-guides/authentication-with-cache-components.md` 113 | `connection()` not usable in private cache |
| N16 | `DOCS/03-api-reference/04-functions/updateTag.md` 6–16; auth-with-cache-components 269–287 | `updateTag` in Server Actions; re-read session |
| N17 | Next error `blocking-prerender-current-time` (dev overlay) | `Date.now()` after `cookies()` → `await connection()` |
| N18 | `DOCS/02-guides/data-security.md` 308–336 | Validate action input |
| N19 | `DOCS/01-getting-started/10-error-handling.md` 17–25 | Expected errors as return values |
| N20 | `10-error-handling.md`; `DOCS/03-api-reference/03-file-conventions/error.md` 27–30, 58 | `error.tsx` with `retry` |
| N21 | `DOCS/03-api-reference/04-functions/redirect.md` 51–53, 62 | `redirect` throws; outside `try/catch` |
| N22 | `DOCS/03-api-reference/03-file-conventions/proxy.md` 236–253 | Server Functions are not separate routes in the proxy chain |
| N23 | `DOCS/02-guides/data-security.md` 476 | Rate limiting |
| N24 | `DOCS/02-guides/content-security-policy.md` 34–38, 385–397, 417–452, 456–458 | Nonces need dynamic rendering, incompatible with PPR; header CSP; SRI |
| N25 | `DOCS/03-api-reference/04-functions/io.md` 8–10, 85–87, 103 | `io()`: suspends only in prerender, resolves in cache scopes, does not block prefetch |

| ID | Supabase source | Cited for |
|---|---|---|
| S1 | https://supabase.com/docs/guides/auth/server-side/nextjs | `@supabase/ssr`, per-request client, chunked cookies, `getSession()` not trusted on the server |
| S2 | https://supabase.com/docs/reference/javascript/auth-getclaims and the advanced SSR guide | `getClaims()` vs `getUser()`, single-use refresh, `signOut` scope |
| S3 | https://supabase.com/docs/guides/auth/signing-keys | Asymmetric keys → local verification |
| S4 | https://supabase.com/docs/guides/auth/social-login/auth-google | Google setup, Redirect URLs |
| S5 | `node_modules/.pnpm/@supabase+auth-js@2.117.3/node_modules/@supabase/auth-js/src/GoTrueClient.ts` 6587–6620, 6645–6648, 6739–6762; `lib/constants.ts` 58 | Local verification, JWKS cache/TTL, refresh inside `getClaims()`, `getUser()` fallback |

| ID | Code / tests | Cited for |
|---|---|---|
| C1 | [next.config.ts](../apps/web/next.config.ts) | `cacheComponents`, `partialPrefetching` |
| C2 | [lib/auth/config.ts](../apps/web/lib/auth/config.ts) | Provider discriminated union |
| C3 | [lib/auth/types.ts](../apps/web/lib/auth/types.ts) | `AuthProvider`, `Session` |
| C4 | [backend/server.ts](../apps/web/lib/auth/backend/server.ts), [backend/proxy.ts](../apps/web/lib/auth/backend/proxy.ts) | Backend contract |
| C5 | [lib/http.ts](../apps/web/lib/http.ts) | RFC 7807 handling, `401` redirect |
| E1 | [cookie.test.ts](../apps/web/lib/auth/backend/cookie.test.ts), [cookie-size.test.ts](../apps/web/lib/auth/backend/cookie-size.test.ts), [url.test.ts](../apps/web/lib/url.test.ts) | Unit tests |
