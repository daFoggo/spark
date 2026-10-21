# Project Structure & Boundary Rules

## 1. When to Use
Use when creating new files, adding pages/features, structuring components, or deciding whether to extract code into a shared package.

---

## 2. Where Does Code Live?

| File / Artifact | Location | Responsibility |
| :--- | :--- | :--- |
| **New Page / Route** | `apps/web/app/**/page.tsx` | Routing & composition only. Awaits zero data at top level. Calls `queries.ts`. |
| **Page-Only UI** | `apps/web/app/**/_components/` | Sub-components used exclusively on that single page (Next.js ignores `_` folders). |
| **Domain Feature** | `apps/web/features/<name>/` | Vertical domain slice (UI, queries, actions, schemas). Route-agnostic. |
| **Cross-Feature UI (Generic)** | `packages/ui/src/components/` | Primitive shadcn/ui components (`@workspace/ui`). Generic, no business logic. |
| **Cross-Feature UI (App-Shared)**| `apps/web/components/shared/` | Presentational UI used across features (empty-state, confirm-dialog). Pure props only. |
| **Cross-Feature UI (Domain)** | `features/<owner>/components/` | Owned by primary feature; compose in `app/` via props/slots (never cross-import). |
| **App Shell / Layout** | `apps/web/components/layout/` | Global Header, Sidebar, Nav, Shell. |
| **Global Providers** | `apps/web/components/providers/` | `ThemeProvider`, `Toaster`, client context providers. |
| **App Infrastructure** | `apps/web/lib/` | `dal.ts`, `env.ts`, `http.ts`, `errors.ts`, `utils.ts`. |

---

## 3. Feature Anatomy (`features/<name>/`)

Only create files that are needed:
- `components/`: UI components for this domain. Receives data via props.
- `server.ts`: `import "server-only"`. The only backend calls; parses DTOs with Zod. Spark: FastAPI via `apiFetch`.
  A Supabase project calls `createDataClient(accessToken)` here. A repo that keeps both stacks makes `server.ts` pick
  `server.api.ts` or `server.supabase.ts` by `AUTH_PROVIDER`, typed `typeof api` so both keep the same functions.
  Never call a backend outside these files ([providers.md](../../../../docs/providers.md)).
- `queries.ts`: Reads for Server Components. Calls `verifySession()` from DAL + `server.ts`. Manages `"use cache"`.
- `actions.ts`: `"use server"`. Validates with Zod, checks auth via DAL, mutates via `server.ts`, calls `updateTag()`.
- `schemas.ts`: Zod schemas & TypeScript types. Safe for client & server.
- `__tests__/`: Colocated feature tests.

---

## 4. Boundary Rules (Hard-Enforced in ESLint)

- ❌ **Features never import `app/`**: Features are route-agnostic.
- ❌ **No cross-feature imports**: `features/A` never imports `features/B`. Compose them together in `app/`.
- ❌ **Client components never import server code**: `features/*/components/` and `components/` never import `server.ts`, `queries.ts`, `@/lib/dal`, `@/lib/http`, or `@/lib/auth`.
- ❌ **No barrel files (`index.ts`)**: Always deep-import (e.g. `@/features/auth/components/sign-in-form`).

---

## 5. Composition Rules (Vercel Guidelines)
- **No Boolean Prop Proliferation**: Avoid `isCompact`, `isAdmin`, `showExtra`. Use Compound Components (`Table.Row`) or Explicit Variants (`<CompactTable>`).
- **Children over Render Props**: Use `children` for visual composition; reserve render props only for returning item-level data.
- **React 19 Native**: `ref` is a standard prop (no `forwardRef`), use `use(Context)` instead of `useContext()`.

---

## 6. Monorepo Packaging Rule

Keep features in `apps/web/features/`. Extract to `packages/<name>` **ONLY** if:
1. There are **2+ real apps** consuming the code (e.g. `web` and `mobile` or `admin`).
2. Code runs on a **different runtime** (Cloudflare Worker, CLI binary, browser extension).
3. Code is an **independent publishing unit** (public npm package / SDK).
4. Code is **zero-business-logic infrastructure** (`@workspace/ui`, config packages).

*Never extract packages for folder aesthetics, speculative future needs (YAGNI), or build speed.*

---

## 7. Source of Truth (Deep Dive)
- Full architectural design & empirical monorepo analysis: [docs/project-structure.md](../../../../docs/project-structure.md)
- ESLint boundaries configuration: [apps/web/eslint.config.js](../../../../apps/web/eslint.config.js)
