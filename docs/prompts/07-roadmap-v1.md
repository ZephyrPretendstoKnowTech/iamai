# 07 — Roadmap v1

Precondition: 06-mapping.md is committed. Read docs/design/roadmap.md in full; it is the specification.

1. `src/roadmap/` pure modules: step generation from coverage + mapping + readiness + evidence + capabilities (§1–§6), ordering (§2), action rendering (§3: JSON with mapped references, report-only state, and the description tag; portal click path in the portal's field vocabulary; PowerShell one-liner), readiness numbers per goal family (§4), evidence per goal (§5), gating (§6), progress matching and history on re-scan (§7).
2. Named constants for every threshold in roadmap.md (readiness thresholds, exit-criterion days and sign-in counts, break-glass drill days).
3. Roadmap page per §8: "blocked today" banner, phase timeline with counts, step cards with status, expandable to why / population / readiness / evidence / action (three tabs: JSON, portal steps, PowerShell) / exit criteria / rollback / history; filters by status and phase; skipped requires a reason. Author Intent text from the baseline docs appears in "why", attributed to the baseline author with a link.
4. Print stylesheet: the whole plan in phase order, light theme, JSON in monospace, page breaks between phases.
5. "Save plan" writes the plan file per docs/design/plan-file.md (JSON in v1; the self-contained HTML wrapper is a later prompt); "Load plan" restores it, re-runs progress matching against the latest scan, and writes a checkpoint.
6. Implement the 8 tests in roadmap.md §9 with authored fixtures.
7. Run against the current tenant with the mapping completed; confirm the eight absent goals from intents.md §11 appear as create steps with usable JSON, the admin-session partial appears as an adjust step with the exact field change, and the enforced goals show as done. Record the run in docs/design/roadmap.md §10 "First run".

Commit and push. Then tell me to open the Roadmap and what to look at.
