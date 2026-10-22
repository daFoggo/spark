# Client state with Zustand

How `apps/web` keeps client-only state that several client components share. Written against **Next.js 16.4.0**,
React 19.3, `cacheComponents: true`, `partialPrefetching: true` and **Zustand v5** (checked against `zustand@5.0.15`).
Sources are the Next.js docs shipped with the package (`apps/web/node_modules/next/dist/docs/01-app/`, written `DOCS/` below)
and the official Zustand docs (`https://zustand.docs.pmnd.rs`, written `ZDOCS/` below, plus the docs source on GitHub).
Statements marked **(verified)** were exercised in this repository's stack (dev server, production build or Vitest);
section 10 lists what was and was not verified. For data fetching see [data-fetching.md](data-fetching.md), for the
folder layout see [project-structure.md](project-structure.md), for navigation and layouts see
[routing-and-layouts.md](routing-and-layouts.md).

Zustand is **not installed by default**. Add it only when a feature needs it: `pnpm --filter web add zustand`
(plus `immer` if you use the `immer` middleware).

---

## 1. Mental model

Client state has four homes. Pick the first one that fits:

| State is… | Home | Notes |
|---|---|---|
| Server data | Server Components, `queries.ts`, `"use cache"` | Never mirror it into a store; the cache is the cache ([data-fetching.md](data-fetching.md)) |
| Filters, search, pagination, active tab | URL search params | `<Form>` / `<Link>`; no client state ([data-fetching.md §7.2](data-fetching.md#72-interactive-lists-and-forms-without-a-client-data-library)) |
| Local to one component or page (form draft, open panel) | `useState` | With Cache Components it already survives navigation (section 5.3) |
| Client-only and shared by several distant client components (multi-step editor, audio player, canvas tool) | **Zustand store** | The only case this guide covers |

With Cache Components, Next.js keeps hidden routes mounted with React `<Activity>`, so page-level state is preserved out of
the box where it previously needed a shared layout or an external store (`DOCS/02-guides/preserving-ui-state.md`).

Zustand recommends one store for global state, split into slices when large (`ZDOCS/learn/guides/flux-inspired-practice`),
and also shows one store per domain (`ZDOCS/learn/guides/beginner-typescript`, "Multiple Stores"). This repository uses
**one store per feature**: features cannot import each other, so state two features must share is composed in `app/`
through props and callbacks, not by merging stores.

---

## 2. Where code lives

```
features/<x>/store.ts                            createXStore(initState) factory + types; no "use client", no server imports
features/<x>/components/<x>-store-provider.tsx   "use client": context + useState(() => createXStore) + useXStore hook
features/<x>/components/<consumer>.tsx           "use client": reads with useXStore(selector)
app/**/page.tsx | layout.tsx                     composes: mounts the provider, passes initState
```

| Concern | Location | Why |
|---|---|---|
| Store factory, state and action types | `features/<x>/store.ts` | Pure TypeScript; safe on the client |
| Provider and context hook | `features/<x>/components/` | Client Component; ESLint already keeps `components/` away from `server.ts`, `queries.ts`, `lib/dal`, `lib/data` |
| Where the provider is mounted | `app/` page or route layout | `app/` composes; features stay route-agnostic. Render providers as deep as possible (`DOCS/01-getting-started/05-server-and-client-components.md`, "Context providers") |
| Server or request values for the store | Fetched in `queries.ts`, passed as `initState` props | The store never fetches |
| Actions that write to the backend | `actions.ts` (Server Actions), not store actions | Store actions only change client state |
| State shared by two features | Compose in `app/` | ESLint forbids cross-feature imports |
| Store in `packages/` | No | Extract only under the conditions in [project-structure.md §6](project-structure.md#6-monorepo-package-extraction-when-to-extract-to-packages) |

---

## 3. Creating a store

Zustand's guide for Next.js recommends a **store per provider**, built with `createStore` from `zustand/vanilla`, shared
through React context, created once with `useState`, with a hook that throws outside the provider
(`ZDOCS/learn/guides/nextjs`, `ZDOCS/learn/guides/initialize-state-with-props`):

```ts
// features/<x>/store.ts
import { createStore } from "zustand/vanilla"

export type CounterState = { count: number }
export type CounterActions = { increment: () => void; reset: () => void }
export type CounterStore = CounterState & CounterActions

export const defaultInitState: CounterState = { count: 0 }

export const createCounterStore = (initState: CounterState = defaultInitState) =>
  createStore<CounterStore>()((set, _get, store) => ({
    ...initState,
    increment: () => set((state) => ({ count: state.count + 1 })),
    reset: () => set(store.getInitialState()),
  }))

export type CounterStoreApi = ReturnType<typeof createCounterStore>
```

```tsx
// features/<x>/components/counter-store-provider.tsx
"use client"

import { createContext, use, useState } from "react"
import { useStore } from "zustand"

import { createCounterStore, type CounterState, type CounterStore, type CounterStoreApi } from "../store"

const CounterStoreContext = createContext<CounterStoreApi | null>(null)

export function CounterStoreProvider({ children, initState }: { children: React.ReactNode; initState?: CounterState }) {
  const [store] = useState(() => createCounterStore(initState))
  return <CounterStoreContext value={store}>{children}</CounterStoreContext>
}

export function useCounterStore<T>(selector: (state: CounterStore) => T): T {
  const store = use(CounterStoreContext)
  if (!store) throw new Error("useCounterStore must be used within CounterStoreProvider")
  return useStore(store, selector)
}
```

```tsx
// features/<x>/components/counter.tsx
"use client"
import { useCounterStore } from "./counter-store-provider"

export function Counter() {
  const count = useCounterStore((s) => s.count)
  const increment = useCounterStore((s) => s.increment)
  return <button onClick={increment}>{count}</button>
}
```

```tsx
// app/(dashboard)/<route>/page.tsx   composition only
export default function Page() {
  return (
    <CounterStoreProvider initState={{ count: 5 }}>
      <Counter />
    </CounterStoreProvider>
  )
}
```

Notes on this shape:

- `<Ctx value={...}>` and `use(Ctx)` are the React 19 forms used across this repo ([project-structure.md §3.2](project-structure.md#32-component-composition--scaling-rules)); the Zustand pages use `Ctx.Provider` and `useContext`, which are equivalent.
- The official Next.js example has two slips not to copy: `CounterStore = CounterState | CounterActions` (a union; it must be `&`) and consumers that read the whole state with `(state) => state`. The `initialize-state-with-props` example action `set((state) => ({ bears: ++state.bears }))` mutates state; use `state.bears + 1`.
- **Request-derived initial state** (cookie, header, session) works with Cache Components: resolve it in an async Server Component under `<Suspense>` and pass it down (verified: cookies `42` and `7` rendered in the server HTML; the route is partial-prerender):

```tsx
async function Init() {
  const value = (await cookies()).get("example")?.value
  return (
    <CounterStoreProvider initState={{ count: Number(value ?? 0) }}>
      <Counter />
    </CounterStoreProvider>
  )
}

export default function Page() {
  return <Suspense fallback={<p>loading</p>}><Init /></Suspense>
}
```

Rules from the Zustand API (`ZDOCS/reference/apis/create`, `create-store`, `learn/guides/updating-state`, `immutable-state-and-merging`, `maps-and-sets-usage`, `practice-with-no-store-actions`, `how-to-reset-state`):

- Write `createStore<T>()(...)` (curried) so the state type is annotated and the rest inferred.
- `set`, `get` and `store` must not be called while the creator runs; use them inside actions.
- `set` shallow-merges one level; copy nested objects, or use `immer`. `set(next, true)` replaces the whole state and drops actions.
- Never mutate state. Arrays: `map`, `filter`, `slice`, `concat`, spread. `Map` and `Set` must be recreated, not mutated.
- Colocate actions inside the store (the documented default). `reset` is `set(store.getInitialState())`.
- Keep derived values out of the store; compute them in selectors.

---

## 4. Reading state: selectors

Zustand re-renders a component only when the selected value changes by `Object.is`.

| Selector | Result |
|---|---|
| `(s) => s.count`, one call per value | Correct; re-renders only on that value |
| `useShallow((s) => ({ a: s.a, b: s.b }))` from `zustand/react/shallow` | Correct for object or array results |
| `(s) => s` | Works; re-renders on every change |
| `(s) => ({ a: s.a, b: s.b })` or `(s) => s.x ?? (() => {})` | **Crashes in v5**: `The result of getServerSnapshot should be cached` and `Maximum update depth exceeded` (verified; server render and `next build` pass, the page fails on the client) |

`create` no longer accepts an equality function in v5; use `useShallow`, or `createWithEqualityFn` / `useStoreWithEqualityFn`
from `zustand/traditional` (needs the `use-sync-external-store` package) (`ZDOCS/reference/migrations/migrating-to-v5`).
`zustand/shallow` and `zustand/react/shallow` both export `useShallow` in 5.0.15 (verified); use `zustand/react/shallow`.

---

## 5. Next.js specifics

### 5.1 Never a module-level store

A store defined with `create()` at module level is shared by every request the server handles. Verified: a client component
that incremented such a store while rendering on the server, on a request-time route, returned `global:4`, `5`, `6` on three
consecutive requests; a store created per provider returned `provider:6` every time. Zustand's guide therefore says
not to define global stores, and not to read or write the store from Server Components.

The maintainers' discussion (`pmndrs/zustand#2740`, which the guide's banner links to) narrows the risk to stores the server
**writes** to, and says context-free use works if the server never writes, but is not recommended; context is still needed to
isolate a store to a page or route. This repository keeps the provider pattern because it accepts server or request values as
`initState`, can be keyed or reset, and cannot leak between requests.

### 5.2 Server Components cannot use the hook

Calling the hook from a Server Component fails: `Attempted to call useXStore() from the server but useXStore is on the client`.
Verified: 500 in dev and a failed `next build` at prerender. ESLint does not catch it. Pass data down as props instead.

### 5.3 State outlives navigation

With Cache Components Next.js preserves up to 3 routes with `<Activity>`; `useState` values and DOM state are not reset when
you leave and come back (`DOCS/02-guides/preserving-ui-state.md`, `DOCS/02-guides/migrating-to-cache-components.md`, "UI state
preservation"). Verified with a store provider (dev server, visible-element selectors):

| Setup | Observation |
|---|---|
| Provider in a shared route layout | One store for all child routes: `2` on A, `2` on B, `3` after B +1, `3` back on A |
| Provider inside each page | A=`2`, B starts `0`, B +1 = `1`; link back to A shows `2`, browser Back to B shows `1` |
| Provider inside each page, wrapped in `<Fragment key={useRouter().bfcacheId}>` | Link back to A shows `0` (reset on a fresh push); browser Back to B restores `1` |

So a page-level store is **not** reset by leaving the route. If it must start fresh, the preserving-ui-state guide and
`DOCS/03-api-reference/04-functions/use-router.md` (`bfcacheId`) recommend, in order: reset explicitly in an event handler;
derive a key from your data (a draft id); `bfcacheId` as a last resort (it resets on push and replace and restores on back and
forward).

```tsx
"use client"
import { Fragment } from "react"
import { useRouter } from "next/navigation"

export function ResetOnPush({ children }: { children: React.ReactNode }) {
  const { bfcacheId } = useRouter()
  return <Fragment key={bfcacheId}>{children}</Fragment>
}
```

State also survives authentication changes. For logout use a full reload (`window.location.href`) or key the subtree by user id
(`<Provider key={userId}>`). A store that holds user-scoped data must be keyed by user id, and a persisted store's `name`
should include it. Hidden routes stay in the DOM with `display: none`, so end-to-end selectors must be visibility-aware.

### 5.4 Hydration

SSR and hydration need the same output on server and client; common causes of mismatch are `typeof window` checks and
browser-only APIs in render, and different data on each side (`ZDOCS/learn/guides/ssr-and-hydration`, which is plain React
SSR and contains no Zustand API). Reading through `useStore` is hydration-safe by construction: it passes
`getInitialState()` as the server snapshot, which React also uses while hydrating (`zustand/esm/react.mjs`). Reading
`store.getState()` during render bypasses that; do not.

---

## 6. Middleware

Order and form (`ZDOCS/learn/guides/advanced-typescript`, `slices-pattern`):

```ts
createStore<Store>()(
  devtools(
    persist(
      immer((set, _get, store) => ({ /* state + actions */ })),
      { name: "feature-x", version: 1, partialize: (s) => ({ /* persisted fields */ }) },
    ),
    { name: "feature-x" },
  ),
)
```

- Apply middleware **only on the combined store**, never inside a slice; put `devtools` outermost.
- Write the chain **inline** in `create`/`createStore`. Verified: extracting the `immer(...)` creator into a variable loses the devtools mutator (`TS2554` on `set(fn, undefined, "name")`).
- Slices are typed `StateCreator<All, Mutators, [], Slice>`; with all three middlewares the mutators are `[["zustand/devtools", never], ["zustand/persist", unknown], ["zustand/immer", never]]` (verified: type-checks and cross-slice `get().addBear()` works).

### 6.1 `persist`

`ZDOCS/reference/middlewares/persist`, `ZDOCS/reference/integrations/persisting-store-data`. Default storage is JSON over
`localStorage`, resolved lazily so it does not throw during SSR. With a synchronous storage the store hydrates at creation; with
an asynchronous one, later in a microtask. In v5 the initial state is not written to storage on creation.

Verified (dev with full React messages, and production build), with `localStorage` holding `7` while the server HTML had `5`:

| Case | Result |
|---|---|
| Default hydration | No hydration error; UI goes `5` then `7` |
| `skipHydration: true` + `store.persist.rehydrate()` in the provider's effect | No hydration error; same result |
| Deliberate mismatch (`typeof window` in render) | React error #418, so the check detects mismatches |
| Asynchronous storage (400 ms `getItem`) | `count=5, hasHydrated()=false`, then `count=7, hasHydrated()=true` |
| `version: 2` + `migrate` from stored `{"x":9}` at version 0 | `count=9`; storage rewritten at version 2 |
| Version mismatch, no `migrate` | Stored state ignored (`5`); console error `State loaded from storage couldn't be migrated since no migrate function was provided`; old entry stays until the next write |
| Zod-validating `PersistStorage`, corrupt entry | Rejected, store keeps initial state; corrupt entry stays until the next write |
| `merge: (p, c) => ({ ...c, ...p, count: c.count })` | Server `count` kept, persisted nested value kept |
| `storage` event listener calling `rehydrate()` | Another tab's write updated this tab without reload |
| `partialize` | Only chosen fields written, as `{"state":{...},"version":1}`; `reset()` writes the initial state back |

The wrapper hook in the Zustand docs ("Usage in Next.js") was not needed: `useStore` already hydrates from `getInitialState()`.
Consequences: the persisted value overrides server `initState` after hydration unless `merge` says otherwise. The default JSON
storage does no runtime validation (`ZDOCS` recommends a validating `PersistStorage`, for example with Zod).

### 6.2 `devtools`

Redux DevTools is a browser extension that Zustand's `devtools` middleware connects to; the store does not use Redux. In
`zustand@5.0.15` the middleware only reads `window.__REDUX_DEVTOOLS_EXTENSION__`, so it works without the extension and without
installing `@redux-devtools/extension` (verified). Verified with a mock extension: dev calls `connect({ name })` and sends
`set(fn, undefined, "feature/increment")` under that name (unnamed updates are `anonymous`); in a production build it makes no
connection, because it is off by default there. React StrictMode in dev creates the store twice, so it connects twice.
It is optional: leave it out if you do not use the extension.

### 6.3 `immer`

Install `immer` as a direct dependency (`ZDOCS/reference/integrations/immer-middleware`). Nested mutation inside `set` updated UI
and storage correctly (verified). `Map` and `Set` drafts need `enableMapSet()` from Immer; class instances need
`[immerable] = true`, otherwise Immer mutates without a proxy and Zustand skips subscriber calls (the Map/Set behavior was
verified in tests and comes from Immer, not Zustand's pages).

---

## 7. Testing

Test the factory, not a global store. Each test creates its own store (`createXStore(init)`), so no global reset mock is needed
(the `__mocks__/zustand` reset in `ZDOCS/learn/guides/testing` exists for global stores). Verified in this repository's Vitest
(`environment: "node"`, no jsdom, no Testing Library; 8 tests):

- Store logic: actions, immer nested updates, `reset()` returning to the props-based initial state, isolation between two instances.
- Server render: `renderToString(<Provider initState={...}><Consumer /></Provider>)` shows the props-based state, shows the **initial** state (not the persisted one) when a synchronous `persist` store hydrates at creation, and throws `useXStore must be used within XStoreProvider` outside the provider.
- TSX needs one line in `apps/web/vitest.config.ts`, because `tsconfig` uses `jsx: "preserve"`: add `oxc: { jsx: { runtime: "automatic" } }` inside `defineConfig`.

DOM interaction tests need extra dependencies (jsdom, Testing Library) that the repository does not have.

---

## 8. Anti-patterns

| Do not | Do instead |
|---|---|
| `export const useXStore = create(...)` at module level, written on the server | Factory + provider (section 3) |
| Call the store hook in a Server Component | Pass props; stores are client-only |
| Mirror server data or URL params into a store | Server Components / search params |
| Store page-local state just to survive navigation | `useState`; Cache Components preserves it |
| Assume a page-level provider resets when you leave the route | Explicit reset, data-derived key, or `bfcacheId` key (5.3) |
| Keep user-scoped state without a user key | `key={userId}`, full reload on logout, user id in the persist `name` |
| Selector returning a fresh object, array or function | One selector per value, or `useShallow` |
| Mutate state outside immer; `set(next, true)` to change one field | New object via `set`; `set({ field })` |
| Extract the `immer(...)` creator into a variable; put middleware inside slices; `immer(devtools(...))` | Inline chain on the combined store, `devtools` outermost |
| Default `persist` storage for untrusted or evolving data | Zod `PersistStorage`, `version` + `migrate` |
| Import another feature's store | Compose in `app/` |
| Mount the provider in the root layout "just in case" | Lowest common ancestor |

---

## 9. Checklist

- [ ] A store is justified: client-only, shared by distant client components, not server data, not URL state, not page-local.
- [ ] `features/<x>/store.ts` exports a factory; no module-level `create()` store; no `"use client"` or server imports in it.
- [ ] The provider creates the store once with `useState(() => createXStore(initState))`; the hook throws outside the provider.
- [ ] The provider is mounted from `app/` as deep as possible; server or request values arrive as `initState` props.
- [ ] No Server Component reads the store.
- [ ] Every read uses a selector per value or `useShallow`; no selector returns a new object, array or function.
- [ ] State is updated through `set` without mutation; middleware is inline on the combined store with `devtools` outermost.
- [ ] Page-level stores have an explicit reset plan, and user-scoped stores are keyed by user id.
- [ ] `persist`, if used: validated storage, `version` + `migrate`, `partialize`, a decision on `merge`, user id in `name`.
- [ ] Tests create a fresh store per test; server render covered with `renderToString`.

---

## 10. Sources and verification

**Zustand docs read in full** (docs source on `main` of the Zustand repository): learn (`introduction`, `comparison`, and the
guides `nextjs`, `ssr-and-hydration`, `initialize-state-with-props`, `slices-pattern`, `advanced-typescript`,
`beginner-typescript`, `updating-state`, `immutable-state-and-merging`, `maps-and-sets-usage`, `how-to-reset-state`,
`auto-generating-selectors`, `prevent-rerenders-with-use-shallow`, `flux-inspired-practice`, `practice-with-no-store-actions`,
`event-handler-in-pre-react-18`, `connect-to-state-with-url-hash`); reference (`persist`, `use-shallow`, `use-store`,
`use-store-with-equality-fn`, `create-store`, `create-with-equality-fn`, `shallow`, `combine`, `subscribe-with-selector`,
`redux`, `immer`, `migrating-to-v5`, and the integrations `persisting-store-data`, `immer-middleware`,
`third-party-libraries`); discussion `pmndrs/zustand#2740`; the published `zustand@5.0.15` package (exports, peer dependencies,
`esm/react.mjs`, the `devtools` source). Repeated demo code blocks were read folded; prose and signatures in full.
Read only through a summarizing fetcher: `tutorial-tic-tac-toe`, reference `create` and `devtools` (beyond its first 140 lines),
`testing` (setup and context-store tests read verbatim).
**Next.js docs read:** `02-guides/preserving-ui-state`, `02-guides/migrating-to-cache-components` ("UI state preservation"),
`03-api-reference/04-functions/use-router` (`bfcacheId`), `01-getting-started/05-server-and-client-components`.

**Verification.** Experiments ran in an isolated git worktree with `zustand@5.0.15` and `immer`, since removed; the base
template contains none of this code. They covered: lint, typecheck and `next build`; dev server and production runs in a
browser; a six-request server leak probe; the Server Component misuse; request-derived `initState`; navigation with three
provider placements; selector rules; every `persist` case in 6.1; `devtools` with a mock extension, in dev and in production;
immer, store, server-render and slice tests in Vitest.

**Not verified:**

- A real Redux DevTools extension attached (only a mock was used).
- Eviction of the oldest route beyond 3 preserved routes (stated by the Next.js docs).
- Keying a provider by user id across this repository's real sign-out flow (`lib/auth`).
- DOM interaction tests (no jsdom or Testing Library in the repository).
- Third-party articles: a member-only Medium post (opening only) and a Reddit thread could not be read in full, so they are not used. The maintainers' discussion above covers the same SSR and hydration topic.
- A long-running `next dev` server in the working checkout once returned 500 on newly added routes while a fresh dev server and a production build of the same code worked; four attempts to reproduce it failed. If it happens, restart `next dev`.
