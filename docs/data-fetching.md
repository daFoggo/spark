# Data fetching, caching and mutation

How `apps/web` reads data, caches it and changes it. Written against **Next.js 16.4.2** with
`cacheComponents: true` and `partialPrefetching: true` ([next.config.ts](../apps/web/next.config.ts)).
Sources are the docs shipped with the package (`apps/web/node_modules/next/dist/docs/01-app/`, written `DOCS/` below);
re-read them after upgrading Next. Authentication details live in [authentication.md](authentication.md).
Advanced production extensions (distributed cache, large file uploads, SSE, telemetry and instant-navigation tests) live in [advanced-patterns.md](advanced-patterns.md).

Performance work (growing the static shell, prefetch tuning, instant-navigation tests) is summarized in
[section 9](#9-navigation-and-prefetching-optimization) and treated separately in [advanced-patterns.md](advanced-patterns.md).

## 1. Mental model

With Cache Components, **nothing is cached unless you say so**, and every route is prerendered into a **static shell**
at build time. Each piece of async work in a component ends up in exactly one of three places
(`DOCS/01-getting-started/08-caching.md` → Prerendering):

| The work is… | Mark it with | Ends up |
|---|---|---|
| Pure / module-level / sync I/O (imports, `fs.readFileSync`) | nothing | In the static shell |
| Reusable across requests (shared data, or per-user data with a lifetime) | `"use cache"` (+ variants) and `cacheLife` | In the static shell, or in the browser cache for `private` |
| Fresh per request, or reads `cookies()` / `headers()` / `params` / `searchParams` | `<Suspense fallback>` around it | Fallback in the shell, content streamed at request time |

Uncached or runtime work **outside** `<Suspense>` is a "blocking route": the dev overlay and `next build` report it with
fix cards (`DOCS/02-guides/instant-navigation.md`). `<Suspense>` alone does not make sync work dynamic.

`Math.random()`, `Date.now()`, `new Date()`, `crypto.randomUUID()` must be decided explicitly: cache the value with
`"use cache"`, or call `await io()` (from `next/cache`) first so it runs per request (`DOCS/03-api-reference/04-functions/io.md`).
Prefer `io()` over `connection()`: `connection()` waits for a real request and also blocks prefetches; `io()` resolves
immediately inside cache scopes and at request time, and only suspends while prerendering.
`io()` outside a cache scope still keeps everything after it out of the App Shell (prefetch), so a clock read that feeds
per-user reads goes in `"use cache: private"` instead (`lib/clock.ts` `getToday`): request-time, prefetchable, never shared.

## 2. Where code lives

```
app/**/page.tsx, layout.tsx      compose only; await nothing at the top level
  └─ features/<x>/queries.ts     reads for Server Components: auth via lib/dal, cache directives here
       └─ features/<x>/server.ts "server-only" I/O, parses responses with Zod
            └─ lib/data.ts       createDataClient(accessToken) over @workspace/db/server: PostgREST as the user (RLS),
                                 unwrap throws DataError, never returns fallback data
features/<x>/actions.ts          "use server" mutations: verifySession, Zod, write, invalidate
features/<x>/schemas.ts          Zod schemas + types, safe on client and server
lib/dal.ts                       getSession / verifySession / verifySessionFresh
```

This is the **Data Access Layer** approach Next recommends for new projects: server-only, authorizes, returns minimal
DTOs; only the DAL and `@workspace/db/env` / `@workspace/auth/config` read secrets (`DOCS/02-guides/data-security.md`). ESLint enforces the boundaries
(`features/` never import `app/` or each other; `components/` never import `server.ts`, `queries.ts`, `lib/dal`, `lib/data`).
For complete project structure conventions, feature anatomy, and package extraction rules, see [project-structure.md](project-structure.md).

## 3. Choosing how to read data

| Need | Use | Section |
|---|---|---|
| Data for a page, read on the server | Async Server Component calling `queries.ts` | [4](#4-reading-on-the-server) |
| Same read from several components in one request | `fetch` memoization or `React.cache` | [4.3](#43-deduplicating-within-a-request) |
| Shared data reused across requests | `"use cache"` + `cacheLife` + `cacheTag` | [5.1](#51-use-cache) |
| Per-user data with a lifetime | `"use cache: private"`, or extract `userId` and pass it to `"use cache"` | [5.2](#52-per-user-data) |
| Shared runtime cache across serverless instances | `"use cache: remote"` (needs a cache handler) | [5.3](#53-use-cache-remote) |
| Fresh data on every request | No directive, inside `<Suspense>` | [6](#6-streaming-and-loading-states) |
| Server data needed by a Client Component | Pass the **un-awaited promise**, read it with `use()` | [7.1](#71-promise--use) |
| Filters, search, pagination | URL search params: `<Form>` / `<Link>`, the Server Component re-reads | [7.2](#72-interactive-lists-and-forms-without-a-client-data-library) |
| Instant feedback while a write runs | `useOptimistic` + `useTransition`, `useActionState` | [7.2](#72-interactive-lists-and-forms-without-a-client-data-library), [8.3](#83-pending-and-optimistic-ui) |
| Live data (polling, focus refetch) | Not needed so far; see the rule in [7.3](#73-when-a-client-data-library-would-be-justified) | [7.3](#73-when-a-client-data-library-would-be-justified) |
| Webhooks, OAuth callbacks, non-UI responses | Route Handler (never for this app's own UI reads) | [7.4](#74-route-handlers) |
| Writing data | Server Action in `actions.ts` | [8](#8-mutations) |

**Server-first is the only default.** The app ships no client data library (no TanStack Query, no SWR): reads happen in Server
Components, writes in Server Actions, and the client only adds pending and optimistic state. Pick one approach per piece of
data; do not render the same data from a Server Component and a client fetch.

## 4. Reading on the server

### 4.1 Basics

Server Components can `await` any I/O. Here every database call goes through a feature `server.ts` → `createDataClient`
(PostgREST as the user, RLS applies; migrations in `packages/db/supabase`):

```ts
// features/<x>/server.ts
import "server-only"
export async function fetchThing(token: string, id: string) {
  const db = createDataClient(token)
  return ThingSchema.parse(unwrap(await db.from("things").select("*").eq("id", id).single()))
}
```

- `unwrap` throws `DataError` on any PostgREST error. A `401` on a request that carried a token ends the session (`endRejectedSession` in `lib/data.ts`): renders redirect
  to `/auth/expired` (a route, because renders cannot delete cookies); Server Actions sign out and redirect to `/sign-in`
  directly, because an action can only soft-navigate to a page. Failed reads throw; they never become `[]` or `null`.
- Parse responses with Zod in `server.ts` and return only the fields the UI needs (DTO).
- Do not call this app's own Route Handlers from Server Components: at build time there is no server, at runtime it adds a
  round trip (`DOCS/02-guides/backend-for-frontend.md` → Caveats).

### 4.2 Parallel and sequential reads

Two `await`s in a row run one after the other. Start independent requests first, then await together
(`DOCS/01-getting-started/06-fetching-data.md`):

```ts
const [a, b] = await Promise.all([getA(id), getB(id)]) // Promise.allSettled if one may fail alone
```

Better still, put independent reads in **sibling components**, each behind its own `<Suspense>`, so each streams on its own.
A read that needs another's result (`getPlaylists(artist.id)`) is sequential by nature: render it in a child behind
`<Suspense>` so the first result can paint. Layouts and pages of one route already render in parallel.

Each sequential `await` that hits the network costs one round trip: ~5 ms to a local API, ~150 ms to a far database.
Count them per page. A value most reads need first (the user's timezone for "today") is best carried in the session
token (`getCalendar()`), and a not-found check can run alongside the reads it guards
([providers.md §5](providers.md#5-latency-what-was-measured-and-what-to-do)).

**Preload** when a known input is available before other blocking work: call the read without `await` (`void getItem(id)`)
early, then call it again where it renders; the second call reuses the first because the read is deduplicated.

A promise started before an `await` can reject before anything is attached to it, which logs a spurious `unhandledRejection`: give it `.catch(() => {})` and still await it later (`Promise.all`).

### 4.3 Deduplicating within a request

- `fetch` `GET` calls with the same URL and options are memoized for one render pass (not in Route Handlers).
- Other reads: wrap in `React.cache`. Scope is one request; nothing is shared across requests.
- A read that private caches call (the DAL's `getSession`) is itself `"use cache: private"`: matching private calls in one
  request join a single fill, while `React.cache` would run once per scope (measured: 9–12 session reads per dashboard
  request before, 1 after).
- `React.cache` does **not** cross into a `"use cache"` scope: each cache scope has its own isolated `React.cache`.
  Pass values in as arguments instead (`DOCS/03-api-reference/01-directives/use-cache.md` → React.cache isolation).

### 4.4 Request-time data

`cookies()`, `headers()`, `params`, `searchParams` are runtime data. Read them **inside the component that needs them**,
behind `<Suspense>`; never `await` them at the top of a layout or page, which would pull everything below out of the shell
(`DOCS/02-guides/streaming.md` → Push dynamic access down):

```tsx
export default function Page({ params }: PageProps<"/things/[id]">) {
  return (
    <>
      <h1>Thing</h1> {/* in the static shell */}
      <Suspense fallback={<ThingSkeleton />}>
        {params.then(({ id }) => <Thing id={id} />)}
      </Suspense>
    </>
  )
}
```

Passing the promise as a prop (`<Thing params={params} />`) works too. Client hooks follow the same rule: `useSearchParams()`
always needs `<Suspense>`; `usePathname()` / `useParams()` need it under dynamic segments.

### 4.5 Errors in reads

| Case | Do |
|---|---|
| Resource does not exist | `notFound()` (renders `not-found.tsx`) |
| Unexpected failure (5xx, network, schema mismatch) | Let it throw: the nearest `error.tsx` renders, `retry()` re-fetches |
| Failure scoped to one component | Wrap it with a `catchError` boundary (`next/error`) |
| Session gone | `verifySession()` / `lib/data.ts` redirect to `/auth/expired` |

Once streaming has started the status is already `200`: `notFound()` or `redirect()` inside a streamed boundary becomes a
`noindex` meta tag or a client redirect. Run checks that must set a real status before any `<Suspense>`, or in `proxy.ts`.

## 5. Caching

### 5.1 `"use cache"`

Caches the return value of an async function or component. Put it on the **data function**, not the page, unless the whole
UI is reusable (`DOCS/03-api-reference/01-directives/use-cache.md`):

```ts
// features/<x>/queries.ts
export async function getCategories() {
  "use cache"
  cacheLife("hours")
  cacheTag("categories")
  return fetchCategories()
}
```

- **Always call `cacheLife`** (one call per invocation). Without it the `default` profile applies and nested caches change the
  outer lifetime silently; a short-lived inner cache without an explicit outer `cacheLife` fails the prerender.
- **Cache key** = build id + function id + serialized arguments + captured closure variables. Keys and `cacheTag` values are
  stored **in plain text**: never pass tokens, emails or other secrets as arguments or tags; use stable ids.
- Arguments and return values must be serializable (no class instances, functions, URL). JSX can be returned; `children`
  and Server Actions can be passed through without being read.
- Cannot read `cookies()` / `headers()` / `searchParams`, directly or through a helper (`next-request-in-use-cache`;
  on dynamic routes this can pass `next build` and fail at runtime). Read outside, pass the value in.
- Passing a promise of runtime data into a cache scope hangs the build (50 s timeout). Await outside, pass the value.
- `"use cache"` at the top of a file caches every export (all must be async).

`cacheLife` profiles (`DOCS/03-api-reference/04-functions/cacheLife.md`):

| Profile | `stale` (browser) | `revalidate` (server, SWR) | `expire` (server, hard) |
|---|---|---|---|
| `default` | 5m | 15m | never |
| `seconds` | 30s | 1s | 1m |
| `minutes` | 5m | 1m | 1h |
| `hours` | 5m | 1h | 1d |
| `days` | 5m | 1d | 1w |
| `weeks` | 5m | 1w | 30d |
| `max` | 5m | 30d | 1y |

Lifetime thresholds: `revalidate: 0` or `expire` < 5 min → excluded from prerenders (a dynamic hole, needs `<Suspense>`);
`stale` < 30 s → excluded from prerenders and prefetches; `stale` 30 s–5 min → prerendered but not in the App Shell.
Custom profiles go in `next.config.ts` → `cacheLife`. Data that only changes on writes: `cacheLife("max")` + a tag invalidated
by the mutation.

**Where entries live.** The server store is in-memory LRU per instance (50 MB, `cacheMaxMemorySize`): it persists across
requests on a long-running server but rarely survives between requests on serverless. Entries never survive a deploy
(the build id is part of the key). The browser keeps results for `stale` (minimum 30 s).

### 5.2 Per-user data

Two options (`DOCS/02-guides/authentication-with-cache-components.md`):

1. **Extract and pass** (server cache, shared by sessions with the same value). The exported getter resolves the user,
   then calls an **unexported** cached function with `userId`, so no caller can ask for another user's data:

   ```ts
   export async function getNotes() {
     const { userId } = await verifySession()
     return getNotesByUser(userId) // unexported, "use cache", cacheTag(`notes:${userId}`)
   }
   ```

   This only works when the cached function can load the data without the user's token (for example a database or a
   service credential), because a token argument would become part of the key. With this backend every per-user call needs
   the Bearer token, so use option 2.

2. **`"use cache: private"`** (browser only, never stored on the server). It may read `cookies()` / `headers()` /
   `searchParams` and call the DAL directly. This is the pattern for per-user cached resources:

   ```ts
   export async function getProfile(): Promise<Profile> {
     "use cache: private"
     cacheLife({ stale: 300, revalidate: 300, expire: 3600 })
     const { userId, accessToken } = await verifySession()
     cacheTag(profileTag(userId))
     return fetchProfile(accessToken)
   }
   ```

   Rules: `connection()` is not allowed inside (`io()` is, and resolves immediately there); keep `stale` ≥ 30 s for per-link
   prefetch and ≥ 5 min to be in the App Shell; it runs at request time, so its caller still needs `<Suspense>`.
   A page that also reads `searchParams` (or `params`) is not in the shared App Shell: give the links to it
   `prefetch` (per-link prefetching; sidebar: `prefetch: true` on the entry in `config/navigation.ts`; list → detail links
   such as `/dashboard/goals/[goalId]` set `<Link prefetch>` because a user's lists are short).
   `cacheLife({ stale: Infinity })` gives request-scoped dedupe without lowering the route's stale time.

### 5.3 `"use cache: remote"`

Stores entries in a remote cache handler (`cacheHandlers.remote` in `next.config.ts`) shared by every instance. Worth it only
for request-time content with a high hit rate (rate-limited or slow upstreams); key on low-cardinality values (category,
language), never on user ids. It cannot nest with `private` in either direction. See [advanced-patterns.md](advanced-patterns.md#2-distributed-remote-cache-cachehandlers--redis--upstash) for Redis implementation details. Not configured in this repo.

### 5.4 What not to use

`fetch(..., { cache, next: { revalidate, tags } })`, `unstable_cache`, `unstable_noStore` and the segment configs `dynamic`,
`revalidate`, `fetchCache`, `dynamicParams` belong to the previous model (`DOCS/02-guides/caching-without-cache-components.md`);
the last four fail the build with Cache Components. The only reason to reach for `unstable_cache` / `fetch` cache is data that
must survive a deploy.

## 6. Streaming and loading states

- `<Suspense>` is the unit of streaming: everything outside it is in the shell; each boundary resolves independently and is
  also a selective-hydration unit. Prefer granular boundaries close to the dynamic read.
- `loading.tsx` wraps the whole page in one boundary and is prefetched as the instant fallback. It does **not** cover the
  `layout.tsx` of its own segment: runtime reads in a layout need their own `<Suspense>`.
- Sibling boundaries reveal independently; nested boundaries reveal in stages (nesting changes reveal order, not request order).
- Fallbacks should match the size of the final UI (CLS). Keep the LCP element (main heading, hero image) outside boundaries.
  An empty fallback is fine only when the resolved UI has no footprint (an auth gate returning `null`).
- Do not add boundaries you do not need: under a slow network React may show any boundary's fallback.

## 7. Client-side data

### 7.1 Promise + `use()`

The default way to get server data into a Client Component without a library (`DOCS/01-getting-started/06-fetching-data.md`):

```tsx
// Server Component
const statsPromise = getStats() // not awaited
return (
  <Suspense fallback={<ChartSkeleton />}>
    <StatsChart statsPromise={statsPromise} />
  </Suspense>
)
// "use client": const stats = use(statsPromise)
```

To share one promise with many Client Components, create it inside the boundary and put it in a context provider that
consumers read with `use()` (`DOCS/02-guides/single-page-applications.md`). Props crossing the boundary must be serializable
and minimal (`DOCS/02-guides/data-security.md`).

### 7.2 Interactive lists and forms without a client data library

Next's own guidance is that many apps need no client data library; interaction is built from Server Functions, transitions,
optimistic UI and pending feedback (`DOCS/02-guides/client-side-data-fetching/index.md`, `DOCS/02-guides/interactive-apps.md`).
A standard interactive list with filters, pagination, and detail views is structured as follows:

| Piece | How | File |
|---|---|---|
| Reads | `queries.ts`: `"use cache: private"` + `cacheLife` + a per-user `cacheTag`, called from the page | `queries.ts` |
| Filters | A GET `<Form>` from `next/form`; selects submit on change. No client state: the URL is the state | `components/<name>-filters.tsx` |
| Pagination, row links | `<Link>`; a Server Component, no client JS | `components/<name>-table.tsx` |
| URL input | `await searchParams` **below** `<Suspense>`; drop empty values, parse with Zod, fall back to defaults | `app/(dashboard)/<name>/page.tsx` |
| Write | `<form action>` + `useActionState`; the action calls `updateTag` for the resource and lists | `actions.ts`, `components/<name>-form.tsx` |
| Pending | `useFormStatus` in the filter form; `pending` from `useActionState` on submit | |

While a navigation to new search params is in flight React keeps the old UI on screen (navigations are transitions), which is
the equivalent of a client library's "keep previous data". Add a pending hint with `useFormStatus` or a `data-pending`
attribute (`DOCS/02-guides/interactive-apps.md` → Step 3).

Measured against a standard REST backend: the same list, filter, pagination, detail and mutate feature written with Server Components and Server Functions vs TanStack Query took fewer lines of code, showed initial data faster (streaming rows on the first response without waiting for client-side watermarked fetch after hydration), shipped significantly less client bundle JavaScript, and maintained instant soft navigations.
already visited was ~6–12 ms either way). The one thing it did better, an instant status change after saving, is what
`useOptimistic` provides here.

### 7.3 When a client data library would be justified

None is installed. For live data try a small Client Component that calls `router.refresh()` on a timer first (it re-renders
the route's Server Components and keeps client state; it clears the client cache of the route but does not expire server
`"use cache"` entries, so give those reads a short `cacheLife`; `DOCS/03-api-reference/04-functions/use-router.md`). Not
exercised in this repo yet. Add a library only for a concrete need that this cannot meet: a browser cache **shared by several
components** with background revalidation (polling, focus or reconnect refetch, infinite scroll). Then:

- Choose **SWR** first: it is the Vercel-recommended option (`vercel-react-best-practices` rule `client-swr-dedup`), smaller,
  and `DOCS/02-guides/client-side-data-fetching/swr.md` documents the Cache Components pattern. TanStack Query is the choice
  only if SWR's mutation or pagination support is not enough.
- Never write the raw `useEffect` + `fetch` version (no dedup, no cancellation).
- `fetcher`/`queryFn` calls a **Route Handler** (7.4), never a Server Action (actions run one at a time).
- Mount its provider in the nearest layout that needs it, not the root. With Cache Components keep client queries behind
  `<Suspense>`: TanStack reads the clock while creating query state, and `dehydrate()` needs the cached-timestamp helper in
  `DOCS/02-guides/client-side-data-fetching/tanstack-query.md`.
- Record the need in this file before adding the dependency.

### 7.4 Route Handlers

`app/**/route.ts` are public HTTP endpoints: authenticate, validate, rate-limit, and never forward incoming headers to the
response. Use them for webhooks (`revalidateTag(tag, "max")` or `{ expire: 0 }`), OAuth callbacks and non-UI responses, not
for this app's own UI reads (Server Components call `queries.ts` directly). With Cache Components a `GET` handler prerenders
like a page unless it reads the request, uncached data or `Math.random()`; `"use cache"` must go on a helper.

`proxy.ts` excludes `/api` from its matcher, so a handler that reads the session does not get the token refresh that page
requests get: an expiring access token would be rejected although the refresh token is valid. A handler that serves the UI
must be added to the matcher (found while porting a client-fetching feature; verified by a plain `fetch` to such a handler
triggering `auth/refresh`).

## 8. Mutations

### 8.1 Server Actions

Writes go through Server Actions in `features/<x>/actions.ts` (`DOCS/02-guides/server-actions.md`):

```ts
"use server"
export async function updateThingAction(_prev: State, formData: FormData): Promise<State> {
  const session = await verifySession()                       // 1. authenticate (public endpoint)
  const parsed = UpdateThingSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }  // 2. validate
  try {
    await patchThing(session.accessToken, parsed.data)        // 3. write
  } catch (error) {
    if (isExpectedDataError(error)) return { error: error.message }        // expected → value
    throw error                                                // unexpected → error.tsx
  }
  updateTag(thingTag(session.userId))                          // 4. invalidate
  return { saved: true }                                       // 5. minimal return value
}
```

- **Every action authenticates and authorizes**, even if the form is only shown to signed-in users; check ownership of the
  resource, take ids from the client but never trusted data. Return only what the UI renders.
- **Expected** failures (validation, backend `4xx`) are returned as values and read with `useActionState`; **unexpected** ones
  throw to `error.tsx`. Never catch everything: `redirect()` and `notFound()` work by throwing, so a broad `catch` swallows them.
  Keep `redirect()` after the `try`, and rethrow anything that is not an expected error.
- The auth actions classify errors through the provider (`provider.isExpectedError`), so they stay provider-agnostic.
- Actions are dispatched **one at a time** per client: never use them to read data or expect `Promise.all` to parallelize them.
- Built-in protections: POST only, `Origin` vs host check (`serverActions.allowedOrigins`), 1 MB body (`bodySizeLimit`),
  encrypted ids, unused actions removed. Self-hosting on several instances needs a stable `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`;
  after a deploy old clients can hit "Failed to find Server Action", so offer a retry.
- Extra arguments: `action.bind(null, id)` (works without JS) rather than hidden inputs.
- The `FormData` an action receives also carries React's `$ACTION_*` bookkeeping fields (some with empty values). Read named
  fields, or skip keys starting with `$`, before validating "every field is non-empty".
- Do not mutate during render (no cookie writes or revalidation in Server Components).

### 8.2 Refreshing data after a write

| Call | Effect | Where |
|---|---|---|
| `updateTag(tag)` | Expires now; next read waits for fresh data (read-your-own-writes) | Server Actions only |
| `revalidateTag(tag, "max")` | Marks stale; next read serves stale and refreshes in background | Actions, Route Handlers |
| `revalidateTag(tag, { expire: 0 })` | Expires now, for webhooks where `updateTag` is unavailable | Route Handlers |
| `revalidatePath(path, type?)` | Invalidates by route path (soft tags) | Actions, Route Handlers |
| `refresh()` | Re-renders the current route; does not touch cached entries (for uncached reads) | Server Actions only |

`updateTag`, `revalidatePath`, `refresh` and cookie writes in an action make the response carry the re-rendered route, so the
UI updates in the same round trip; `revalidateTag(…, "max")` does not. Any of them clears the browser router cache. Call them
before `redirect()`. Prefer tags over paths. The single-argument `revalidateTag(tag)` is deprecated.

Tag naming: `<resource>` for lists, `<resource>:<id>` for one item, `<resource>:<userId>` for per-user data
(`profile:<userId>`). Up to 128 tags per call, 256 characters each.

### 8.3 Pending and optimistic UI

- `useActionState(action, initial)` → `[state, formAction, pending]` for forms; `useFormStatus` in a child button.
- `useOptimistic` + `startTransition` to show the result before the server answers; it reverts when the transition ends
  and fresh props arrive. State updates after an `await` inside a transition need their own `startTransition`.
- A `data-pending` attribute lets ancestors style pending work with CSS (`DOCS/02-guides/interactive-apps.md`).
- With Cache Components, routes are kept mounted (React `<Activity>`), so form values and `useActionState` results persist
  when the user navigates back; reset them explicitly where that is wrong (`DOCS/02-guides/preserving-ui-state.md`).

## 9. Navigation and prefetching (optimization)

Summary only; tuning is a separate task.

- With `partialPrefetching`, a default `<Link>` prefetches the route's **App Shell**: static + cached content + session data
  from `cookies()`/`headers()` (cached per session in the browser). Content that depends on `params`/`searchParams` streams
  after the click unless the link sets `prefetch={true}` (one server render per visible link).
- `await prefetch()` / `await navigation()` (`next/cache`) defer a subtree to the per-link prefetch / the navigation;
  `ensureStatic = 'shell' | 'prefetch' | 'navigation'` enforces static output for a stage; `export const prefetch =
  'force-disabled'` skips a segment. `connection()` excludes work from every prefetch.
- Dev validates every page load and client navigation for instant UI; `export const instant = false` opts a segment out.
  Inspect with the Navigation Inspector; lock behavior with `@next/playwright` `instant()` tests
  (setup and the test-build requirements: [advanced-patterns.md](advanced-patterns.md) §1).
- Prefetches run layouts and pages: keep render pure (no analytics or writes during render).

## 10. Checklist

- [ ] No `await` of runtime data or uncached reads at the top of a layout or page.
- [ ] Every uncached / runtime read sits inside a `<Suspense>` with a sized fallback.
- [ ] Every `"use cache"` has `cacheLife`; tagged if a mutation changes it; no tokens or PII in arguments or tags.
- [ ] Per-user data uses `"use cache: private"` (or an unexported `use cache` keyed by `userId` when no token is needed).
- [ ] Reads throw on failure; `createDataClient` responses are Zod-parsed into DTOs.
- [ ] Every action: `verifySession`, Zod, ownership check, minimal return, expected errors as values, others rethrown.
- [ ] Every write invalidates what it changed (`updateTag` for the user's own change).
- [ ] Clock and random values are cached (`"use cache: private"` when per request, like `getToday`) or behind `io()`.
- [ ] Links to pages that read `searchParams` / `params` use `prefetch`.
- [ ] Filters and pagination live in URL search params and render on the server; no client data library (rule in 7.3).
- [ ] Client data: promise + `use()`; instant feedback with `useOptimistic` / `useTransition` / `useActionState`.

## 11. Sources

All under `DOCS/` (Next.js 16.4.2): `01-getting-started/` 05 server and client components, 06 fetching data, 07 mutating data,
08 caching, 09 revalidating, 10 error handling, 15 route handlers; `02-guides/` client-side-data-fetching (index, swr,
tanstack-query; read, not adopted), backend-for-frontend, server-actions, forms, interactive-apps, single-page-applications, data-security,
streaming, authentication-with-cache-components, caching-without-cache-components, how-revalidation-works,
migrating-to-cache-components, optimizing-prefetching, prefetching, instant-navigation, preserving-ui-state;
`03-api-reference/` directives (use-cache, use-cache-private, use-cache-remote, use-server), functions (cacheLife, cacheTag,
updateTag, revalidateTag, revalidatePath, refresh, io, connection, prefetch, navigation, fetch, cookies, after, catchError),
file conventions (route, loading, error, route segment config), config (cacheComponents, cacheHandlers, cacheLife,
partialPrefetching, serverActions, cacheMaxMemorySize).
