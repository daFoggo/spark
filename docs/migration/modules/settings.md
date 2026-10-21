# Module: settings (Phase 3)

Baseline inventory from reading the code on 2026-10-21. **Re-verify in playbook step 1.** Paths relative to `apps/web/`.
Spec rules: TM-1…TM-5, PT-1.

## A. Operations (`features/settings/server.ts`)

| Function | Supabase call | DTO | operationId | After |
| :--- | :--- | :--- | :--- | :--- |
| `fetchSettings(token)` (L10) | `user_settings` select `timezone, timezone_confirmed, week_start, pet_name, adopted_on`, `.single()`, no filter (RLS) | `SettingsSchema` | `getSettings` | `GET settings` |
| `saveSettings(token, patch)` (L26) | `update` of given keys; `.not("user_id","is",null).select("user_id").single()` (PostgREST needs a filter) | void | `updateSettings` | `PATCH settings` → 204 |

## B. Actions (`actions.ts`)

| Action | Input | Calls | Tags | Returns | Errors |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `syncLocaleAction({timezone, weekStart})` (L15) | `DetectedLocaleSchema` (tz 1–64, weekStart int 0–6) | `saveSettings` + `timezoneConfirmed: true` | `settingsTag` | `{saved}` / `{error:"Invalid locale"}` | expected `DataError` → raw message **with** `TM-2:` prefix (L32) |
| `updateSettingsAction(prev, formData)` (L40) | `UpdateSettingsSchema` (tz 1–64, weekStart coerce 0–6, petName trim 1–20) | `saveSettings` + `timezoneConfirmed: true` | `settingsTag` | `{saved}` / `{error}` | same (L61). **Not imported anywhere** (no settings form yet) |

## C. Queries

`getSettings()` — `"use cache: private"`, `cacheLife({stale:300, revalidate:300, expire:3600})`, `cacheTag(settingsTag(userId))`.

## D. DB logic (`supabase/migrations/20261019163857_user_settings.sql`)

| Object | Behaviour |
| :--- | :--- |
| `user_settings` | PK `user_id` FK `auth.users` cascade; `timezone` default `'UTC'`; `timezone_confirmed` default false; `week_start` default 1 check 0–6; `pet_name` default `'Mochi'` check 1–20; `adopted_on date default current_date` (DB date, not user tz) |
| `validate_timezone` trigger | rejects names not in `pg_timezone_names` → `P0001 'TM-2: unknown timezone %'` |
| `handle_new_user` trigger on `auth.users` | inserts the settings row (`on conflict do nothing`) — becomes D12 trigger on `auth."user"` |
| grants | select; update only `timezone, timezone_confirmed, week_start, pet_name` (`adopted_on` immutable, no insert/delete) |
| RLS | select/update own |
| `private.today_for(user)` | `(now() at time zone s.timezone)::date`; **NULL when no settings row** → used by every module → becomes `core/clock.py` + `Today` dependency |
| `set_updated_at` | shared trigger |

## E. Consumers

`getSettings`: `app/(dashboard)/_components/{timezone-gate,session-nav,dashboard-data}.tsx/ts`, `dashboard/page.tsx`,
`dashboard/{tasks,habits,habits/[habitId],review,goals,goals/[goalId]}/page.tsx`. `TimezoneSync` (calls
`syncLocaleAction` once) mounted by `timezone-gate.tsx` when `!timezoneConfirmed`.

## F. Tests today

- vitest `__tests__/contract.test.ts` (Settings keys).
- pgTAP `supabase/tests/user_settings.test.sql` (8): row per account; own row only; rename pet; unknown tz → P0001; valid tz
  saved; `adopted_on` immutable (42501); delete denied (42501); (re-read file for the 8th).

## Findings to decide (step 2)

1. `updateSettingsAction`: `z.coerce.number()` on a missing `weekStart` → 0 (Sunday) silently. Fix when the form is built.
2. Settings errors keep the `TM-2:` prefix; other modules strip it. Decide: strip (consistent) — a Fix.
3. `adopted_on` uses the DB date, not the user's timezone; the D12 trigger runs before the timezone is synced, so
   "today in user tz" is not available at sign-up anyway. Keep `current_date` (UTC in Docker) and note it.
4. Contract: `Settings.adoptedOn` is `format: date`, Zod has no regex; `SettingsPatch.timezone` has no length limits.
5. Immutable `adopted_on` and "no delete" were column grants; after D6 they are API surface: PATCH must ignore/reject
   `adoptedOn` (Pydantic model without it, `extra="forbid"`), no DELETE route.

## Mapping hints

- `GET /v1/settings`, `PATCH /v1/settings` (204, 422 `TM-2`). Timezone validation in Python (`zoneinfo`). Postgres never
  resolves a user's timezone name (its tz data lacks browser names such as `Asia/Saigon`): "today" is Python only (D11),
  the old `today_for`/`check_activity_window` were dropped in backend migration `0008`.
- `settings.service.get_today(user)` and `get_week_start(user)` are the shared functions other modules call (README §5).

## Integration

Every other module depends on `today` and `week_start`: after this module, run the timezone edge tests of
target-architecture §7 for `Today`. Sign-up (auth) must create the row (D12) — test via `make_user` fixture and via a
real Better Auth sign-up on the Docker stack.

## Module-specific parity items

- [ ] New account → settings row with defaults (UTC, week start 1, Mochi, adopted today).
- [ ] First dashboard visit syncs browser timezone + week start once, then `TimezoneSync` is not rendered.
- [ ] Unknown timezone refused (TM-2) with the chosen message.
- [ ] `adoptedOn` cannot be changed through the API.
