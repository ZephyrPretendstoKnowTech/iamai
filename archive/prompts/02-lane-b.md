# 02 — Lane B: sign-in evidence

Precondition: 01-lock-data-model.md is committed.

Implement Lane B exactly per docs/design/collection.md, including the derived tables added by prompt 01 (per-policy applied results, currently-failing cohort, per-user lastMfaSuccess).

Requirements, all from the design doc: beta unfiltered newest-first paging with the interactiveUser lambda, $top=200, the replay $select, client-side 30-day cutoff, TIME_BUDGET_MS and ROW_MEMORY_CEILING, coverage labelling with the `insufficient` rule, the "Graph is slow" state, IndexedDB cache with newest-gap-first resume, "Forget this tenant", raw rows never crossing the worker boundary.

Wire Verified and Not challenged into the Readiness table. Add a "Blocked today" summary: users with conditionalAccessStatus failure in the covered window, grouped by policy, with counts and the affected users.

Tests for: window cutoff, time budget, memory ceiling, coverage labelling including `insufficient`, resume newest-gap-first, and each derived table.

Commit and push. Then tell me to run a scan and what to expect on screen while Lane B runs.
