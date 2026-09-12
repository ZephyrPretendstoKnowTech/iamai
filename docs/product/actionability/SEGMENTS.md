# SEGMENTS — run in order, fresh session each, /effort high

Parallel-safe pairs if the runner supports worktrees: S1 ∥ S2; S6 ∥ S3–S5. Otherwise sequential is fine.

---

## S0 — Code map, authority placement, verification queue (docs + RUN-CONTEXT only)

READ: RUN-CONTEXT.md, A1 (§10 and Appendix A only).

DO:
1. Code map. Locate each entry in the RUN-CONTEXT code map by the grep hints given there (and the existing test files next to them). Write the real paths into RUN-CONTEXT.md in place of "(filled by S0)". Also locate A3 (the audit findings file) and SOURCE-CHECKED-FIELD. Time-box: if an entry is not found in 10 minutes, write `NOT FOUND — <best guess>` and continue. Commit `S0: code map`.
2. Confirm A1 is at docs/product/actionability/. If absent, record in BLOCKED.md and end the segment.
3. Run one extraction over PINNED and write `docs/product/actionability/pinned-refs.tsv`: policy id, display name, excludeGroups, includeGroups, excludeRoles, authenticationStrength id, state. Adjust field paths to the actual pinned.json shape; do not open individual policy objects unless a row is ambiguous.
4. Clear V1, V2, V11 from pinned-refs.tsv. Clear V4, V5, V8, V10 from pinned-refs.tsv + MANIFEST. Apply only the outcomes listed in Appendix A. Edit A1 §10 rows and status tags; one finding line under each item; populate §18.1 for V11.
5. V3 and V9: fetch these two pages, apply the listed outcome, cite in Appendix C.
   - https://learn.microsoft.com/entra/identity/conditional-access/concept-conditional-access-report-only
   - https://learn.microsoft.com/entra/fundamentals/security-defaults
6. V6, V7: apply exactly as written under Owner answers in RUN-CONTEXT (both answered; V6 removes `baseline_order` and adds an empty `iamai_order`).
7. Regenerate A1 §12 from the frozen §10.

DON'T: touch src/ (reading it for the code map is fine). Rewrite any prose section. Invent any value Appendix A says not to.

DONE-WHEN: code map filled; no `V` tags remain in §10 except items recorded in BLOCKED.md; §12 regenerated; committed.

---

## S1 — Policy ownership / drift safety (A1–A6)

READ: RUN-CONTEXT.md, A3 (A1–A6 only), OWNER, its existing tests.

DO:
1. Implement one invariant in OWNER: once a tenant policy is associated with a goal/member, drift never erases or transfers ownership. Drift outcomes are exactly Correctable | Review required | On Hold.
2. A correction targets only a policy the goal owns and no other goal claims as satisfier. If safe correction is impossible: Review required with reason; never substitute a candidate.
3. Cover grant, client-app, include, exclusion, location, platform, and Report-only-before-enforcement drift.
4. Add `OWNER.drift.test.ts` (or the repo's naming) with one test per audit item A1–A6 plus one per drift kind, each named after the audit id.

DON'T: touch Plan grouping, lanes, or UI.

DONE-WHEN: all new tests green, existing suite green, committed.

---

## S2 — Lane engine (pure, no UI)

READ: RUN-CONTEXT.md, A1 §2–§9, §10, §13–§15, §17.

DO:
1. Write `scripts/build-dependency-data.mjs` that parses A1 §10.0 and §10.1–10.5 markdown tables into `dependency-data.json` next to the S2 module (choose the directory the engine lives in) (step index + edges + condition names). Add a test that fails if the doc and JSON diverge. Doc stays the source of truth.
2. Implement a pure module `deriveLane(step, graph, tenantState, ownerState) → { lane, substatus, reason, blockers[] }` following A1 §4 exactly, with: next-action determination, started detection (§3), conditional resolution (§8), deferred propagation (§8.3), missing-object rule (§8.4), Completed derived per scan, blocker taxonomy ordering (§15).
3. Implement `sortReady` (§13) and `sortUpNext` (§14) as amended by S0 (no `baseline_order`; `iamai_order` is read if present, ignored when empty) and transitive-unlock computation (§9.3 invariant; §12.1 rules).
4. Tests: implement A1 §17 worked examples 1–15 as fixtures verbatim, one test each, plus: lane does not change when phase membership changes; Completed/Deferred excluded from the three lanes.

DON'T: touch SCHED, PLANROW, STEP, or any renderer. Special-case step IDs. Add sort keys not in §13/§14.

DONE-WHEN: 15 example tests + invariants green; dependency-data.json generated and checked; committed.

---

## S3 — Plan tabs, sorting, phase decoupling

READ: RUN-CONTEXT.md, PLANROW, SCHED, S2's module exports.

DO:
1. Replace primary grouping (Preparation / Waiting / Cleanup / phase) with tabs Ready · Up Next · On Hold fed by `deriveLane`. Row label shows `Lane · substatus/reason` (`Ready · Observing`, `Up Next · After Emergency Access`, `On Hold · <blocker label>`).
2. Add `Show completed` and `Show deferred` toggles.
3. Sorting: `sortReady` / `sortUpNext`; On Hold grouped by primary blocker label.
4. SCHED becomes a secondary projection: dates/phase remain available but read lane truth; no lane reads phase. Minimum change to keep existing calendar behaviour.
5. Work type stays a row attribute/filter, never a lane.

DON'T: change opened-step content. Polish phases/dates. Remove SCHED.

DONE-WHEN: Plan renders three tabs from the engine; a test proves tab membership is unchanged when a step's phase changes; suite green; committed.

---

## S4 — Source mapping + remove the unidentified-group step

READ: RUN-CONTEXT.md, A1 §18.1, SETTINGS, PLANROW, the runtime row generator for `runtime-source-reference-decision`.

DO:
1. Stop generating the visible `Decide What the Baseline's Unidentified Groups Stand For` row.
2. Emit a typed `sourceMapping` blocker on each policy action that references an unresolved source reference (from A1 §18.1 / dependency-data.json), stating role include | exclude | both. Affected steps derive On Hold with reason `Baseline references an unmapped group`.
3. Add Plan settings → Baseline mappings: list unresolved references with their affected policies and role; map to a tenant group/location or mark "leave out" (explicit, reversible). No guessing of meanings; no "Group 1…N" labels anywhere in Plan.

DON'T: resolve any mapping yourself.

DONE-WHEN: row gone; affected policies On Hold with the reason; mapping surface round-trips; tests for both; committed.

---

## S5 — Opened step anatomy, Readiness tiles, Emergency Access step

READ: RUN-CONTEXT.md, A2, A1 §16, STEP.

DO:
1. Readiness = the only prerequisite surface. Tiles from `deriveLane().blockers` + unresolved prerequisites of the next action: up to four across, wrap, responsive, concise title/state, expandable explanation/evidence, link to prerequisite step or resolver. Resolved tiles leave the unresolved view; all-satisfied collapses to a compact success treatment; satisfied evidence stays expandable.
2. Remove duplicated containers (Needs attention banner, Fix before continuing, separate prerequisite prose, Planned work explanation, hardening blocks) wherever they repeat the same state.
3. Pre-enforcement checks: for the authored Readiness items A3 names, model each as a readiness prerequisite that gates `enforce` only; creation/Report-only stays allowed. Nothing else becomes a gate.
4. Emergency Access step structure: Why → Readiness tiles → account selection/input → Implementation → Microsoft Learn · Troubleshooting → Done when. Selected accounts are real input; remove "IAMAI does not hold the account" messaging when accounts are selected. Hardening stays nonblocking and secondary.
5. Why / Done when: only remove duplicated boilerplate exposed by the simplified anatomy in touched steps. No editorial pass.

DON'T: touch Implementation channel content (S6). Rewrite package prose.

DONE-WHEN: A2 anatomy satisfied on Emergency Access, Session Lifetime, MFA-for-all; targeted Chrome check at desktop and narrow widths using the plan-row/step-body selectors; suite green; committed.

---

## S6 — Implementation channels, provenance, viewer

READ: RUN-CONTEXT.md, A1 §16.2, A2, IMPL.

DO:
1. State selects instructions: Missing → create; Partial → correct; Report-only → observe/validate; Ready to enforce → enforce; Blocked → planning text visible, Copy disabled. Authentication Strength missing must show Entra create instructions (regression test).
2. Omit any channel whose only content is an error/placeholder ("JSON is not shown yet", "could not be projected safely", "IAMAI does not hold…"). The real blocker goes to Readiness (S5 tiles), not here.
3. JSON channel offered only with method, endpoint, body, and target identifier when safely available; otherwise withhold. Never invent IDs. No bare PATCH bodies.
4. Remove `Authored against baseline <hash>` / `Plan pins <hash>` from Implementation. Show `Source checked <date>` from the authored field; omit if absent.
5. Restore `Microsoft Learn · Troubleshooting` below Implementation, left-aligned, label exactly `Microsoft Learn`.
6. Expanded viewer: materially larger modal using available width/height, preserves selected channel, visible Copy when copyable, readable PowerShell/JSON, responsive, inline viewer unchanged.

DON'T: touch Readiness/tiles (S5). Change package content.

DONE-WHEN: tests for 1–4; Chrome check of Authentication Strength (Missing) and one Report-only policy at two widths; suite green; committed.

---

## S7 — State-word agreement, synthetic fixtures, small cleanup

READ: RUN-CONTEXT.md, A3 (the named items only), EXPORT, FIXTURES.

DO:
1. Row, expanded badge, rail, Export, Calendar read the same lane/substatus truth: Needs attention never exports Healthy; review-required enforced never says In place / Already satisfied; Fix text never claims creation blocked when only enforcement is. No second export state model.
2. Replace tenant-derived example identities/device names in shipped static content and fixtures with synthetic values; keep tests stable.
3. Only if direct and low-risk, in this order, stop when time is better spent elsewhere: stale page-contract/walk allow-list entries; LIBRARY validation status; PowerShell parsing in CI; false implementation README claim; ICS UTF-8 folding; row accessible-name separators; empty lead text.

DONE-WHEN: tests for 1 and 2; suite green; committed.

---

## S8 — Gauntlet, deploy, live check, report

READ: RUN-CONTEXT.md, BLOCKED.md.

DO:
1. Once: `npm test`, `npm run build:site`, `node scripts/compile-implementation-content.mjs --validate-library`, `node scripts/compile-implementation-content.mjs --registry`, `npm run walk`, then smoke, bundle/host allowlist, external health. P0 must be 0. Drift tests mandatory.
2. Push; wait for CI; confirm deployed HEAD.
3. Live check via Claude-in-Chrome using the existing selectors, desktop + narrow: the 18 items in the original brief §28. Record PASS/FAIL only.
4. Report, once, in this shape and nothing more:
   - FIXED — table: Area | Root cause | Change | Result
   - DEFERRED — contents of BLOCKED.md, deduplicated
   - ACTIONABILITY — counts: Ready, Ready·Observing, Up Next, On Hold, Completed, Deferred; one line per surprising row
   - TRUST REGRESSIONS — A1–A6 results
   - VALIDATION — targeted, full, build, validator, registry, walk P0/P1/P2, smoke, allowlist, external health
   - LIVE CHECK — 18 PASS/FAIL lines
   - DEPLOYMENT — commits, CI, deployed HEAD

Stop after the report. No Home/Connect/polish.
