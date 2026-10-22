---
name: next-mono-base
description: >
  Essential architecture conventions, data fetching, caching ('use cache'), mutations,
  DAL rules and client state (Zustand) for next-mono-base (Next.js 16.4 + Turborepo). Use whenever
  creating or modifying routes, pages, components, queries, server actions, or auth in this repository,
  and whenever the user mentions Zustand, a client store, global/shared client state, persist, or
  state that must survive or reset across navigation, even if they do not name the library.
---

# next-mono-base Conventions & Decision Router

Fast decision guide for `apps/web` running on **Next.js 16.4.0** with `cacheComponents: true` and `partialPrefetching: true`.
All principles derive from and link back to the Single Source of Truth in `docs/`.

---

## 1. Decision Router (What are you building?)

| Task / Intent | Solution Pattern | Quick Ref | Source of Truth (Docs) |
| :--- | :--- | :--- | :--- |
| **Add a feature / page / route** | Feature slice in `features/<name>` + compose in `app/` | [project-structure.md](references/project-structure.md) | [project-structure.md](../../../docs/project-structure.md) |
| **Read data for a page** | Server Component $\rightarrow$ `queries.ts` $\rightarrow$ `server.ts` | [reads.md](references/reads.md) | [data-fetching.md §4](../../../docs/data-fetching.md#4-reading-on-the-server) |
| **Pass data to Client Component** | Pass un-awaited Promise $\rightarrow$ React 19 `use(promise)` | [reads.md](references/reads.md) | [data-fetching.md §7.1](../../../docs/data-fetching.md#71-promise--use) |
| **Cache shared data** | `"use cache"` + `cacheLife("hours")` + `cacheTag()` | [caching.md](references/caching.md) | [data-fetching.md §5.1](../../../docs/data-fetching.md#51-use-cache) |
| **Cache per-user data** | `"use cache: private"` + `cacheLife()` (browser-only) | [caching.md](references/caching.md) | [data-fetching.md §5.2](../../../docs/data-fetching.md#52-per-user-data) |
| **Write / Update / Delete** | Server Action in `actions.ts` + `updateTag()` | [mutations.md](references/mutations.md) | [data-fetching.md §8](../../../docs/data-fetching.md#8-mutations) |
| **Filters, search, pagination** | URL searchParams + `<Form>` / `<Link>` (no client state) | [interactive.md](references/interactive.md) | [data-fetching.md §7.2](../../../docs/data-fetching.md#72-interactive-lists-and-forms-without-a-client-data-library) |
| **Multi-panel layout / Modals** | Parallel Routes (`@slot`) & Intercepting Routes (`(.)`) | [project-structure.md](references/project-structure.md) | [routing-and-layouts.md](../../../docs/routing-and-layouts.md) |
| **Lazy load / Code-split client UI** | `next/dynamic` (`{ ssr: false }`) & on-demand imports | [reads.md](references/reads.md) | [performance-optimization.md](../../../docs/performance-optimization.md#1-code-splitting--lazy-loading-lazy-loadingmd) |
| **Prevent flash / Preserve UI state** | Inline script + `suppressHydrationWarning` / `<Activity>` | [reads.md](references/reads.md) | [performance-optimization.md](../../../docs/performance-optimization.md#4-preventing-flash-before-hydration) |
| **Authenticate / verify session** | `verifySession()` from `@/lib/dal` (inside queries/actions) | [auth-dal.md](references/auth-dal.md) | [authentication.md §2](../../../docs/authentication.md#2-architecture) |
| **Auth provider / packages / Supabase data** | `AUTH_PROVIDER` (default `supabase`), adapters in `packages/auth`, data in `packages/db`; feature data in `server.ts` | [auth-dal.md](references/auth-dal.md) | [providers.md](../../../docs/providers.md) |
| **Page feels slow (data)** | Count sequential network awaits; start reads before the first `await`; values needed first from the session (`getCalendar()`) | [reads.md](references/reads.md) | [providers.md §5](../../../docs/providers.md#5-latency-what-was-measured-and-what-to-do) |
| **Extract code to `packages/`** | Keep in `apps/web` unless 2+ apps or diff runtime | [project-structure.md](references/project-structure.md) | [project-structure.md §6](../../../docs/project-structure.md#6-monorepo-package-extraction-when-to-extract-to-packages) |
| **Random, time, sync DB** | Today's date: `getToday()` (`lib/clock.ts`, `"use cache: private"`); other: `await io()` inside `<Suspense>` | [reads.md](references/reads.md) | [data-fetching.md §1](../../../docs/data-fetching.md#1-mental-model) |
| **Client-only shared state (Zustand)** | Per-provider store factory in `features/<name>/store.ts` + provider in `components/`, mounted in `app/` (no global store, never read in Server Components) | [client-state.md](references/client-state.md) | [client-state.md](../../../docs/client-state.md) |
| **Reset or keep client state across navigation** | Cache Components preserves state (`<Activity>`); reset via handler, data-derived key, or `bfcacheId` key | [client-state.md](references/client-state.md) | [client-state.md §5.3](../../../docs/client-state.md#53-state-outlives-navigation) |
| **Re-render, bundle or async-waterfall work** | Spark docs first; then `vercel-react-best-practices` through its overrides (React Compiler is off, no client fetch libs) | [reads.md](references/reads.md) | [vercel-skills.md](../../../docs/vercel-skills.md) |
| **Component composition (compound components, slots, context)** | Read `vercel-composition-patterns` via the overrides: flat prefixed exports, `ReactNode` slots | [project-structure.md](references/project-structure.md) | [vercel-skills.md §1.4](../../../docs/vercel-skills.md#14-composition-and-state) |
| **Redis cache / SSE / Uploads** | Distributed CacheHandler, Presigned URLs, `connection()` | [reads.md](references/reads.md) | [advanced-patterns.md](../../../docs/advanced-patterns.md) |

---

## 2. Five Golden Rules (Non-Negotiable)

1. **Server-First by Default**: No client data libraries (TanStack Query, SWR). Reads in Server Components, writes in Server Actions ([docs §3](../../../docs/data-fetching.md#3-choosing-how-to-read-data)). A Zustand store is for client-only UI state shared across distant client components, never for server data ([client-state.md §1](../../../docs/client-state.md#1-mental-model)).
2. **Never `await` at Top-Level of Page/Layout**: Push `await cookies()`, `headers()`, `params`, `searchParams` into child components wrapped in `<Suspense>` ([docs §4.4](../../../docs/data-fetching.md#44-request-time-data)).
3. **Always Call `cacheLife()` with `"use cache"`**: Cache keys use plain IDs only (never tokens, emails, or secrets) ([docs §5.1](../../../docs/data-fetching.md#51-use-cache)).
4. **Prefer `io()` over `connection()`**: `io()` allows prefetching and works inside `"use cache: private"`; `connection()` blocks prefetches ([docs §1](../../../docs/data-fetching.md#1-mental-model)).
5. **Strict Architectural Boundaries**: `features/<name>` never imports `app/` or sibling features. Only `server.ts` (through `@/lib/data`) and `lib/dal.ts` perform data I/O ([docs](../../../docs/project-structure.md#4-dependency-direction--eslint-boundary-enforcement)).

---

## 3. Source of Truth Documentation Index

When facing complex edge cases, always consult the full architecture docs:
- [docs/project-structure.md](../../../docs/project-structure.md) — Feature-based architecture, ESLint boundaries, and monorepo package extraction.
- [docs/routing-and-layouts.md](../../../docs/routing-and-layouts.md) — Parallel Routes, Intercepting Routes, Route Groups, and Layout/Template lifecycle.
- [docs/data-fetching.md](../../../docs/data-fetching.md) — Core reading, caching, streaming, and mutation model.
- [docs/performance-optimization.md](../../../docs/performance-optimization.md) — Code splitting, lazy loading, package bundling, hydration flash prevention, and Core Web Vitals.
- [docs/authentication.md](../../../docs/authentication.md) — Session lifecycle, token refresh in proxy, Supabase provider, Better Auth kept as identity foundation ([providers.md](../../../docs/providers.md) to switch).
- [docs/client-state.md](../../../docs/client-state.md) — Zustand: per-request store factory, provider placement in the feature layout, selectors, middleware notes.
- [docs/advanced-patterns.md](../../../docs/advanced-patterns.md) — Distributed Redis cache, large uploads, SSE, OpenTelemetry & Playwright instant tests.
- [docs/vercel-skills.md](../../../docs/vercel-skills.md) — Spark overrides for the vendored Vercel skills. Those skills are secondary: this skill and `docs/` win on any conflict. Read it before applying `vercel-react-best-practices`, `vercel-composition-patterns`, `vercel-react-view-transitions` or `web-design-guidelines`.
