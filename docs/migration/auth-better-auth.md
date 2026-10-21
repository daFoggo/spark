# Auth design: Better Auth in Next.js, JWT for FastAPI

Built from scratch: the repo has no Better Auth code today. This file replaces the `supabase` and `backend` sections of
[`docs/authentication.md`](../authentication.md) at Phase 9; until then the principles of that file (§1: no identity
round trip per request, refresh only in the proxy, authorize next to the data, actions are public endpoints, per-user
data in `"use cache: private"`) still apply and this design keeps all of them.

Skills to load before working: `better-auth-best-practices`, `email-and-password-best-practices`,
`better-auth-security-best-practices`, `create-auth` (reference only: we wire it into the existing `AuthProvider`
instead of scaffolding new pages), `next-mono-base`. Docs: https://better-auth.com/docs (installation, integrations/next,
concepts/database, concepts/session-management, plugins/jwt, authentication/email-password, authentication/google,
concepts/rate-limit, reference/options).

## 0. Verification gates (do these first, record answers in §8)

The research for this plan found conflicting or unconfirmed facts. Check them **against the installed version's types
and docs** (`node_modules/better-auth`), not memory:

| # | Question | Why it matters |
| :--- | :--- | :--- |
| G1 | Exact `better-auth` version to pin, and the matching CLI (`npx auth@<version>` vs `@better-auth/cli`) | CLI output must match the runtime schema |
| G2 | `advanced.database.generateId: "uuid"` produces `uuid` columns in the generated Postgres SQL (not `text`) | D4: domain FKs are `uuid` |
| G3 | Full column lists of `user`, `session`, `account`, `verification`, `jwks` in the generated SQL | Alembic revision, seed script |
| G4 | `database.schemaName` (or `search_path`) puts every table in schema `auth`, at runtime and in `generate` | D3 |
| G5 | `jwt` plugin: how to set `issuer`/`audience` (we need `aud` = API URL, not the default `baseURL`), default alg (expected EdDSA/Ed25519), expiry (expected 15 min), JWKS path (expected `/api/auth/jwks`), how to get a token server-side (`auth.api.getToken({ headers })` or the `set-auth-jwt` header of `getSession`) | FastAPI verification and `Session.accessToken` |
| G6 | `databaseHooks` signatures and `hooks.before/after` API shape | Only if used (we prefer the DB trigger, D12) |
| G7 | Rate-limit storage default (memory vs secondary storage) and the default rule for `/sign-in/email` | Multi-instance production needs `storage: "database"` |
| G8 | `minPasswordLength` can be lowered to 6 (default expected 8) | Q3: 6; only if it cannot, use 8 and update `SignInSchema` + `password-input` |
| G9 | Error class thrown by `auth.api.*` on the server (`APIError` from `better-auth/api`) and its `status`/`statusCode` fields | `isExpectedError` |

## 1. Files (in `apps/web`)

```
lib/auth/
├── config.ts                 # + better-auth branch in the discriminated union (§4)
├── index.ts                  # getAuthProvider(): + "better-auth" → ./better-auth/server
├── proxy.ts                  # updateSession(): + "better-auth" → ./better-auth/proxy
├── types.ts                  # unchanged (AuthProvider, Session, ProxyAuthResult)
├── permissions.ts            # unchanged (role → permissions)
└── better-auth/
    ├── auth.ts               # import "server-only"? NO: the proxy imports it too (same reason as config.ts). Exports `auth = betterAuth({...})`
    ├── server.ts             # import "server-only"; export const betterAuthProvider: AuthProvider
    └── proxy.ts              # updateSession(request) for proxy.ts
app/api/auth/[...all]/route.ts  # export const { GET, POST } = toNextJsHandler(auth)
```

- `proxy.ts` matcher already excludes `/api` (`"/((?!api|_next/static|_next/image|favicon.ico).*)"`), so Better Auth's
  routes are not intercepted. Keep it that way.
- No browser auth client is needed: sign-in/up/out stay **Server Actions** (`features/auth/actions.ts`) calling
  `auth.api.*` with `headers: await headers()`, and the `nextCookies()` plugin (last in the plugin list) writes the
  cookies from the action. Components and forms do not change.
- ESLint: add `lib/auth/better-auth/*` to the rule that forbids client code from importing `lib/auth/config.ts` (it reads
  secrets).

## 2. `auth.ts` configuration (target)

```ts
export const auth = betterAuth({
  baseURL: authConfig.BETTER_AUTH_URL,           // public URL of web, e.g. https://app.example.com
  secret: authConfig.BETTER_AUTH_SECRET,         // ≥ 32 chars, per environment
  database: new Pool({ connectionString: authConfig.DATABASE_URL, options: "-c search_path=auth" }), // or schemaName (G4)
  advanced: {
    database: { generateId: "uuid" },            // G2, D4
    useSecureCookies: process.env.NODE_ENV === "production",
  },
  trustedOrigins: [authConfig.BETTER_AUTH_URL],
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,                            // sign-up lands signed in (today's backend/supabase-without-confirm behaviour)
    requireEmailVerification: false,             // Q2: no verification
    minPasswordLength: 6, maxPasswordLength: 128, // Q3: same as SignInSchema (G8)
  },
  socialProviders: {
    google: { clientId: authConfig.GOOGLE_CLIENT_ID, clientSecret: authConfig.GOOGLE_CLIENT_SECRET }, // only when both are set
  },
  user: {
    additionalFields: { role: { type: "string", defaultValue: "member", input: false } }, // input:false: users cannot set it
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,                 // defaults, written out so they are reviewed
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 }, // getSession without a DB hit (principle 1)
  },
  rateLimit: { enabled: true, storage: "database" }, // G7
  plugins: [
    jwt({ jwt: {
      issuer: authConfig.BETTER_AUTH_URL,        // https://app.example.com
      audience: authConfig.API_AUDIENCE,         // https://api.example.com: tokens are only for the API (G5)
      definePayload: ({ user }) => ({ role: user.role, name: user.name, email: user.email }), // sub = user.id
    } }),
    nextCookies(),                               // must stay last
  ],
})
```

Choices to note:

- **Role**: an `additionalFields.role` (`input: false`) replaces Supabase `app_metadata.role`. Use the `admin` plugin
  instead only when the Members feature is built (it brings `role`, ban, impersonation and list-users endpoints).
  Either way `parseRole()` maps unknown values to `member`.
- **Name**: Better Auth's `user.name` replaces `user_metadata.name`. It is user-editable, so it is display only (same as
  today).
- **JWT payload**: keep it small (`sub`, `role`, `name`, `email`); FastAPI reads only `sub` (and later `role`).

## 3. Schema and migrations

- Run Better Auth's CLI `generate` against `auth.ts` (G1) → SQL for `auth.user`, `auth.session`, `auth.account`,
  `auth.verification`, `auth.jwks`, `auth."rateLimit"` (if database storage). Commit it as an Alembic revision in
  `apps/api/migrations/versions/` (D3) with a header comment naming the Better Auth version. **Never run the CLI's
  `migrate` against a shared database.**
- Same revision: trigger `after insert on auth."user"` → `insert into public.user_settings (user_id) values (new.id)
  on conflict do nothing` (D12). `adopted_on` default: today's code uses `current_date` (DB session date, not the user's
  timezone). Keep `current_date` for parity, or compute in UTC explicitly; record the choice in `modules/settings.md`.
- Drift check (CI or a pytest): re-run `generate` into a temp file and compare with the committed SQL; fail on diff.
  Required when Better Auth is upgraded or a plugin is added.

## 4. Environment

`lib/auth/config.ts` gets a third branch; `AUTH_PROVIDER` default stays `backend` until Phase 9 removes the others.

```ts
z.object({
  AUTH_PROVIDER: z.literal("better-auth"),
  API_BASE_URL: z.url(),                 // FastAPI, e.g. https://api.example.com/v1/ (http://api:8000/v1/ in compose)
  API_AUDIENCE: z.url(),                 // JWT `aud`, e.g. https://api.example.com
  DATABASE_URL: z.url(),                 // Better Auth's pg Pool (role with rights on schema auth only)
  BETTER_AUTH_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
})
```

Add each variable to `turbo.json` `build.env`, `apps/web/.env.example`, `vitest.config.ts` test env and the CI
placeholders. `apps/api/.env.example`: `DATABASE_URL`, `AUTH_JWKS_URL` (`https://app.example.com/api/auth/jwks`),
`AUTH_ISSUER` (= `BETTER_AUTH_URL`), `AUTH_AUDIENCE` (= `API_AUDIENCE`), `ALLOWED_HOSTS`.

## 5. `AuthProvider` implementation (`better-auth/server.ts`)

| Method | Implementation | Today's equivalent (keep the behaviour) |
| :--- | :--- | :--- |
| `getSession()` | `await io()`; `const s = await auth.api.getSession({ headers: await headers() })` (cookie cache → no DB hit); if null → `null`; JWT via G5 (`auth.api.getToken({ headers })` or the `set-auth-jwt` header with `returnHeaders: true`); return `{ userId: s.user.id, accessToken: jwt, role: parseRole(s.user.role), name: s.user.name ?? null, email: s.user.email ?? null }` | Supabase `getClaims()` + `getSession()` |
| `verifySessionFresh()` | same with `query: { disableCookieCache: true }` (DB lookup, sees revocation) | `getUser()` |
| `signIn({ email, password })` | `auth.api.signInEmail({ body: { email, password }, headers: await headers() })` | `signInWithPassword` |
| `signUp({ name, email, password })` | `auth.api.signUpEmail({ body: { name, email, password }, headers })`; returns `"signed-in"` (autoSignIn; verification is off, Q2) | `auth.signUp` |
| `signOut()` | `auth.api.signOut({ headers: await headers() })` (current session only) | `signOut({ scope: "local" })` |
| `isExpectedError(e)` | `e instanceof APIError && status in 4xx` (G9) — wrong password, email taken, weak password, rate limit | Supabase `AuthError` 4xx |
| `oauth.start("google", redirectTo)` | `auth.api.signInSocial({ body: { provider: "google", callbackURL: DASHBOARD_PATH (absolute), errorCallbackURL: SIGN_IN_PATH?error=oauth }, headers })` → `url` | `signInWithOAuth` |
| `oauth.exchangeCode` | not needed: Better Auth handles `/api/auth/callback/google` itself. Make the method optional in practice (the callback route is removed at Phase 9) | `exchangeCodeForSession` |

Token cost: measure `getSession` + JWT minting on a warm server (Server-Timing). Target: no DB query per navigation
while the cookie cache is fresh. The DAL's `getSession` is `"use cache: private"`, so every query in a request shares one
session read and one mint (`React.cache` would repeat it once per private cache scope: 9–12 per dashboard request,
`docs/migration/known-issues.md` §1) — never cache the JWT across requests in a shared cache.

Error message text: Better Auth's messages differ from Supabase's ("Invalid email or password" vs "Invalid login
credentials"). List both in `modules/auth.md` and decide (keep Better Auth's, or map). Use generic messages (no account
enumeration).

## 6. Proxy (`better-auth/proxy.ts`)

`proxy.ts` runs on the Node.js runtime in Next 16 (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`
"Runtime"), so it can call Better Auth directly:

```ts
export async function updateSession(request: NextRequest): Promise<ProxyAuthResult> {
  const { headers: setHeaders, response: session } = await auth.api.getSession({
    headers: request.headers, returnHeaders: true,
  })
  const response = NextResponse.next({ request })
  // copy Set-Cookie (session expiry extended past updateAge, cookie cache refreshed) to request + response
  …
  return { response, isAuthenticated: Boolean(session) }
}
```

- This keeps principle 2 (refresh only in the proxy): Server Components cannot write cookies, so the session-expiry
  extension and the cookie-cache refresh must be written here. Copy cookies onto the **request** too, so Server
  Components in the same request see them (today's `backend/proxy.ts` does the same).
- Cheaper alternative if profiling says so: `getSessionCookie(request)` (presence only, no verification) for the
  redirect, and accept that the expiry extension happens only in actions. Record which one was chosen and why.
- `redirectWithSession` in `proxy.ts` already copies cookies onto redirects; keep it.

## 7. FastAPI side (`core/security.py`)

```python
jwks = PyJWKClient(settings.auth_jwks_url, cache_keys=True, lifespan=300)  # created in lifespan
def current_user(creds = Depends(HTTPBearer(auto_error=False))) -> CurrentUser:
    if creds is None: raise Unauthorized("Missing token")
    key = jwks.get_signing_key_from_jwt(creds.credentials)          # refetches on unknown kid (rotation)
    claims = jwt.decode(creds.credentials, key.key, algorithms=["EdDSA"],
                        issuer=settings.auth_issuer, audience=settings.auth_audience,
                        options={"require": ["exp", "sub", "iat"]})
    return CurrentUser(id=UUID(claims["sub"]), role=claims.get("role", "member"))
```

- `algorithms` is hard-coded (never read from the token header). `PyJWT[crypto]` (cryptography) for Ed25519.
- `PyJWKClient` is synchronous; call it in a thread (`anyio.to_thread.run_sync`) or prefetch keys at startup so the
  event loop is not blocked by a JWKS fetch.
- Every failure → 401 problem details. `lib/http.ts` then ends the session (flow 4 of `authentication.md`).
- The user row is not looked up per request (stateless, principle 1). A deleted user's JWT works until it expires
  (≤ 15 min); writes then fail on the FK and are mapped to 401. Record this limit in the new `authentication.md`.
- Tests sign tokens with a fixture Ed25519 key and override the JWKS client (target-architecture §7).
- Two domains (Q4): the API fetches keys from the **public** JWKS URL of `web`. Cache keys (`cache_keys=True`) so a
  short `web` outage does not stop verification of tokens signed with a known `kid`; an unknown `kid` while `web` is down
  is a 401. Prefetch at startup but do not fail startup when `web` is unreachable (deploy order must not matter).
- `iss` must equal `https://app.<domain>` and `aud` `https://api.<domain>` exactly (no trailing slash differences);
  a test decodes a real token from the running stack and compares.

## 8. Gate answers (fill in during Phase 2)

| # | Answer | Source (file:line or URL) |
| :--- | :--- | :--- |
| G1 | | |
| G2 | | |
| G3 | | |
| G4 | | |
| G5 | | |
| G6 | | |
| G7 | | |
| G8 | | |
| G9 | | |

## 9. Google OAuth

- The Google button is **disabled today** (`app/(auth)/sign-in/page.tsx:85` comment; `GoogleSignInButton` not
  rendered). Phase 2 wires the provider and renders the button when `GOOGLE_CLIENT_ID` is set (replace the comment's
  `AUTH_PROVIDER === "supabase"` condition).
- Google Cloud console: authorized redirect URI `<BETTER_AUTH_URL>/api/auth/callback/google` (per environment).
- CSP (`next.config.ts`): `form-action` keeps `https://accounts.google.com` for the better-auth provider (the action
  redirects there); the Supabase origin entry goes at Phase 9.
- Account linking (same email via password and Google): decide `account.accountLinking` and record it; Supabase linked
  identities by verified email.

## 10. Password reset (out of scope)

Not built now (README Q2/Q5): the app sends no email. `emailAndPassword` has no `sendResetPassword`, so Better Auth's
reset endpoints stay unusable. To add it later: an email sender (`lib/email.ts`, provider env vars, a local mail catcher
such as Mailpit in compose), `sendResetPassword` + `revokeSessionsOnPasswordReset: true`, pages `/forgot-password` and
`/reset-password`, two actions in `features/auth`, an optional `passwordReset` member on `AuthProvider` (like `oauth`),
neutral messages (no account enumeration) and a rate-limit rule for `/request-password-reset`.
