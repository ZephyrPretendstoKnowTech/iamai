# Performance guard 01 (prompt 20 §7)

Date: 2026-08-28. Budget: 2 seconds to interactive for Findings, Roadmap and
the People inventory against a large tenant.

## Synthetic tenant

`src/ui/pages/bigFixture.ts` (dev builds only; `?dev=1&big=1#/components`):
5,000 users, 40,000 sign-in records, 60 Conditional Access policies, 200
groups, 1,500 devices, 12 admins, ~6% guests. Deterministic (seeded), invented
names and ids only.

## Method

Headless Chrome 1440 px, Vite dev server (unminified, so slower than the
built bundle). The driver navigates to the gallery, polls every 50 ms for the
first rendered element of each section, and records the elapsed time since
navigation; tab clicks are timed from the click. Each figure is the first of
two runs (the second was within 10%).

## Timings

| What | Since navigation | Since the action | Budget |
|---|---|---|---|
| Scan (readiness table, first row) | 0.43 s | | 2 s |
| Findings (summary tiles) | 1.11 s | | 2 s |
| Roadmap (overview tiles) | 1.14 s | | 2 s |
| Inventory (Policies table) | 1.14 s | | 2 s |
| Inventory → People tab, 5,000 rows | | 0.04 s | 2 s |
| People: sort by Activity | | 0.001 s | 2 s |
| Findings → Here's what needs attention (13 goals expanded) | | 0.55 s | 2 s |
| Roadmap → Steps (17 steps expanded) | | 0.001 s | 2 s |

Every figure is under budget. The whole gallery (all five synthetic sections
mounted on one page) is interactive in about 1.1 s; a single page in the app
mounts one of them.

## Why nothing needed virtualising

`DataTable` already pages at 50 rows and sorts the full array once per
change, so the People inventory renders 50 rows regardless of tenant size
(sorting 5,000 rows is ~1 ms). Findings and Roadmap scale with goals and
steps (16 and 17), not with users; the per-user work (readiness scoring,
population counts) is linear and completes inside the 1.1 s above.

## Watch list

- Roadmap step generation is O(policies × users) for population resolution;
  at 60 policies × 5,000 users it is well inside budget, but a 50,000-user
  tenant would be the next thing to measure.
- The Findings summary tab renders every goal card at once when grouped;
  with a much larger catalogue that tab is the first to virtualise.
- Numbers now carry a thousands separator ("5,000 users") via `count()`.
