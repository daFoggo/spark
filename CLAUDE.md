@AGENTS.md

# Working guidelines

Adapted from the four principles in [andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills)
(MIT) and tuned for this repo. They favor caution over speed; for trivial edits (typos, renames) use judgment.

## 1. Think before coding
- State assumptions. If a request has several readings, surface them instead of silently picking one.
- If a simpler approach exists, say so. If something is unclear, stop and ask.
- Unknown schema/auth contract? Read `packages/db/supabase/migrations`, the generated types (`@workspace/db/types`) or the docs first; do not guess tables or columns.
- Next.js in this repo is not the version you remember: read `node_modules/next/dist/docs/` before writing Next code (see AGENTS.md).

## 2. Simplicity first
- Write the minimum code that solves the request. No unrequested features, no single-use abstractions, no speculative config.
- Create only the feature files a feature needs (`features/README.md`). Do not extract to `packages/` without a second consumer.
- No error handling for cases that cannot happen; do handle the ones that can (a failed request throws, it never becomes `[]`).

## 3. Surgical changes
- Touch only what the request needs. Match existing style; do not reformat or refactor neighbours.
- Remove imports/functions that *your* change orphaned; only mention unrelated dead code.
- Respect the boundaries enforced by ESLint (`app/` composes, `features/` do not import each other or `app/`).

## 4. Goal-driven execution
- Turn the task into a verifiable goal and a short plan with a check per step.
- "Done" means `pnpm check` and `pnpm build` pass; UI/auth changes are also exercised against a running app.
- Report what was and was not verified. Never claim a flow works if only its error path was tried.

## Git
- Conventional Commits (commitlint enforces it). Do not add co-author or "generated with" lines to commits or PRs.
- Commit or push only when asked.
