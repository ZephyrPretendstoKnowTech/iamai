# Performance guard 03 (prompt 23 §13, ux-review-06 §16)

Date: 2026-08-28. Bar: no continuous main-thread task over 200 ms on
Findings or Roadmap.

## Method

Same `longtask` observer as perf-02, injected before load, headless Chrome
against the 5,000-user synthetic tenant (`?dev=1&mock=1&big=1`), Vite dev
server. "First render" is the longest task from navigation until the first
content polled; "heaviest tab" is the longest task after opening it.

## Before and after

| Page | Before (perf-02) | After lazy panels | After lazy cards |
|---|---|---|---|
| Findings, first render | 393 ms | 72 ms | **68 ms** |
| Findings → Here's what needs attention (13 goals) | (inside the 393) | 340 ms | **180 ms** |
| Roadmap, first render | 167 ms | 186 ms | **191 ms** |
| Roadmap → Steps (every card) | 167 ms | 186 ms | **191 ms** |
| Inventory → People (5,000 rows) | 135 ms | 61 ms | **59 ms** |

Two changes did it, both in shared components:

- **Tabs mount a panel once it is visited** (all panels on `beforeprint`).
  Findings used to lay out Summary, both goal lists and Details at once;
  Roadmap laid out Overview, Timeline, Danger areas and every step card.
- **ExpandCard mounts its body when opened** (all bodies on `beforeprint`).
  A list of closed cards now costs its summaries only.

Coverage and plan derivation were already memoised (`useMemo` keyed on the
scan, baseline, mapping and saved progress); nothing recomputes on tab
change. The step list is not virtualised: with every card closed and only
its summary mounted, 32 cards are 191 ms, under the bar.

## Live tenant

The reviewer's screenshot timeouts (30 s CDP timeouts on Roadmap and
Findings) were reproduced once in this session by a different cause: an
IndexedDB open blocked by another tab on an older schema version, which
left every read queued and the page waiting. That is fixed in the same
pass (each connection closes on `versionchange`; a blocked open fails in
6 s with a sentence). Long tasks measured on the live tenant in perf-02
(140 ms Roadmap, 111 ms Steps) were already under the bar.
