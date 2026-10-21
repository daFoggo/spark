# Module: pet (no backend; parity check only)

`features/pet` is pure (`pet.ts`: `STAGES` 0/30/90/200/400, `petState`, mood, `fatness = min(1, treats/400)`) with
presentational components (`pet-card.tsx`, `mochi.tsx`). It has no `server.ts`, no actions and no table. Spec PT-1…PT-5.

Inputs and where they come from after the migration:

| Input | Source today | Source after |
| :--- | :--- | :--- |
| `treats`, `lastActivity` | `activities.fetchActivityStats` | `GET /v1/activities/stats` (Phase 6a) |
| `weekRate` | `habits/stats` (`week.done / max(1, week.dueSoFar)`) from check-ins | same TS code on `listCheckIns` data (Phase 5) |
| `name`, `adoptedOn` | `user_settings` | `GET /v1/settings` (Phase 3) |
| `today` | `lib/clock.ts` `getToday(timezone)` | unchanged |

Assembled in `_components/dashboard-data.ts`, `dashboard/_components/today-sections.tsx` (`TodayPet`),
`_components/inspector-content.tsx`. Test: `__tests__/pet.test.ts`.

## Parity items (after Phases 3, 5, 6a)

- [ ] Pet name, stage (tangerines), size and mood equal on both stacks for the seed user.
- [ ] A check-in raises treats by one and plays the feeding feedback (PT-5); undo lowers it.
- [ ] A user with no activity for 2 days shows `sleepy`.
