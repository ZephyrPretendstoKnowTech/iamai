# RUN-CONTEXT — Plan Actionability + Trust Correction

Every segment reads this file first, then only the inputs its segment names. Nothing else is read unless a named file references it.

## Repository
- Repo: C:\Dev\IAMAI
- Expected starting HEAD for S1: b61aac5. If HEAD is newer, preserve newer work; do not revert it.

## Authorities (read fresh, in this order, only when a segment names them)
- A1  docs/product/actionability/IAMAI-Actionability-Dependency-Playbook.md — dependency edges, gates, lanes, started-state, sorting, worked examples. Authority over prompt text.
- A2  docs/design/approved/anatomy/plan-step-v1.html — opened-step anatomy.
- A3  NOT FOUND — best guess: the 2026-09-11 read-only audit of 9a30372 is not checked into the repo; nearest in-repo material is `docs/audit/042-product-truth-decision-integrity.md`, `docs/audits/guidance-audit-01.md`, and `docs/audits/steps/*.md`. The per-item findings (A1–A6) live only in the session memory file `iamai-audit-2026-09-11-plan-library.md` outside the repo. Segments needing A3 must read it from the owner or treat its items as deferred (BLOCKED.md).

## Code map (filled by S0 — later segments read the paths from here and never search for them)
- SCHED    `src/roadmap/schedule.ts` (buildSchedule, dependencyGraph, waves) + `src/roadmap/stepSchedule.ts` (one per-step schedule result, ScheduleClass) + `src/derive/phases.ts` (wave/phase labels, inWave). Tests: `src/roadmap/schedule.test.ts`, `src/roadmap/stepSchedule.test.ts`, `src/roadmap/scheduleClamp.test.ts`.
- PLANROW  `src/ui/surfaces/planRows.ts` (row model) + `src/ui/surfaces/planBoard.ts` (grouping) + `src/ui/surfaces/planState.ts` + `src/ui/surfaces/Plan.tsx` (renders `.plan-group` / `.plan-row`). Tests: `planBoard.test.ts`, `planState.test.ts`, `planAnatomy.test.ts`, `planUsability.test.ts` beside them.
- STEP     `src/ui/surfaces/ContentStep.tsx` (opened step, `.step-body`, heldBox('packageFault')) + `src/ui/surfaces/StepSections.tsx` (ReadinessSection, `.readiness-strip`) + `src/ui/surfaces/stepContract.ts` (view model) + `src/ui/surfaces/CleanupStep.tsx`. Tests: `stepContract.test.ts`, `policyStep.test.ts`, `readinessAnatomy.test.ts`.
- OWNER    `src/coverage/coverage.ts` (satisfier / candidate reading, In place) + `src/roadmap/tracking.ts` (plan-tag match, findTaggedPolicies from `src/roadmap/generate.ts`) + `src/content/implementation/drift.ts` (DriftStatus current/reviewNeeded/held; "Review required" word in `src/content/implementation/protocol.ts` READINESS_RESULTS). Tests: `src/coverage/coverage.test.ts`, `src/roadmap/tracking.test.ts`, `src/content/implementation/drift.test.ts`.
- IMPL     `src/content/implementation/project.ts` (projector, sourceUpdatedOn) + `src/ui/surfaces/stepPackage.ts` (channel view) + `src/ui/surfaces/ContentStep.tsx` (`heldBox('packageFault')`). Words: `docs/design/content.json` keys `…implementation.empty.packageFault` and the `{channel} is not shown` fault line. Tests: `src/content/implementation/library.test.ts`, `runtimeContract.test.ts`, `src/ui/surfaces/packageState.test.ts`.
- EXPORT   `src/roadmap/ics.ts` (ICS) + `src/ui/surfaces/Export.tsx` + `src/ui/surfaces/stepExport.ts` + `src/ui/exportGuard.ts`. Tests: `src/ui/exportGuard.test.ts`, `src/exports.test.ts`, `src/exportsClean.test.ts`.
- SETTINGS `src/ui/surfaces/Plan.tsx` (`PLAN_SETTINGS_ID = 'plan-settings'` panel, `settings` words prop). Test: `src/ui/surfaces/planUsability.test.ts`.
- FIXTURES `src/roadmap/fixtures/index.ts` (+ `records.ts`, `scenarioRows.ts`, `transitions.ts`, `semantics.ts`) + `src/ui/demo.ts` (demoTenant Initial/Follow-up) + `src/ui/demoFacts.ts` + `src/testing/*.ts` (bigFixture, gapsFixture, pilotFixture).
- RUNTIME-ROWS `src/roadmap/generate.ts` — the unidentified-groups row is the prereq step `PREREQ_STEP_ID.sourceReferences` = `s-prereq-source-references` (`src/roadmap/stepIds.ts`; pushed near `const sourceStepId`), the harden row is `deferredHardeningLines()` feeding the Cleanup `hardening` kind in `src/roadmap/cleanup.ts` (tiers from `src/validation/emergencyTiers.ts`). A1 calls these `runtime-source-reference-decision` and `cleanup-harden-emergency-access`; no code uses those ids. Tests: `src/roadmap/sourceReferences.test.ts`, `src/roadmap/cleanup.test.ts`.
- PINNED   `baselines/jhope188-conditionalaccesspolicies.pinned.json` (commit 90d9b890; keys commit/generatedAt/policies[38]/stripped/goalMap) with `…interpretation.json` and `…index.json` beside it.
- MANIFEST `docs/implementation-content/LIBRARY.json` (library manifest; per-package `META.json` under `docs/implementation-content/<step>/`) compiled into `src/content/implementation/registry.generated.json`; binding families (`policies.<family>.<role>.…`) are declared in `src/content/implementation/protocol.ts` and loaded by `src/content/implementation/library.ts`.
- SOURCE-CHECKED-FIELD `verifiedSources[].checkedOn` (YYYY-MM-DD) in each package `META.json`, typed in `src/content/implementation/protocol.ts` (VerifiedSource) and read by `sourceUpdatedOn()` in `src/content/implementation/project.ts` (latest user-facing date, or null).

## Decisions already made (do not ask, do not re-decide)
- Internal state name stays `Suspended`; user-facing word is `Deferred`.
- `Show completed` and `Show deferred` are toggles on the Plan view, not tabs.
- Baseline mappings live under Plan settings → Baseline mappings.
- Source freshness in Implementation uses SOURCE-CHECKED-FIELD from the code map; wording `Source checked <Mon D, YYYY>`. Omit the line if the field is absent. Never fabricate a date.
- V-tagged rows in A1 §10 are loaded as currently classified until S0 changes them; status tags never gate runtime behaviour.
- Ready ordering is A1 §13 exactly; Up Next ordering is A1 §14 exactly, both with `baseline_order` removed per V6. No other keys.
- §10 pre-enforcement checks (authored Readiness content): classify only the items A3 names. Anything else goes to BLOCKED.md as deferred.
- No runtime code special-cases step IDs.

## Owner answers (Lachlan fills these two before running; everything else is discovered by S0)
- V6 — baseline ordering: **not used at all.** Jon's listing order is incidental and is not a tie-break. Remove `baseline_order` from A1 §10.0, §13, and §14. Order inside a lane is IAMAI's own call, driven by policy content: the existing keys (actionable first, transitive unlock count, create before enforce, `scope_class` ascending, evidence age) then step ID as the only deterministic fallback. Add an empty owner-authored field `iamai_order` to §10.0 for a later product-authored ordering; leave it empty; do not propose values.
- V7 — registration campaign method: **passkey**. The pinned baseline itself is Authenticator-only; IAMAI's product choice is that the registration campaign is always passkey (phishing-resistant) targeted. Outcome: `s-verify-mfa:start ← s-prereq-passkey-settings` becomes `hard`. Record in A1 §18.2 as a known, deliberate product deviation from the baseline for this step only; it does not change any pinned policy object.

## Working rules
- One root cause per segment. Stay inside the segment's DO list.
- `npx tsc --noEmit` during work; targeted tests for the segment; `node --test "src/**/*.test.ts"` once at segment end. No walk, no build, no deploy except in S8.
- Commit per change, plain message prefixed with the segment id (`S3: …`).
- No narration, no reports, no summaries except the S8 report.
- Do not rewrite prose, sections, or files you are not changing. Edit-only.

## Overnight failure protocol
- If a task fails twice on the same root cause: `git stash` or revert the partial change so the tree is green, append an entry to docs/product/actionability/BLOCKED.md (`segment · task · root cause · what was tried · smallest next step`), and continue with the next task.
- If a segment's DONE-WHEN cannot be met: leave the tree green, record in BLOCKED.md, end the segment. The next segment starts regardless.
- Never leave a red tree at segment end. Never ask a question; choose the option that is smallest and reversible, and record the choice in BLOCKED.md under `Choices`.
- If an unexpected architecture expansion is needed: classify it, defer it to BLOCKED.md, continue.

## Chrome checks
- Live checks use the Claude Code Chrome integration. If it is unavailable in the session (no browser connected), record `SKIPPED — Chrome unavailable` for that check in BLOCKED.md and continue. Never stall on it.

## Freeze (all segments)
No Home/Connect/Print/Export redesign, no public website changes, no scheduler removal, no new lifecycle, no package-specific hacks, no mass prose rewrite, no resolving register-info / Admin Portal / name.canonical / Email audiences, no prioritisation scoring, no phase/date polish.
