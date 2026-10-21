# Module playbook: migrating one feature from Supabase to FastAPI

The procedure every module agent follows. It is written so that nothing is skipped: each step produces an artifact
(a filled table in `modules/<module>.md`, tests, code) and a check. Do the steps in order; do not start step 5 before
steps 1–4 are written down.

Inputs: [README](README.md) (decisions D1–D14), [target-architecture.md](target-architecture.md),
[auth-better-auth.md](auth-better-auth.md) §5/§7, `modules/<module>.md` (baseline inventory), the module's rules in
[`goals-habits/spec.md`](../goals-habits/spec.md), the module's operations in
[`goals-habits/openapi.yaml`](../goals-habits/openapi.yaml).

Skills: `next-mono-base` (frontend seam), `supabase-postgres-best-practices` (schema, indexes, locks; still valid for
plain Postgres), `engineering:testing-strategy`, `code-review` before the PR.

---

## Step 1. Re-inventory from code (the baseline may be wrong)

The module file was written from a read of the code on 2026-10-21. Re-derive it; do not trust it.

Run these and reconcile every hit with the tables in the module file (add missing rows, mark wrong rows):

```bash
grep -nE '^export (async )?function' apps/web/features/<m>/{actions,queries,server}.ts
grep -nE '\.rpc\(|\.from\("' apps/web/features/<m>/server.ts
grep -rnE 'features/<m>/(actions|queries|components|rules|stats|rows|schemas)' apps/web/app apps/web/components apps/web/features
grep -nE 'updateTag|cacheTag|cacheLife' apps/web/features/<m>/*.ts
grep -nE 'raise exception|create (or replace )?(function|trigger|policy|unique index|index)|grant (insert|update)|check \(' apps/web/supabase/migrations/*.sql
grep -nE '<module operationIds…>' docs/goals-habits/openapi.yaml
```

Fill / correct in the module file:

- **A. Operations table** — one row per `server.ts` function: caller(s) in `queries.ts`/`actions.ts`, Supabase call
  (table + filters + order + limit, or RPC + args), DTO returned, contract operationId, HTTP method + path.
- **B. Actions table** — one row per action: input schema + constraints, rule IDs, `server.ts` calls (in order),
  `updateTag` list, return shape on success and on expected failure, what is rethrown.
- **C. Queries table** — `cacheLife`, `cacheTag`, arguments that form the cache key.
- **D. DB logic table** — every constraint, default, trigger, RPC step, RLS policy and column grant that touches the
  module's tables, with the exact error code/message it raises.
- **E. Consumers** — every page/component importing the module (needed for the UI parity pass).
- **F. Tests today** — vitest and pgTAP, assertion by assertion.

Check: every exported function, every SQL object and every pgTAP assertion of the module appears in exactly one row.

## Step 2. Behaviour list (what "same" means)

Turn tables A–D into a numbered list of behaviours `B1…Bn` in the module file. One behaviour = one observable outcome
for one input class. Include, for each operation:

- happy path (exact response body, field by field, ordering of lists, null vs absent);
- every rule refusal (rule ID, message text after the action strips the prefix);
- not found / another user's id (today: RLS hides it → empty, null, `PGRST116` or `42501`; after: 404);
- implicit DB behaviour: defaults (`starts_on = today`, `created_on = today`, `status = someday` when 3 active),
  computed fields (`today` in the user's timezone), side effects on other tables (activity rows, `goal_id` snapshot,
  `focus_from`), idempotency (`log_task` twice → one activity), cascades (`on delete set null/cascade`);
- edge cases the code reveals (no settings row → `today_for` NULL; unordered embeds; missing limits).

Mark each behaviour **Keep** (must match), **Fix** (today's behaviour is a bug; new behaviour described, user-visible
change noted) or **Drop** (only with a reason). Fixes need a line in the PR description.

Check: every row of table D maps to at least one behaviour; every behaviour has a test name planned (step 6).

## Step 3. Contract reconciliation

Compare the behaviour list with `openapi.yaml` for the module's operations and **edit the YAML first**:

- request bodies contain every field the app sends (and only those); constraints match the Zod form schemas;
- responses list every status the endpoint can return (200/201/204, 401, 404, 422 problem details per D10);
- list ordering and nullability are stated in descriptions;
- operations that today are implicit (e.g. resume = `pausedUntil = yesterday`) are either kept as a PATCH semantic and
  described, or get their own operation (decide, record).

Then `pnpm --filter web gen:api` and make the module's `contract.test.ts` pass (Zod DTOs unchanged unless a Fix says so).

Check: `git diff docs/goals-habits/openapi.yaml` reviewed against the behaviour list; contract tests green.

## Step 4. Mapping to FastAPI (design, written before code)

Fill the "Mapping" table of the module file: for each operation → `router.py` function (name = operationId),
request/response Pydantic models, `service.py` function(s), `repository.py` queries, transaction and lock needs,
cross-module service calls, error mapping (which `RuleViolation(rule=…)` / `NotFound` each refusal raises).

Fill the "Rule placement" table: for each DB rule of table D → where it lives now (DB constraint kept as-is / Python
service / dropped because D6 replaces it) and how concurrency is handled (target-architecture §5).

Schema: write the module's part of the Alembic revision (tables, constraints, indexes exactly as the final Supabase
schema; `user_id` FK to `auth."user"`). `pg_dump --schema-only` diff of the module's tables between the Supabase local
DB and the new DB is empty except the intended differences (no RLS, no grants, no `auth.uid()` defaults, no RPCs,
no PL/pgSQL triggers replaced by services) — list those differences in the module file.

Check: a reviewer can implement the module from the Mapping table alone.

## Step 5. Implement the backend

- `models.py`, `schemas.py` (CamelModel), `repository.py` (every query has `where user_id = :uid`), `service.py`
  (rule IDs in comments, same order of checks as the SQL so the same error wins when several apply), `router.py`.
- Register the router in `main.py`. Add the Alembic revision.
- No endpoint, field or rule that is not in the behaviour list.

Check: `pnpm --filter api lint typecheck` clean.

## Step 6. Backend tests

Write tests named after behaviours (`test_B7_checkin_older_than_3_days_is_refused_AC5`):

- one test per behaviour `B1…Bn` (service or HTTP level);
- per endpoint: 401 without token, 401 with an expired/forged token, 404 for another user's resource, problem details
  shape on 422;
- every pgTAP assertion of the module ported (keep a mapping table "pgTAP line → pytest name" in the module file);
- concurrency tests where the Rule placement table says a lock or constraint guards a rule;
- timezone edge: a user in `Pacific/Kiritimati` (UTC+14) and one in `Pacific/Honolulu` (UTC−10) around local midnight,
  for every behaviour that uses "today".

Check: `pnpm --filter api test` green; contract test green for the module's operations.

## Step 7. Switch the frontend seam

In `apps/web/features/<m>/server.ts`, add the `apiFetch` implementation **beside** the Supabase one, selected by
`authConfig.AUTH_PROVIDER` (D13). Keep every exported signature identical:

```ts
export async function fetchHabits(accessToken: string): Promise<Habit[]> {
  if (authConfig.AUTH_PROVIDER !== "better-auth") return fetchHabitsSupabase(accessToken)
  return z.array(HabitSchema).parse(await apiFetch<unknown>("habits", { token: accessToken }))
}
```

- Paths are relative to `API_BASE_URL` (`…/v1/`), no leading slash (`lib/url.ts`).
- Parse every response with the existing Zod DTO; the response is already camelCase.
- Replace the action-side `expected()` helpers: `ApiError` 4xx → `{ error: message }` with the same user-visible text
  (target-architecture §4). Keep `DataError` handling for the Supabase branch until Phase 9.
- Do not change `queries.ts` cache directives, tags, or `actions.ts` return shapes.
- 404 handling: where `server.ts` returned `null` (e.g. `fetchHabit`, `fetchGoal`, `fetchReview`), map `ApiError` 404 to
  `null`; elsewhere let it throw unless the behaviour list says otherwise.

Check: `pnpm check` and `pnpm build` pass with `AUTH_PROVIDER=supabase` (unchanged app) and with `better-auth`.

## Step 8. Parity verification (before vs after)

Run both stacks on the same data (Supabase local with `seed.sql`; Docker stack with `scripts/seed.py`), same browser
timezone, same frozen date if possible:

1. **Data parity** — for every read operation, call the old `server.ts` branch and the new one with the demo user and
   diff the JSON (a throwaway script under `apps/web/scripts/parity/` or a vitest file excluded from CI). Lists must be
   equal including order.
2. **Write parity** — run each action's scenarios from the behaviour list on both stacks; compare the resulting reads.
3. **UI parity** — open every consumer page from table E on both stacks (desktop and 375 px); the same numbers,
   labels, empty states, error messages, optimistic updates and cache refresh after a write.
4. Tick the module's **Parity checklist**. Anything not equal is either fixed or recorded as an intended Fix.

## Step 9. Integration and hand-off

- Cross-module rows: run the scenarios of the modules that read or write this module's tables (module file
  "Integration" section), on the Docker stack.
- Update `modules/<m>.md` (all tables final, checklist ticked, open questions answered), `openapi.yaml`, and the
  README phase checklist.
- PR: Conventional Commit title `feat(api): migrate <m> to FastAPI`; description lists behaviours kept/fixed/dropped,
  what was verified and what was not. Run `/code-review` first.

## Templates (copy into the module file)

### Mapping

| operationId | Method + path | Request model | Response | Service fn | Repository | Tx / lock | Cross-module | Errors |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |

### Rule placement

| Rule / DB object | Today | After | Concurrency | Test |
| :--- | :--- | :--- | :--- | :--- |

### pgTAP → pytest

| pgTAP file:line | Assertion | pytest |
| :--- | :--- | :--- |

### Parity checklist (per module, each item ticked with how it was checked)

- [ ] Every row of tables A–D has a behaviour; every behaviour has a passing test.
- [ ] Contract: YAML updated, `gen:api` run, vitest contract test + backend contract test green.
- [ ] Schema diff of the module's tables shows only the listed intended differences.
- [ ] Data parity: each read operation returns equal JSON on both stacks (seed data).
- [ ] Write parity: each action scenario leads to equal reads on both stacks.
- [ ] Error parity: each refusal shows the same text in the UI; unexpected errors reach `error.tsx`.
- [ ] Ownership: another user's ids → 404 on every endpoint (tests).
- [ ] Auth: 401 paths tested; a backend 401 ends the session without a loop.
- [ ] Cache: same tags invalidated; the page refreshes after each write.
- [ ] Timezone edges tested for every "today" behaviour.
- [ ] UI parity on every consumer page (desktop + 375 px, light + dark).
- [ ] `pnpm check`, `pnpm build`, backend tests green; PR lists verified / not verified.
