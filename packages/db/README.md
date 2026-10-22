# @workspace/db

Supabase client, errors, generated types and the `supabase/` CLI directory (migrations, pgTAP tests, seed) used by `apps/web`.

| Script (`pnpm --filter @workspace/db …`) | What it does                                                                                     |
| :--------------------------------------- | :----------------------------------------------------------------------------------------------- |
| `exec supabase migration new <name>`     | New migration in `supabase/migrations` (never hand-name the file)                                |
| `db:test -- --dry`                       | Runs every pgTAP file with unpushed migrations prepended, inside one transaction that rolls back |
| `db:push`                                | Applies new migrations to the linked project                                                     |
| `db:test`                                | Runs the pgTAP files against the linked project (each rolls back)                                |
| `db:types`                               | Regenerates `src/database.types.ts`; run after every pushed migration                            |
| `exec supabase db advisors --linked`     | Security and performance lints                                                                   |

Exports: `./env` (validated public Supabase env), `./server` (`createDataClient(accessToken, { fetch? })`, `unwrap`;
server-only), `./errors` (`DataError`, `unwrap`, helpers), `./types` (generated `Database`).

`supabase test db --linked` needs Docker for `pg_prove`; `scripts/test-db.mjs` runs the same files through
`supabase db query` instead. Each test file is `begin; … rollback;`, collects TAP lines in a temp table `tap_out`
and ends by selecting them as one `tap` column, because the Management API returns only the last result set.
