# Target architecture: FastAPI + PostgreSQL + Docker

Conventions every backend agent follows. Decisions referenced as `D#` are in [README §4](README.md#4-decisions).
Sources: FastAPI "Bigger Applications" (https://fastapi.tiangolo.com/tutorial/bigger-applications/), "Dependencies with
yield", "Lifespan Events", "Generating SDKs"; OpenAPI 3.2 (https://swagger.io/specification/v3.2/); openapi-ts.dev.
Library versions are pinned when Phase 1 starts; re-read the docs of the pinned versions, not your memory.

## 1. Principles

1. **Same behaviour, new home.** The FastAPI endpoint for an operation behaves like today's `server.ts` + Postgres
   RPC/trigger/RLS combined. The module file lists every behaviour; tests prove each one.
2. **Contract first.** `docs/goals-habits/openapi.yaml` is the contract (D8). A route that is not in the contract is not
   added without adding it there in the same PR.
3. **Vertical slices, mirrored.** One Python package per `apps/web/features/<name>` that has data (settings, goals,
   habits, activities, tasks, reviews). Names match so a reader can jump between the two.
4. **The user is implicit.** No endpoint takes a `userId`; the user comes from the JWT (`CurrentUser`). Every query is
   scoped by it (D6).
5. **Thin routers, rule-bearing services, dumb repositories.** Routers parse/serialize; services enforce spec rules
   (comments carry rule IDs like the SQL did); repositories hold SQL only.

## 2. Layout (`apps/api`)

Adapted from the FastAPI "Bigger Applications" layout (`app/main.py`, `app/dependencies.py`, `app/routers/*`,
`app/internal/*`), grouped by domain instead of by technical type:

```
apps/api/
├── package.json              # turbo bridge: "lint": "uv run ruff check . && uv run ruff format --check .",
│                             # "typecheck": "uv run pyright", "test": "uv run pytest", "dev": "uv run fastapi dev app/main.py --port 8000"
├── pyproject.toml / uv.lock  # Python 3.13, deps pinned (D14)
├── alembic.ini
├── Dockerfile
├── .env.example
├── app/
│   ├── __init__.py
│   ├── main.py               # create_app(): FastAPI(lifespan=…, generate_unique_id_function=…), handlers, include_router(prefix="/v1")
│   ├── dependencies.py       # shared Annotated deps: DbSession, CurrentUser, Today
│   ├── core/
│   │   ├── config.py         # Settings (pydantic-settings): ENV, DATABASE_URL, AUTH_JWKS_URL, AUTH_ISSUER, AUTH_AUDIENCE, ALLOWED_HOSTS
│   │   ├── db.py             # async engine (asyncpg), async_sessionmaker, get_db (yield; commit on success, rollback on error)
│   │   ├── security.py       # JWT verification (PyJWKClient, EdDSA), CurrentUser
│   │   ├── errors.py         # ProblemDetail model, RuleViolation(rule, detail), NotFound, handlers (D10)
│   │   ├── clock.py          # Clock protocol (now()), today_for(settings) → date in user tz (D11)
│   │   └── schema.py         # CamelModel base: alias_generator=to_camel, populate_by_name, from_attributes
│   ├── db/
│   │   ├── base.py           # DeclarativeBase + MetaData(naming_convention=…)
│   │   └── auth_tables.py    # read-only Table() of auth."user" for the FK only
│   └── modules/
│       ├── settings/   { __init__.py, router.py, schemas.py, service.py, repository.py, models.py }
│       ├── goals/      { … }   # goals + checkpoints
│       ├── habits/     { … }   # habits + habit_schedules + check-ins (activities rows with source='habit')
│       ├── activities/ { … }   # activities table owner, logs, stats, goal activity
│       ├── tasks/      { … }
│       └── reviews/    { … }
├── migrations/               # Alembic env.py (async) + versions/
├── scripts/
│   ├── export_openapi.py     # writes openapi.json for the contract diff
│   └── seed.py               # demo user + prototype dataset (parity checks)
└── tests/
    ├── conftest.py           # db, client, token_for, frozen_today, make_user
    ├── test_contract.py      # app.openapi() vs docs/goals-habits/openapi.yaml
    ├── test_security.py
    └── modules/<name>/test_*.py
```

Rules for the layout:

- `router.py`: `router = APIRouter(prefix="/habits", tags=["habits"])`; `main.py` does
  `app.include_router(habits.router, prefix="/v1")`. Import submodules (`from app.modules.habits import router as
  habits_router`) so names do not clash (FastAPI docs note on importing `router`).
- Route function **name = contract operationId** (`async def listHabits` is not PEP 8; use `list_habits` and set
  `name="listHabits"` or `operation_id="listHabits"` explicitly). `generate_unique_id_function=lambda r: r.name` keeps
  operationIds clean. Every route declares `response_model`, `status_code`, `responses` (404/422) like the contract.
- A module may import another module's **`service`** (never its repository or models) for cross-module writes, inside
  the same `AsyncSession` (one transaction per request). Allowed edges, matching README §5: `habits → activities`
  (check-in rows), `tasks → activities`, `reviews → habits, tasks`, everything → `settings` (timezone, week start).
  The `activities` table model lives in `activities/models.py`; `habits` writes check-in rows through
  `activities.service` functions designed for that.
- `models.py` uses SQLAlchemy 2 typed mappings; table and column names stay exactly as today (snake_case, `public`).

## 3. Request lifecycle

```
HTTP → main.py handlers → router (path/query/body → Pydantic, camelCase aliases)
      → Depends: CurrentUser (JWT) · DbSession (one transaction) · Today (user's local date, lazy)
      → service (rules, ownership, locks) → repository (SQLAlchemy Core/ORM, always `where user_id = :uid`)
      → commit on success / rollback on exception → response_model (by_alias=True) or 204
```

- `get_db` is a `yield` dependency: `async with sessionmaker() as s, s.begin(): yield s`. Exceptions must propagate
  (FastAPI docs: swallowing them turns into a silent 500).
- `Today` dependency: reads `user_settings.timezone` once per request and returns
  `clock.now().astimezone(ZoneInfo(tz)).date()`. If the settings row is missing, raise 500 (it cannot happen after D12;
  today's SQL silently returned NULL, see `modules/settings.md`).
- Lifespan: create the engine and the `PyJWKClient` on startup, dispose on shutdown. No `on_event`.

## 4. Errors (D10)

All error bodies are `application/problem+json`:

```json
{ "type": "about:blank", "title": "Unprocessable Content", "status": 422, "detail": "only the last 3 days can be changed", "rule": "AC-5" }
```

| Situation | Status | Body | Replaces today |
| :--- | :--- | :--- | :--- |
| Spec rule refused (`P0001 'XX-n: …'`) | 422 | `detail` = message without prefix, `rule` = `XX-n` | `DataError` with `expected` |
| Constraint violation that the user caused (23505 unique, 23514 check, 23503 FK) | 422 (409 for duplicates if the contract says so) | `detail` + `rule` when one applies | `DataError` with `expected` |
| Resource not found **or owned by someone else** | 404 | `detail: "Not found"` | RLS empty result / `PGRST116` / `42501` |
| Request body/query invalid | 422 | `detail` (first error message) + `errors: [{ loc, msg }]` | Zod in actions (actions still validate first) |
| Missing/invalid/expired token | 401 | `detail` | Supabase JWT rejected |
| Anything else | 500 | generic `detail`, full error in the log only | thrown `Error` |

Frontend side (`lib/http.ts`, `lib/errors.ts`): `ApiError` already carries `status`, `detail` as message and `body`.
Add `rule` to `ApiError` (`body.rule`), and replace each module's `expected()` helper (`DataError` + prefix strip) by
`isExpectedApiError(error) ? error.message : null` — the message text the user sees must be identical to today's
(stripped of the `XX-n:` prefix in habits/goals/tasks/activities/reviews; note that settings today shows the raw message
**with** the prefix; keep or fix deliberately, record it in `modules/settings.md`).

## 5. Database

- PostgreSQL 17, one database, schemas: `auth` (Better Auth, D3), `public` (domain). The `private` schema and every
  PL/pgSQL function that used `auth.uid()` are not recreated (D5, D6). Keep: `set_updated_at` trigger (or SQLAlchemy
  `onupdate`, pick one and use it everywhere), timezone validation (Python `zoneinfo.available_timezones()` or keep the
  `pg_timezone_names` trigger; must reject the same names), the `auth."user"` → `user_settings` trigger (D12).
- Alembic revision 0001 reproduces the **final** Supabase schema (after all 9 migrations, chapters dropped), not the
  history. Verify by diffing `pg_dump --schema-only` of both databases for schema `public` (columns, types, defaults,
  CHECKs, indexes, FKs); every difference is intended and listed in the module file.
- FKs `user_id → auth."user"(id) on delete cascade`, type `uuid` (D4).
- Constraint naming convention in `MetaData` so Alembic autogenerate is stable.
- Connection: SQLAlchemy async engine (`postgresql+asyncpg://`), pool size from settings; app role owns no superuser
  rights; a separate migration role runs Alembic in the `migrate` container.
- Concurrency: rules that compare against other rows (AC-2 one check-in per day, GL-3 max 3 active goals, slug unique
  per user, `move_checkpoint` positions) must hold under two parallel requests. Use the DB constraint where one exists
  (AC-2 partial unique index, `unique(user_id, slug)`), otherwise lock the parent row (`select … for update` on
  `user_settings` for per-user counters). Each module file says which.

## 6. OpenAPI (D8)

- FastAPI emits OpenAPI 3.1.0 (`app.openapi_version`). Keep it. 3.2 adds `$self`, the `query` method,
  `additionalOperations`, streaming `itemSchema`, `in: querystring`, … — none is needed here, and `openapi-typescript`
  (7.x) supports only 3.0/3.1. Revisit when both support 3.2; record it in the contract's `info.description`.
- Contract diff in CI (`tests/test_contract.py` or `oasdiff`): same paths, methods, operationIds, status codes,
  required fields, property names and types. Pydantic can emit `anyOf: [{…}, {type: null}]` where the contract has
  `oneOf`; normalize nullable forms before comparing instead of changing the contract.
- `separate_input_output_schemas` stays default; name request models like the contract (`HabitCreate`, `HabitPatch`,
  `TaskCreate`, …) so component names match.
- The frontend keeps generating `lib/api/schema.d.ts` from `openapi.yaml` (`pnpm --filter web gen:api`); its
  `contract.test.ts` files keep checking Zod DTOs against the same file. Contract changes land in the YAML first.

## 7. Tests

| Layer | Tool | What | Required per module |
| :--- | :--- | :--- | :--- |
| Service rules | pytest | Every rule ID of the module, happy + refusal path; boundaries (dates −3/−4/+1, 3/4 active goals, 280/281 chars) | Yes |
| HTTP | pytest + `httpx.AsyncClient(transport=ASGITransport(app))` | Every operation: status, body shape (camelCase), problem details, 401 without token, 404 for another user's id | Yes |
| Ported pgTAP | pytest | Each assertion of `apps/web/supabase/tests/<module>.test.sql` has a named pytest | Yes |
| Concurrency | pytest with two sessions | Rules in §5 "Concurrency" | Where listed |
| Contract | `test_contract.py` | Implemented operations match `openapi.yaml` | Yes |
| Frontend unit | vitest | Existing tests still pass; `server.ts` mapping tested against a mocked `fetch` if mapping is non-trivial | If mapping changed |
| Parity | manual + script | Module checklist §"Parity" against the same seed on both stacks | Yes |

Fixtures (`tests/conftest.py`): Postgres from the compose `db` service (or testcontainers), Alembic `upgrade head` once
per session, a SAVEPOINT-wrapped transaction per test; `make_user(timezone="Asia/Ho_Chi_Minh", week_start=1)` inserting
into `auth."user"` (the trigger creates settings); `token_for(user)` signing an EdDSA JWT with a test key served by a
fake JWKS (override `get_jwks_client`); `frozen_now(...)` overriding the clock dependency.

Seed: port `apps/web/supabase/seed.sql` to `apps/api/scripts/seed.py` (demo user `demo@spark.test` created through Better
Auth's sign-up API or with a Better Auth-compatible scrypt hash, same dataset) so both stacks can show the same data
for parity checks.

## 8. Docker and deployment (two services, two domains)

Production (Q4): `web` at `https://app.<domain>`, `api` at `https://api.<domain>`, each its own container/service with
its own TLS, scaling and deploy pipeline; one managed PostgreSQL reachable from both. The browser talks only to `web`
(D15); `web` calls `api` over HTTPS server-to-server.

| Concern | `web` (`apps/web`) | `api` (`apps/api`) |
| :--- | :--- | :--- |
| Public URL | `BETTER_AUTH_URL` = `NEXT_PUBLIC_APP_URL` = `https://app.<domain>` | `https://api.<domain>` |
| Talks to | `api` (`API_BASE_URL=https://api.<domain>/v1/`), Postgres schema `auth` | Postgres schema `public`, `web`'s JWKS (`https://app.<domain>/api/auth/jwks`) |
| DB role | `spark_auth` (rights on schema `auth` only) | `spark_app` (rights on `public`, `select` on `auth."user"` for the FK) |
| Secrets | `BETTER_AUTH_SECRET`, `DATABASE_URL`, Google | `DATABASE_URL` |
| Migrations | none (Alembic owns them, D3) | `alembic upgrade head` as a release step with `spark_migrate`, **before** either service starts the new version |

Internet-facing API hardening (README P1.10), since `api.<domain>` is public even though only `web` calls it:

- Every `/v1/*` route requires the JWT (`aud` = API URL); only `/healthz` is anonymous and returns no details.
- `docs_url`, `redoc_url`, `openapi_url` disabled when `ENV=production` (contract export uses `scripts/export_openapi.py`).
- `TrustedHostMiddleware(allowed_hosts=[api.<domain>])`; uvicorn `--proxy-headers --forwarded-allow-ips=<edge>` only.
- No CORS middleware (no browser caller). If a browser client is ever added, that is a new decision.
- Request body limit at the edge (e.g. 1 MB); per-IP rate limit at the edge or middleware; JSON-only content types.
- Optional defence in depth: restrict `api` ingress to `web`'s egress IPs / private network when the platform allows.
- Latency: deploy both in the same region; `apiFetch` reuses connections (Node `fetch` keep-alive). Measure a page with
  Server-Timing before/after the migration and record it in the module parity notes.

Local `compose.yaml` at the repo root (one network, mirrors production URLs with service names):

| Service | Image / build | Notes |
| :--- | :--- | :--- |
| `db` | `postgres:17` | volume `pgdata`; healthcheck `pg_isready`; init script creates roles `spark_auth`, `spark_app`, `spark_migrate` |
| `migrate` | `apps/api` image, command `alembic upgrade head` | `depends_on: db (healthy)`; exits 0; runs as `spark_migrate` |
| `api` | `apps/api/Dockerfile` | `uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers`; `depends_on: migrate (completed_successfully)`; publishes 8000 |
| `web` | `apps/web/Dockerfile` (Next `output: "standalone"`) | `API_BASE_URL=http://api:8000/v1/`, `DATABASE_URL`, `BETTER_AUTH_URL=http://localhost:3000`, `API_AUDIENCE=http://localhost:8000`; publishes 3000 |

- In compose, `api` uses `AUTH_JWKS_URL=http://web:3000/api/auth/jwks` (fetch URL) while `AUTH_ISSUER` /
  `AUTH_AUDIENCE` stay the URLs the token carries (`http://localhost:3000`, `http://localhost:8000`).
- `apps/api/Dockerfile`: multi-stage with `uv` (`uv sync --frozen --no-dev` in a builder, copy `.venv` into a slim
  runtime), non-root user, `HEALTHCHECK` on `/healthz`.
- `apps/web/Dockerfile`: `turbo prune web --docker` then `next build` with the same build-time env as production
  (CSP is computed at build time, see `authentication.md` §8), run `node server.js`.
- Each Dockerfile builds from the repo root context but produces an image that runs alone (no shared volume, no
  compose-only assumptions), so the two services deploy independently.
- Dev: `docker compose up db` and run `web`/`api` on the host (`pnpm dev`), or the whole stack.
  `.claude/launch.json` gets `api` (`pnpm --filter api dev`, port 8000).
