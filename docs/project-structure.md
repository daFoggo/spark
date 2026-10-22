# Project Structure and Monorepo Architecture

Comprehensive architectural guide for **next-mono-base** running on **Next.js 16.4.0** and **Turborepo**.
This document defines how code is organized across the monorepo, the feature-based layout inside `apps/web`, boundary rules enforced by ESLint, and strict criteria for extracting shared packages.

---

## 1. Core Architectural Principles

1. **Vertical Slices (Feature-Based)**: Code is organized by business domain (`features/<name>/`), not by technical type (no top-level `controllers/`, `services/`, or `views/`). A feature owns its UI, queries, mutations, validation, and types.
2. **`app/` is Routing & Composition Only**: Pages and layouts contain zero business logic and zero direct database/backend calls. They authenticate, invoke feature queries, assemble feature components, and pass down data via props.
3. **Route-Agnostic Features**: Features know nothing about URLs, route params, or Next.js route structures. This allows feature components to be reused across pages, dialogs, or embedded panes without changes.
4. **RSC-First & Explicit Server/Client Boundaries**: Data reading happens in async Server Components; data writing happens in Server Actions. Any file touching external data sources or secrets is marked `import "server-only"`.
5. **Enforced by ESLint, Not Good Intentions**: Architectural boundaries (e.g. features cannot import other features or `app/`, client components cannot import server code) are hard-enforced in `apps/web/eslint.config.js` and fail CI via `eslint --max-warnings 0`.

---

## 2. Directory Layout

```
next-mono-base/
├── apps/
│   └── web/                                # The primary Next.js 16.4 application
│       ├── app/                            # Routing & composition only (page.tsx, layout.tsx)
│       │   ├── (auth)/                     # Route group: sign-in, sign-up
│       │   ├── (dashboard)/                # Route group: authenticated application shell
│       │   │   └── dashboard/
│       │   │       └── page.tsx            # Protected dashboard home
│       │   ├── api/                        # Route Handlers (webhooks, external integrations)
│       │   ├── error.tsx                   # Route error boundary
│       │   ├── global-error.tsx            # Root layout fatal error boundary
│       │   ├── not-found.tsx               # 404 handler
│       │   ├── robots.ts                   # Programmatic SEO robots.txt
│       │   ├── sitemap.ts                  # Programmatic XML sitemap
│       │   └── layout.tsx                  # Root HTML shell
│       ├── features/                       # Vertical business domain slices
│       │   ├── auth/                       # Authentication reference feature (forms, actions, schemas)
│       │   └── <domain>/                   # Custom business domains (e.g. billing, workspace, etc.)
│       ├── components/                     # App-wide UI (shell, navigation, providers)
│       │   ├── layout/                     # App sidebar, header, global nav
│       │   └── providers/                  # ThemeProvider, Toaster, etc.
│       ├── lib/                            # Application-level infrastructure (Server-only / DAL)
│       │   ├── auth.ts                     # Binds @workspace/auth to config/auth.ts (AUTH_OPTIONS)
│       │   ├── dal.ts                      # Data Access Layer (verifySession, getSession)
│       │   ├── data.ts                     # createDataClient over @workspace/db/server (+ 401 hook)
│       │   ├── errors.ts                   # DataError helpers
│       │   └── utils.ts                    # General helpers
│       ├── config/                         # Static site metadata, navigation items, constants
│       ├── hooks/                          # App-wide reusable React hooks (client-only)
│       ├── proxy.ts                        # Optimistic session check & token refresh (runs in middleware)
│       ├── next.config.ts                  # Cache Components & Partial Prefetching flags
│       └── eslint.config.js                # Boundary enforcement rules
├── packages/
│   ├── ui/                                 # Primitive shadcn/ui components (@workspace/ui)
│   ├── auth/                               # Auth adapters: Supabase, Better Auth (@workspace/auth)
│   ├── db/                                 # Supabase client, errors, types, migrations/tests/seed (@workspace/db)
│   ├── eslint-config/                      # Shared ESLint flat configurations
│   └── typescript-config/                  # Shared tsconfig base files
├── docs/                                   # Single Source of Truth architecture documentation
├── turbo.json                              # Turborepo task pipeline
└── package.json                            # Monorepo root (pnpm workspace)
```

### Why No `src/` Directory in `apps/web`?
- **Matches shadcn/ui Standard**: Scaffolding with `components.json` directly targets `@/components`, `@/lib`, and `@/hooks`.
- **Flatter Navigation**: Avoids redundant nesting (`apps/web/src/app/...` vs `apps/web/app/...`).
- **Path Mapping**: `@/*` in `tsconfig.json` maps cleanly to `./*`.

---

## 3. Anatomy of a Feature (`features/<name>/`)

Every feature folder represents an isolated business domain slice:

```
features/<name>/
├── components/         # UI components (Client or Server) specific to this domain
│   ├── <name>-table.tsx
│   └── <name>-filters.tsx
├── server.ts           # [server-only] The only data I/O (Supabase via lib/data); DTOs via Zod
├── queries.ts          # Reads for Server Components; verifies session via DAL; "use cache"
├── actions.ts          # [use server] Mutations; validates input; checks auth; calls updateTag()
├── schemas.ts          # Zod schemas & TypeScript types; safe for both client and server
└── __tests__/          # Colocated unit and integration tests
```

> [!IMPORTANT]
> **Create only the files a feature actually needs.**
> A simple feature may only contain `components/` and `schemas.ts`. Do not scaffold empty `server.ts` or `actions.ts` files if the feature does not perform backend I/O or mutations.

### File Responsibilities

| File | Directive | Allowed Imports | Forbidden Imports | Primary Responsibility |
| :--- | :--- | :--- | :--- | :--- |
| `server.ts` | `import "server-only"` | `lib/data`, `@workspace/db/*`, Zod | `lib/dal`, `next/headers`, `cookies()`, `app/` | Pure I/O. Does not know about user sessions or request caches. Returns typed DTOs. |
| `queries.ts` | None / `"use cache"` | `lib/dal`, `./server`, `./schemas` | `app/`, other features | Data reader for Server Components. Calls `verifySession()`, invokes `server.ts`, manages cache lifetimes. |
| `actions.ts` | `"use server"` | `lib/dal`, `./server`, `./schemas`, `next/cache` | `app/`, other features | Form/action mutations. Calls `verifySession()`, validates with Zod, writes via `server.ts`, calls `updateTag()`. |
| `schemas.ts` | None | `zod` | Any server-only module | Single Source of Truth for domain models, form input schemas, and inferred TypeScript types. |
| `components/` | None or `"use client"`| `@workspace/ui`, `./schemas`, `actions.ts` | `server.ts`, `queries.ts`, `lib/dal`, `lib/data` | Presentational and interactive UI. Receives query data via props or un-awaited promises. |

---

### 3.1 Component Scopes & Placement Strategy

When creating a new component, choose its location based on **reusability scope** and **domain ownership**:

| Scope | Location | When to Use | Example |
| :--- | :--- | :--- | :--- |
| **Page-Local** | `app/**/_components/` | Used on **only one page** or route. Next.js ignores `_` folders from routing. | `app/(dashboard)/<name>/_components/<name>-hero.tsx` |
| **Feature-Domain** | `features/<name>/components/` | Used across **multiple pages within the same feature/domain**. | `features/auth/components/sign-in-form.tsx` |
| **App-Wide Shell** | `components/layout/` | App shell, navigation, global header, sidebar. | `components/layout/sidebar.tsx` |
| **App-Wide Shared** | `components/shared/` | Reusable across **multiple features**, but specific to `apps/web` (pure presentational UI). | `components/shared/empty-state.tsx`, `components/shared/confirm-dialog.tsx` |
| **Primitive UI** | `packages/ui/src/components/` | Generic, **zero-business-logic** primitives from shadcn/ui. | `@workspace/ui/components/button` |

#### How to Share UI Across Features Without Violating ESLint (`features/A` cannot import `features/B`)

When Feature A needs to render a component owned by Feature B (for example, a `DataTable` in Feature A needs to display an `AuthorBadge` from Feature B):

1. **Composition via Slots / Children in `app/**/page.tsx` (Recommended)**:
   Keep features completely decoupled. Let the page compose them together:
   ```tsx
   // apps/web/app/(dashboard)/projects/page.tsx
   import { ProjectTable } from "@/features/projects/components/project-table"
   import { UserAvatar } from "@/features/users/components/user-avatar"

   export default async function Page() {
     const projects = await getProjects()
     return (
       <ProjectTable
         rows={projects.map((project) => ({
           ...project,
           // Pre-rendered slot: a ReactNode crosses Server -> Client, a function prop does not
           owner: <UserAvatar name={project.owner.name} image={project.owner.avatarUrl} />,
         }))}
       />
     )
   }
   ```
2. **Promote to `apps/web/components/shared/` (If Ubiquitous)**:
   If a component is a pure presentational UI element used everywhere (e.g. `UserAvatar` or `StatusBadge`), place it in `apps/web/components/shared/`.
   *Requirement*: It must only accept pure props and must **never** import `server.ts`, `queries.ts`, `@/lib/dal`, or `@/lib/data`.

---

### 3.2 Component Composition & Scaling Rules

Composition rules (avoid boolean props, compound components, explicit variants, state behind a context interface) come
from the vendored `vercel-composition-patterns` skill. Read it through [vercel-skills.md](vercel-skills.md), which lists
the Spark overrides. The two that matter here:

- **Compound components use flat prefixed exports**, not object namespaces: `CasesTableFrame`, `CasesTableHeader`,
  `CasesTableRow` (never `CasesTable.Frame`). A namespace object is not a valid client reference across the RSC boundary.
- **Slots are `ReactNode` props or `children`, not render props**, whenever a Server Component passes UI into a Client
  Component. A render prop is fine only inside one Client Component, or when the parent must hand item data back to the
  child.

React 19 defaults apply as usual: `ref` is a plain prop (no `forwardRef`) and `use(Context)` replaces `useContext()`.
Server data reaches Client Components as props or an un-awaited promise read with `use()`; context holds client state only.

---

## 4. Dependency Direction & ESLint Boundary Enforcement

### Layer Hierarchy

```mermaid
flowchart TD
    App["app/ (Routing & Composition)"]
    Features["features/* (Domain Slices)"]
    Components["components/ (App Shell & Layout)"]
    Lib["lib/ (DAL, data client, auth binding)"]
    UI["@workspace/ui (Primitive UI)"]

    App --> Features
    App --> Components
    App --> UI
    Features --> Lib
    Features --> UI
    Components --> UI

    classDef allowed fill:#e1f5fe,stroke:#0288d1,stroke-width:2px;
    classDef boundary fill:#ffebee,stroke:#d32f2f,stroke-width:2px;
    class App,Features,Components,Lib,UI allowed;
```

### Boundary Rules Enforced in `apps/web/eslint.config.js`

1. **Features Never Import `app/`**:
   - `features/**` must never import from `@/app/**`.
   - *Reason*: Features are route-agnostic and reusable.
2. **No Cross-Feature Imports**:
   - `features/A` must never import from `features/B` or `@/features/**`.
   - *Reason*: Prevents circular dependencies and spaghetti coupling between domains. If two features need to interact on screen, compose them together in `app/**/page.tsx`.
3. **Feature Components Never Import Server-Only Modules**:
   - `features/*/components/**` cannot import `server.ts`, `queries.ts`, `@/lib/dal`, `@/lib/data`, or `@/lib/auth`.
   - *Reason*: Protects client component bundles from leaking server secrets or failing compilation.
4. **Shared Components Never Import Server-Only Modules**:
   - `components/**` cannot import `@/lib/dal`, `@/lib/data`, `@/lib/auth`, or `@workspace/db/server` / `@workspace/auth/{server,config,better-auth-handler}`.
   - *Reason*: Shell components (`layout/`, `providers/`) are frequently Client Components or render across auth boundaries.
5. **No Barrel Files (`index.ts`)**:
   - Always deep-import the exact file needed:
     ```ts
     // CORRECT:
     import { CasesTable } from "@/features/cases/components/cases-table"

     // FORBIDDEN:
     import { CasesTable } from "@/features/cases"
     ```
   - *Reason*: Barrel files break Turbopack tree-shaking, slow down HMR compilation, and accidentally expose server exports to client bundles.

---

## 5. Data Flow & State Management

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Page as app/.../page.tsx (RSC)
    participant Queries as features/queries.ts
    participant DAL as lib/dal.ts
    participant Server as features/server.ts
    participant Component as features/components (Client)
    participant Action as features/actions.ts

    Note over User,Page: 1. Read Flow
    User->>Page: Navigate to route
    Page->>Queries: getItems(params)
    Queries->>DAL: verifySession()
    DAL-->>Queries: session (userId, role)
    Queries->>Server: fetchItemsFromBackend(userId, params)
    Server-->>Queries: DTO list
    Queries-->>Page: items
    Page->>Component: <ItemTable list={items} />

    Note over User,Action: 2. Write Flow (Mutation)
    User->>Component: Submit mutation
    Component->>Action: updateItemAction(formData)
    Action->>Action: ZodSchema.safeParse(formData)
    Action->>DAL: verifySession()
    Action->>Server: updateItemInBackend(id, data)
    Action->>Action: updateTag(`item:${id}`)
    Action-->>Component: { success: true }
    Component->>User: Toast notification & optimistic update
```

### Client State Rules
- **URL First**: Filter state, search queries, pagination, and active tabs live in URL `searchParams`. Do not duplicate URL state into React state or client stores.
- **Component State**: Transient UI state (menu open/close, active hover, input focus) lives in standard React `useState`.
- **Global Client Store (Zustand)**: Only introduce a store if complex client-only state cannot be represented in the URL or component tree (e.g. multi-step canvas editor, audio player). Place the store factory inside `features/<name>/store.ts`; stores are created per provider, never as module-level globals. Full pattern, API notes and anti-patterns: [client-state.md](client-state.md).

---

## 6. Monorepo Package Extraction: When to Extract to `packages/`

A major failure mode in Turborepo projects is **premature package extraction** (extracting features into `packages/feature-*` before there is any concrete consumer).

### Empirical Analysis of Production Monorepos

| Monorepo | Approach | Key Takeaway |
| :--- | :--- | :--- |
| **Dub.co** | Single web app + tiny shared utility packages | Features live in `apps/web`. Packages are reserved for cross-app infrastructure (`@dub/ui`, `@dub/tinybird`, `@dub/prisma`). |
| **Cal.com** | Heavy package separation (`@calcom/features/*`) | Necessary because they support Web, Mobile, Desktop, and Embed apps. High overhead: hundreds of `package.json` files and complex build graph. |
| **Documenso** | `apps/web` + domain packages | Separated early; now consolidating because cross-package boundary refactoring increased PR friction. |
| **Next-Forge** | Unified feature structure | Recommends keeping features inside `apps/web` until a second app is created. |

### The 4 Valid Conditions to Extract a Package

Extract code into `packages/<name>` **ONLY** when at least one of these 4 conditions is met:

1. **Multiple Real Consumers (2+ Apps)**:
   - Example: Both `apps/web` and `apps/mobile` (or `apps/admin`) need the exact same business schemas or client API.
2. **Different Runtime or Deployment Target**:
   - Example: A background worker running on Node.js/Cloudflare Workers (`apps/worker`), or a Chrome extension requiring isolated bundling.
3. **Independent Release / Publishing Unit**:
   - Example: A public SDK or npm package shipped to third parties.
4. **Zero-Business-Logic Infrastructure**:
   - Example: Design system components (`packages/ui`), ESLint configs (`packages/eslint-config`), TypeScript configs (`packages/typescript-config`).
   - In this repo: `packages/auth` and `packages/db`. Honest justification: they are **infrastructure without business
     logic** (auth adapters, the Supabase client, `unwrap`/`DataError`, migrations, generated types; Spark's rules stay in
     `features/` and in the SQL of the migrations) and they are **ready for a second app** (the same shape as the reference
     repo `noi-that-khanh-linh`, where `apps/web` and `apps/admin` both consume them). Today `apps/web` is the only
     consumer, so condition 1 is not met yet; the split is a deliberate bet on that second app, not a rule that other
     code may follow. Business code (`features/`) is never extracted on this basis. They are Just-in-Time packages:
     TypeScript source behind `exports`, compiled by each app's Turbopack, relative imports inside the package (no
     `@/`), no tsconfig `paths`.

### Anti-Patterns: When NOT to Extract a Package

> [!CAUTION]
> **DO NOT extract a package for any of the following reasons:**
> 1. **"To keep folders tidy"**: Code isolation is already achieved via `features/<name>/` and enforced by ESLint.
> 2. **"Speculative future needs" (YAGNI)**: "We might build a React Native mobile app someday." Wait until the mobile project is actually initialized.
> 3. **"To speed up builds"**: Turborepo caches tasks per workspace. Splitting into many small packages increases TypeScript project reference resolution overhead, package linking, and pnpm lockfile complexity.

---

## 7. Decision Matrix: Where Does My Code Live?

| Question | Correct Location |
| :--- | :--- |
| Where do I put a new page or route? | `apps/web/app/(group)/<route>/page.tsx` |
| Where do I put page-specific UI only used on that one page? | `apps/web/app/(group)/<route>/_components/` |
| Where do I put domain-specific UI, queries, or actions? | `apps/web/features/<name>/` |
| Where do I put the App Header, Sidebar, or Global Nav? | `apps/web/components/layout/` |
| Where do I put app-wide providers (Theme, Toaster)? | `apps/web/components/providers/` |
| Where do I put the data client wrapper, auth binding, or DAL? | `apps/web/lib/` |
| Where do I put migrations, RLS tests, seed, generated DB types? | `packages/db/supabase`, `packages/db/src` |
| Where do I put auth provider adapters? | `packages/auth/src` (bound per app in `config/auth.ts` + `lib/auth.ts`) |
| Where do I put primitive UI components (Button, Dialog, Input)? | `packages/ui/src/components/` |
| Where do I put shared Zod schemas if needed by 2+ apps? | `packages/<name>/src/schemas.ts` (Only when 2nd app exists) |
