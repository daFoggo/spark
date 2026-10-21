# Module: auth (Phase 2)

Baseline inventory from reading the code on 2026-10-21. **Re-verify in playbook step 1** (playbook steps apply with
"FastAPI endpoint" read as "Better Auth API call"). Design: [auth-better-auth.md](../auth-better-auth.md). Today's
behaviour: [docs/authentication.md](../../authentication.md). Paths relative to `apps/web/`.

## A. Surface today

| Piece | File | Behaviour to keep |
| :--- | :--- | :--- |
| `AuthProvider` / `Session` | `lib/auth/types.ts` | Interface unchanged; Better Auth is a third implementation |
| Provider switch | `lib/auth/config.ts`, `index.ts`, `proxy.ts` | Zod discriminated union; misconfig fails at build |
| DAL | `lib/dal.ts` | `getSession` (memoized), `verifySession` → `/auth/expired`, `requirePermission` → `forbidden()`, `verifySessionFresh` |
| Proxy | `proxy.ts` | Refresh, optimistic redirects (`/` → dashboard or sign-in; protected → sign-in; auth pages → dashboard), `redirectWithSession` copies cookies + cache headers, `Server-Timing` |
| Actions | `features/auth/actions.ts` | `signInAction`, `signUpAction` (`confirmEmail` branch), `signInWithGoogleAction`, `signOutAction`; expected errors returned with non-secret values echoed; `redirect` outside try/catch |
| Schemas | `features/auth/schemas.ts` | email; password 6–128; name trim 1–255 |
| Components | `features/auth/components/*` | `sign-in-form` (error + email kept), `sign-up-form` ("Check your email" alert), `google-sign-in-button` (**not rendered**: `app/(auth)/sign-in/page.tsx:85`), `sign-out-menu-item`, `password-input` (minLength 6) |
| Routes | `app/auth/callback/route.ts` (Supabase PKCE), `app/auth/expired/route.ts` (sign out + redirect) | expired route stays; callback replaced by `/api/auth/callback/google` |
| HTTP 401 | `lib/http.ts` `endRejectedSession` | render → `/auth/expired`; action → sign out + `/sign-in` |
| Roles | `lib/auth/permissions.ts`, `config/navigation.ts` | member: dashboard:view, settings:view; admin adds members:view/manage; unknown → member |
| Session display | `session-nav.tsx` `SessionAccount`, `user-menu.tsx`, `settings/account/page.tsx` | `name ?? email ?? "Account"`, role badge, user id |
| CSP | `next.config.ts` | `form-action` allows Google (+ Supabase today) |
| Tests | `lib/auth/__tests__/permissions.test.ts`, `lib/auth/backend/__tests__/cookie*.test.ts`, `lib/__tests__/url.test.ts` | permissions test stays; backend cookie tests deleted with the backend provider at Phase 9 |
| DB | `handle_new_user` trigger (settings row); `seed.sql` inserts `auth.users` + identity directly | D12 trigger; seed through Better Auth (target-architecture §7) |

## Findings to decide

1. Password minimum: **6** (Q3 answered), set `minPasswordLength: 6`; gate G8 confirms it is allowed.
2. Email verification is off (Q2 answered): the `confirmEmail` UI branch becomes unreachable; remove it at Phase 9
   together with the Supabase provider (it exists only for Supabase).
3. Error texts change (Supabase vs Better Auth messages): list them, keep generic wording.
4. Account linking for Google + password with the same email.
5. The `backend` provider (iron-session) is never used with a real backend: **delete it** at Phase 9 together with
   Supabase (README Q6): `lib/auth/backend/*`, its cookie tests, `iron-session`, `SESSION_SECRET`/`SESSION_COOKIE_NAME`
   in config, `turbo.json`, CI and `vitest.config.ts` (switch those placeholders to `better-auth`).
6. No password reset and no email sending (Q2, Q5); same as today.
7. No data import (Q1): existing Supabase accounts are not carried over.

## Parity checklist

- [ ] Sign up (name, email, password) → signed in → Today; duplicate email → form error, name/email kept.
- [ ] Sign in: correct → Today; wrong password → generic error, email kept; rate limit after repeated failures → error, not 500.
- [ ] Sign out (menu) → `/sign-in`; other browsers' sessions untouched.
- [ ] Google: new user → account + settings row; returning user → same id; error → `/sign-in?error=oauth` message.
- [ ] Proxy: `/` redirects correctly both ways; protected page without session → sign-in; `/sign-in` with session → dashboard; cookies preserved on redirects.
- [ ] `Session` fields: `userId` (uuid), `name`, `email`, `role` shown in the user menu and Account page.
- [ ] Admin role (set in DB) → Members link visible and page 200; member → 403 page.
- [ ] Session revoked in `auth.session` → `verifySessionFresh` returns null; normal navigation ends at sign-in within the cookie-cache window, no loop.
- [ ] FastAPI: valid JWT → 200 `/v1/me`; expired, wrong `iss`/`aud`, wrong key, `alg: none`, HS256 → 401; key rotation (new `kid`) picked up.
- [ ] Two domains: `iss` = web URL, `aud` = API URL on a real token; API keeps verifying known keys while `web` is briefly down.
- [ ] Backend 401 during render → `/auth/expired` → sign-in; during action → sign-in.
- [ ] No auth request on a normal navigation beyond the cookie read (Server-Timing / DB log).
- [ ] CSP: no violations on sign-in pages (email and Google).
- [ ] `pnpm check`, `pnpm build` with `AUTH_PROVIDER=better-auth` and with `supabase`.
