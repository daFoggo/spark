# Instant navigation: baseline (2026-10-23)

Read-only measurement of the current production build (`pnpm --filter web build`, no testing API), run with `next start`
on port 3210. This is the "cannot get worse" yardstick for the later tasks of
`docs/superpowers/plans/2026-10-23-instant-navigation.md`. No app code was changed.

## Conditions

- Local machine in Vietnam, Chromium (Playwright, headless), production build run locally, Supabase in Tokyo. Absolute
  numbers are noisy (see `docs/providers.md` §5: the link was unstable on 2026-10-22). Server round trips are not what
  the click timings below measure; they measure what happens after a prefetch has already landed.
- Two fresh `*@example.test` users, timezone `Asia/Ho_Chi_Minh`:
  - **small**: 1 goal, 1 habit (created from the goal page), 1 task.
  - **large**: 3 active goals (the maximum), 12 habits, 12 tasks.
- Prefetch classification: a request is an RSC request when it carries the `RSC: 1` header or `_rsc`; it is a prefetch when
  it also carries `Next-Router-Prefetch` or `Next-Router-Segment-Prefetch`. Every RSC request seen was a prefetch;
  there were no non-prefetch RSC requests (those would be client navigations that missed the cache). All returned 200.
- The measurement script lives outside the repo:
  `C:\Users\Foggo\AppData\Local\Temp\claude\D--Dev-Projects-spark\5ad6927c-f3da-48e6-86d2-b491e700bfae\scratchpad\measure.mjs`
  (raw numbers in `...\scratchpad\results.json` in the same folder).

## A. Prefetch requests while idle (full load, then 5 s idle)

Counts are all prefetch requests from the start of the load to 5 s after load. Each link produces two kinds of request:
one `Next-Router-Segment-Prefetch: /_tree` request (the route tree) and one or two full prefetch requests for the same path.

| Source page | small: total | large: total | Targets (large) |
| :--- | ---: | ---: | :--- |
| /dashboard | 18 | 22 | 7 sidebar/menu routes + 3 goal detail pages |
| /dashboard/goals | 19 | 23 | 7 routes + `/dashboard` + 3 goal detail pages |
| /dashboard/habits | 21 | 24 | 7 routes + 2 goal/habit details (only the habits in the viewport, 3 of 12) |
| /dashboard/tasks | 15 | 15 | 7 routes + `/dashboard` (task rows are not links) |
| /dashboard/review | 16 | 16 | 7 routes + `/dashboard` |

Sidebar and menu links alone account for 14-16 of these on every page (guide, account, preferences included, even when
the user menu is closed); `/dashboard/tasks` and the current page's neighbours are fetched 2-3 times each.

## B. Hover and scroll the longest list

Hovering the first 15 links in `main` and scrolling 4000 px, then 3 s.

| Page | links in main (small / large) | new prefetch requests (small / large) |
| :--- | :--- | :--- |
| /dashboard/habits | 4 / 15 | 0 / 8 (all `/dashboard/habits/<id>`, one each) |
| /dashboard/goals | 3 / 5 | 0 / 0 |
| /dashboard/tasks | 2 / 2 | 0 / 0 |

With 12 habits the viewport prefetches only 3-4 on load; scrolling adds the other 8, one request each. Total for the
habits list is 12 detail prefetches (12 rows), after which nothing more is fetched. Goals are capped at 3, so that list is
always small.

## C. Click to content (client navigation, ms)

Method: full load of the source page, wait for network idle plus 1.5 s, then click. Time is taken in the page from the
capturing `click` event to the first animation frame in which the destination `h1` (and then the destination data) is in
the visible `<main>`. 5 runs each. "Data" is the destination content that needs the server (goal link, Checkpoints heading,
Last 52 weeks heading, task text, "scheduled days", the account email).

| Navigation | small: h1 median / max | small: data median / max | large: h1 median / max | large: data median / max |
| :--- | :--- | :--- | :--- | :--- |
| Today -> Goals | 29.8 / 30.6 | 29.8 / 30.6 | 29.1 / 31.6 | 29.1 / 31.7 |
| Goals -> goal detail | 32.3 / 37.0 | 32.3 / 37.0 | 31.1 / 35.6 | 31.1 / 35.6 |
| Habits -> habit detail | 30.2 / 31.9 | 30.2 / 31.9 | 29.9 / 32.5 | 29.9 / 32.5 |
| Today -> Tasks | 28.4 / 29.3 | 28.4 / 29.4 | 30.2 / 31.5 | 30.3 / 31.6 |
| sidebar -> Weekly review | 28.3 / 44.9 | 28.4 / 45.0 | 32.4 / 48.4 | 32.5 / 48.5 |
| sidebar -> Account | 29.1 / 29.1 | 29.1 / 29.2 | 29.2 / 29.9 | 29.3 / 30.0 |

All values are about two frames at 60 Hz (16.7 ms per frame): the measurement resolution is one animation frame, so
this means "visible in the first or second frame after the click", not a finer difference between routes. The h1 and the
data appeared in the same frame in every run (no skeleton step was observed by this probe). Max values above 40 ms are one
slow frame in the Weekly review runs.

## D. Server invocations

Not available locally (no `x-vercel-*` headers). The proxy for the count is the prefetch request count in section A
(each is a server request unless served from the Next cache): about 15-24 per full page load for these users.

## Previous numbers (`docs/providers.md` §5)

- 2026-10-22, Tokyo project, production build run locally from Vietnam: TTFB 6-11 ms (PPR shell); full streamed content
  0.5-3.6 s (the wait is the Supabase round trips; the link was unstable, single requests 0.15-9 s).
- Earlier, Supabase ap-south-1: ~630 ms hard load before the JWT claims change, ~315 ms after.
These are hard-load numbers; the client navigation numbers above are new.

## What this says

- Every client navigation measured was content-complete within about two frames after the click, for both data sets.
  That is the effect of prefetching destinations together with their data; the baseline to keep is: no skeleton, no
  non-prefetch RSC request on these six navigations.
- The links that produce the most prefetch requests are the sidebar and user-menu links (14-16 per page, each route
  fetched as a `/_tree` request plus 1-2 full prefetches, the tasks route 2 full prefetches on most pages). Detail links add
  to that in proportion to the list: 3 goals on Today/Goals, 3-4 habits in the viewport on Habits.
- Longest list: habits. 12 habits means 12 detail prefetches (3-4 on load, the rest as the rows scroll into view). That is a
  modest number at this size and bounded by what is on screen; larger lists (more than 12 habits) were not measured, so
  how it scales beyond that is unknown.
- Noise: single machine, one run of the procedure, 5 samples per cell, frame-quantised timing. Prefetch counts varied
  by 1-2 between two runs of the script.
  The click timings do not include server time, because the data had already been prefetched; a navigation that misses its
  prefetch would show the Supabase round trips (see the previous numbers) and would be visible in this probe.
