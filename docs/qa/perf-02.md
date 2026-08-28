# Performance guard 02 (prompt 22 §42)

Date: 2026-08-28. Question from ux-review-05 §42: does any page block the
renderer for seconds (the reviewer's screenshot capture kept timing out)?
Bar from prompt 22: split or virtualise anything over 500 ms of continuous
main-thread work.

## Method

Headless Chrome, Vite dev server (unminified), a `PerformanceObserver` for
`longtask` entries injected before the page loads, against the synthetic
5,000-user / 40,000-sign-in / 60-policy / 200-group tenant
(`?dev=1&mock=1&big=1`). Each figure is the longest single task recorded
from navigation to the moment the page's first content was polled, then
after the heaviest tab was opened. Time-to-interactive from prompt 20's
guard (`perf-01.md`) is repeated for comparison.

## Longest continuous main-thread task

| Page | On first render | After the heaviest tab | Tasks over 500 ms | Interactive since navigation |
|---|---|---|---|---|
| Findings | 393 ms | 393 ms (Here's what needs attention, 13 goals expanded) | 0 | 0.60 s |
| Roadmap | 167 ms | 167 ms (Steps, every card) | 0 | 0.39 s |
| Inventory → People (5,000 rows, paged at 50) | 135 ms | 135 ms | 0 | 0.66 s |

Nothing exceeds the bar, so no page was split or virtualised.

## What was likely blocking the reviewer's build

Two things in ux-review-05 point at real work that no longer happens on the
main thread in the same way:

- **§6, the 133-role include list.** A "Today the policy includes" line used
  to resolve and lay out 133 role names as one paragraph on every affected
  step card; the list is now collapsed to "All 133 directory roles" with a
  disclosure, so the names are laid out only when opened.
- **The Steps tab rendering every card.** With Hide completed defaulting on
  past one-third done, and the state line replacing the repeated blocker
  callout text, each card is lighter; the largest task on the Steps tab of
  the synthetic tenant is 167 ms.

## Not yet measured

The same observer has not run against the live tenant from this session
(sign-in pending). `?dev=1&mock=1&big=1` stands in; if the live Roadmap
still shows a task over 500 ms, the next candidates are the step-card
markdown/JSON rendering (defer `action.json` formatting until the card is
opened) and the danger-area name resolution.
