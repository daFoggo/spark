<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Monorepo conventions

- pnpm workspace + Turborepo. `apps/*` are runnable, `packages/*` are shared (`@workspace/*`). Do not nest packages.
- Run tasks via `pnpm turbo run <task> [--filter=<pkg>]`; verify with `pnpm check` and `pnpm build`.
- Dependencies go in the package that uses them; root holds only repo tooling. No root `tsconfig.json`.
- Turbopack compiles workspace packages automatically; do not add `transpilePackages` for them.
- Import workspace packages through their `exports` (e.g. `@workspace/ui/components/button`); do not add tsconfig `paths` for them.
- Cache Components (`cacheComponents` + `partialPrefetching`) are enabled in `apps/web/next.config.ts`. Wrap runtime APIs (`cookies()`, `headers()`, `params`, `searchParams`) in `<Suspense>`; use `"use cache"` + `cacheLife` for cached data.
- See `CONTRIBUTING.md` for details.

# Read the doc before changing the area

The docs in `docs/` are the single source of truth for `apps/web`. Open the matching one first:

| Working on | Read |
| :--- | :--- |
| Folder layout, feature slices, ESLint boundaries, extracting `packages/` | `docs/project-structure.md` (summary: `apps/web/features/README.md`) |
| Data fetching, caching, mutations, Server Actions | `docs/data-fetching.md` |
| Routes, layouts, parallel and intercepting routes | `docs/routing-and-layouts.md` |
| Client-only shared state (Zustand) | `docs/client-state.md` |
| Auth, sessions, DAL (`AUTH_PROVIDER=supabase\|better-auth`, adapters in `packages/auth`; env template `apps/web/.env.example`) | `docs/authentication.md` |
| Supabase (default) vs the Better Auth foundation, `packages/auth` / `packages/db`, schema workflow, provider seams, latency | `docs/providers.md` |
| Performance, code splitting, lazy loading, Core Web Vitals | `docs/performance-optimization.md` |
| Redis cache, large uploads, SSE, telemetry, instant-navigation tests | `docs/advanced-patterns.md` |
| UI: theme tokens, typography, spacing, responsive, shadcn component sizes, motion | `docs/design-system.md` |
| Goals, habits, activities, tasks, reviews, pet: rules, schema, flows, delivery checklist | `docs/goals-habits/spec.md`, `docs/goals-habits/roadmap.md` |
| Applying a Vercel skill (`vercel-react-best-practices`, `vercel-composition-patterns`, `vercel-react-view-transitions`, `web-design-guidelines`) | `docs/vercel-skills.md` (Spark overrides; project docs win on conflict) |

For a fast decision (which pattern applies) use the skill `.agents/skills/next-mono-base/SKILL.md`; it links back to the docs above.
For any className, layout or theme work use `.agents/skills/spark-design-system/SKILL.md` (no arbitrary Tailwind values; component sizes via props).
`.claude/skills/` is a copy of `.agents/skills/` (Claude Code reads it): change a skill in both, then check with `diff -rq --strip-trailing-cr .agents/skills .claude/skills`.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
