# Contributing

## Setup

- Node: see `.nvmrc`. Package manager: pnpm, pinned via `packageManager` in `package.json`.
- `pnpm install`, then `pnpm dev`.

## Conventions

- Run tasks through `turbo run <task>` (root scripts already do); use `--filter=<name>` for one package.
- Install a dependency in the package that uses it (`pnpm add x --filter web`); the root only holds repo tooling (`turbo`, `prettier`).
- Internal deps use `workspace:*`. Shared code goes in `packages/`, never in an app.
- Packages expose entrypoints via `exports`; avoid barrel `index.ts` files.
- No root `tsconfig.json`; each package extends `@workspace/typescript-config`.
- Env files live in each app (`apps/web/.env*`), not the root. Env vars that affect
  builds must be declared in `turbo.json` (`env`/`globalEnv`); `NEXT_PUBLIC_*` is inferred for Next.js.
- App code is feature-based: see `apps/web/features/README.md`. `app/` only composes features; feature boundaries are enforced by ESLint (warnings fail `pnpm lint` via `--max-warnings 0`).
- Extract code into `packages/` only when a second consumer exists, it has a different deploy target, it is published, or it is infrastructure without business logic (`@workspace/auth`, `@workspace/db`: ready for a second app); otherwise keep it in the app. See `docs/project-structure.md` §6.
- Database: migrations, pgTAP tests and seed live in `packages/db/supabase`; use `pnpm --filter @workspace/db db:push|db:types|db:test`.
- Before pushing: `pnpm check`.

## Tests, commits, CI

- Unit tests use Vitest (`pnpm test`, or `pnpm turbo run test --filter=@workspace/ui`).
- Commit messages follow Conventional Commits, enforced by commitlint via a husky `commit-msg` hook.
- CI runs `lint typecheck test build` with `--affected` on a full-history checkout.
- Only pnpm is allowed (`only-allow` in `preinstall`).
