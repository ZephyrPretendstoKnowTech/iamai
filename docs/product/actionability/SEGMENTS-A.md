# SEGMENTS-A — run in order, fresh session each, /effort high

Segment ids: A1a A1b A1c A2 A3 A4 A5 A6. The runner maps N → this list.

---

## A1a — Engine completeness (lanes read everything the legacy holds knew)

READ: RUN-CONTEXT-A.md; R-STATE (sections A.2, A.12, "Where the two vocabularies meet" #1–#5, #8, #20, #26); R-READY; R-RENDER §3.3; A1 §3–§8; `src/actionability/lanes.ts`, `src/ui/surfaces/planLanes.ts`, `src/roadmap/holds.ts`, `src/ui/surfaces/stepPackage.ts` (packageStateOf), `scripts/build-dependency-data.mjs`.

DO:
1. Adapter (`planLanes.ts observe`/`prerequisiteOf`): map every legacy `HoldKind` to engine input. `readiness` → an evidence gate on `enforce` (a started policy reads `Ready · Observing` with the threshold text as its reason; an unstarted policy's `create` is not gated by it); `evidence` → evidence gate; `review` → `drift` (→ `Correct`); `unavailable` → blocker `unsupported`; `prerequisite` → step edge; `decision`, `conflict` as today.
2. Engine (`lanes.ts`): `evidence` and `time/evidence-window` edges are evidence gates, never `fact`; unsatisfied on a started step → Observing; they gate `enforce` only. `license/platform` edges become the `license/platform` blocker (On Hold) with its content label. Remove the `fact` collapse.
3. Conditions: build `TenantState.conditions` from recorded carve-out answers (`mail-devices-incompatible-path`, `partner-accounts-exist`, `travel-exceptions-allowed`, `shared-devices-exist` from the plan record's decisions), `sd-enabled` from the scan's Security Defaults read, `campaign-targets-passkey` = true (product constant). A not-applicable answer completes the owning question step (A1 §8.2).
4. Observation time component: read `observation.minDays` from package META when present, else the existing 7/3 constants; expose it as the evidence gate's time part. Add the META field to `content-schema` types and the validator as optional.
5. Ids and scope (decisions 7, 8): edit A1 §10.0 ids to the runtime ids, add the `generated` column, mark the three absent goals; update `build-dependency-data.mjs` to skip `generated: no`; drop `runtime-source-reference-decision`; regenerate `dependency-data.json`; the doc-vs-data test stays green. Remove the alias workaround if one exists.
6. `packageStateOf` (R-RENDER §3.3): evaluate `partial` (safe correction fields) before `!executableNow`, so a drifted policy whose correction is safe projects the executable correction; enforcement stays held by its own gates. Add the regression test named in A3's B3 ("creation vs enforcement").
7. Tests: A1 §17 examples re-run against the new inputs; example 15 (license missing) must now be reachable; add one test per HoldKind mapping; R-FIX expected counts updated where they change, with the reason in the commit.

DON'T: touch any renderer, content.json words, exports, print, walk.

DONE-WHEN: every HoldKind has an engine counterpart; a started policy behind a readiness threshold reads Ready · Observing in the engine; `dependency-data.json` has 45 ids and no absent goals; suite green; committed.

---

## A1b — One producer (row, badge, bar, rail, When, header, tiles, buttons)

READ: RUN-CONTEXT-A.md decisions 1–4, 11, 12; R-STATE (A.4–A.11, A.13, B.1–B.5, meeting points #7–#21, #24–#25); A2; `src/ui/surfaces/planState.ts`, `statusWord.ts`, `stepContract.ts` (badgeOf, readinessOf, railOf, engineTiles), `planBoard.ts`, `Plan.tsx`, `StepSections.tsx`, `ContentStep.tsx` (head/badge only), `docs/design/content.json` (pages.plan.*, stepContract.*).

DO:
1. Row: `.lane` label is primary; `.status` chip renders only the fact `Report-only` / `Enforced` (decision 2) or nothing. `planStateOf` no longer produces a row word; keep it for `complete`/tone only until nothing reads it, then delete the word fields.
2. Badge = lane label (+ fact chip). Bar (`readinessOf`) keyed by lane/substatus/blocker: Create → `Ready now`; Correct → `Needs correction`; Needs decision → `Needs a decision`; Observing → `Continue observation`; Ready to enforce → `Ready to enforce`; Up Next → `After {step}`; On Hold → the blocker label; Completed → `Enforced` / `In place` (fact); Deferred → `Deferred` / `Doesn't apply`. Rail: the schedule date with its transition word when `scheduled`/`observing`; otherwise the lane reason. No `Held`, no `Blocked`.
3. When column: a date, or `—`. Remove `Held`, `After …`, `After prerequisites`, `Deferred`, `Not scheduled` from the column (the reason already lives in the lane label). `Complete` rows show `—`.
4. Header tiles: Steps · Completed · Projected finish (placeholder `—` until A2) · Started {date}. Remove Waiting/Remaining/In place tiles and the Needs-attention toggle; `focusCounts` returns lane counts only. Group summary drops "· n need attention".
5. Deferral (decision 3, 4): buttons `Defer this step` (policies) / `Doesn't apply here` (questions, prerequisites); badge/lane/bar/rail `Deferred` or `Doesn't apply`; baseline conflict → On Hold everywhere; `stepContract.rail.deferred` and the When `Deferred` path removed.
6. Words to content.json: `pages.plan.lanes.{ready,upNext,onHold,completed,deferred,doesntApply}` and `pages.plan.substatus.{create,correct,needsDecision,observing,readyToEnforce}`; `BOARD.lanes` and `lanes.ts` literals read them; delete the comment that keeps them out.
7. Readiness tiles (decision 12): prerequisite tiles carry the prerequisite's lane; direct edges only; suppress the transitive emergency-gate tile when the exclusions-group tile is present (R-READY "Transitive vs direct"); "Needs attention" appears once on the opened step (badge), not as banner + pill + chip.
8. Tests: a row/badge/bar/rail agreement test over every demo step: the four surfaces derive from one lane reading; a test that no forbidden word (`Blocked`, `Held`, `Needs attention`, `Skipped`, `Set aside`) renders on the Plan or an opened step.

DON'T: touch the engine (A1a), exports, print, walk.

DONE-WHEN: the demo Initial and Follow-up plans render with no forbidden word; every row's chip is Report-only / Enforced / empty; header shows the four tiles; suite green; committed.

---

## A1c — Exports, print, contracts, walk

READ: RUN-CONTEXT-A.md; R-STATE (B.6, meeting points #22, #23, #27); R-WALK; A3 findings B1, D2; `src/ui/surfaces/stepExport.ts`, `artifactLines.ts`, `src/roadmap/prompts.ts`, `ics.ts`, `plan.ts`, `PrintPlan.tsx`, `planRows.ts`, `src/ui/scan/connectView.ts`, `scripts/walk.mjs`, `scripts/smoke*.mjs`, `docs/qa/page-contracts.json`, `CLAUDE.md`.

DO:
1. `stepExportView` carries `lane`, `substatus`, `reason`, `fact`; ICS SUMMARY/DESCRIPTION, bundle `state`/`statusWord`, plan file, prompt pack, CSV where applicable use the lane label. Test: export state line === badge for every demo step (A3 B1).
2. Print: state words are lane words; grouping stays by phase (allowed as projection) plus a Completed / Deferred section; "Waiting on something else" heading removed.
3. Connect's Plan tile reads lane counts.
4. Walk + smoke + page-contracts: rewrite every assertion that reads the old status words to the lane vocabulary, once. Remove stale allow-list entries the removed words caused (A3 D2). Add contract entries for the lane label, fact chip, the four header tiles, Defer / Doesn't apply buttons.
5. CLAUDE.md: reconcile "sessions never run the walk" with the batch rule "A6 runs it once"; one sentence.

DON'T: touch engine or renderer beyond what exports need.

DONE-WHEN: export line = badge test green; walk assertions reference no removed word; suite green; committed.

---

## A2 — Projected finish

READ: RUN-CONTEXT-A.md; R-SCHED §7–§8, §6 edge cases; `src/derive/finish.ts`, `src/roadmap/forecast.ts`, `Plan.tsx` header, `PlanFooter.tsx`, `content.json` pages.plan.progress.*.

DO:
1. Header tile `Projected finish`: `schedule.estimate.targetEnd` formatted with `absoluteDate`, sub-line `at pace`. When `planFinish` is non-null and differs, a second line `committed {date}`. When no estimate exists, `—`.
2. Hover/expand on the tile: the critical-path sentences the schedule already derives (`schedule.derivation.criticalPath`), so the user sees which chain sets the date.
3. Cleanup rows: `Not scheduled` → `—`.
4. Freeze edge cases (R-SCHED §6): a from-only freeze is rejected in the input with a message, not silently dropped; the freeze `to` is stored at `T12:00` so the last freeze day is inside the freeze. Tests for both.
5. Print cover: `line1` uses the same estimate/committed pair.

DON'T: change the scheduler's placement rules, phases, or cadence.

DONE-WHEN: tile renders on demo and mock with a date; tests for 1 and 4; suite green; committed.

---

## A3 — Per-step snapshot harness and change-scope lock

READ: RUN-CONTEXT-A.md; R-FIX (fixtures and expected counts); R-RENDER §2 (component tree); `src/testing/*.ts`, `.github/workflows/ci.yml`.

DO:
1. `scripts/step-snapshots.mjs`: for each fixture in R-FIX (demo Initial, demo Follow-up, small, mid, large, messy, midflight, hostile) and each step, write `docs/qa/step-snapshots/<fixture>/<stepId>.json` = `{ lane, substatus, reason, fact, badge, bar, rail, headings[], tiles[{label,state}], channels[], when }`. Deterministic; no dates that move with the run date (use the fixture's start).
2. A test that regenerates in memory and diffs against the committed snapshots; failure prints the step and field.
3. `scripts/check-change-scope.mjs`, run in CI: if the diff touches `docs/implementation-content/<pkg>/…`, only that package's snapshot files may change; if the diff touches `src/`, any snapshot change requires `[snapshots]` in the commit message. Exit 1 otherwise, printing the offending files.
4. Commit the initial snapshot set with `[snapshots]`.

DON'T: change product behaviour.

DONE-WHEN: snapshots committed; the scope script passes on HEAD and fails on a constructed bad diff (test); committed.

---

## A4 — Trust tests, observing fixture, source-checked

READ: RUN-CONTEXT-A.md; A3 (findings A1–A6, C5); `src/roadmap/tracking.ts`, `tracking.drift.test.ts`, `src/roadmap/fixtures/index.ts`, `src/ui/demoFacts.ts`; R-SCHEMA §8 (verifiedSources).

DO:
1. Six tests named `A1`–`A6`, each reproducing the audit's evidence column against the fixture it names (demo-week2 with references answered, mutated as the audit describes), asserting the audit's "Correction direction". Where S1's ownership code already satisfies one, the test still exists. A failing test is a defect: fix in `tracking.ts` / `coverage.ts` / `generate.ts` with the same root-cause discipline; if the fix exceeds the segment, BLOCKED.md.
2. Demo Follow-up fixture: one policy that is in Report-only, undrifted, with evidence still maturing, so `Ready · Observing` renders on the product demo. Update R-FIX counts and the A3 snapshots with `[snapshots]`.
3. `Source checked`: render the line from `verifiedSources[].checkedOn` (decision 10) on every step that has it; add `checkedOn` to the 13 packages that lack it only where `verifiedSources` already names a source with a date elsewhere in META; otherwise leave absent.
4. Playbook §7: add the 7/3-day default and `observation.minDays`; §17 examples 13 and 15 realigned to the frozen §10; §10.0 `generated` column documented.
5. Commit `reference/goal-gaps.md`.

DONE-WHEN: A1–A6 tests exist and are green; the demo shows one Ready · Observing row; suite green; committed.

---

## A5 — Passkey settings step (and operator passkey)

READ: RUN-CONTEXT-A.md decision 9; R-GAPS; R-INV rows `s-prereq-passkey-settings`, `s-ladder-operator-passkey`; `docs/implementation-content/s-prereq-passkey-settings/…/META.json` and CONTENT.md; `src/graph/collect/registry.ts`, `src/roadmap/generate.ts` (prerequisite generation), `src/ui/surfaces/stepPackage.ts` (bindings), `src/graph/scopes.ts`, `src/graph/collect/roles.ts`.

DO:
1. Fetch https://learn.microsoft.com/entra/identity/authentication/how-to-enable-authenticator-passkey and copy the Microsoft Authenticator AAGUIDs (iOS and Android) into the package META as pinned target values with the URL and date in `verifiedSources`. If the page does not list them, stop the task and record it.
2. Evaluate the scan's `authMethodsPolicy.authenticationMethodConfigurations[id=Fido2]` against the target: `state`, `includeTargets` (all_users), `isAttestationEnforced`, `keyRestrictions.{isEnforced,enforcementType,aaGuids}`, `isSelfServiceRegistrationAllowed`. Resolve the package bindings `passkey.target.fido2Configuration` (target) and a `passkey.current.*` set (tenant).
3. Generate `s-prereq-passkey-settings` when any target field differs (state `missing` when the method is disabled, `partial` otherwise, `inPlace` when all match). Its edges in `dependency-data.json` are already active; verify the campaign step now waits on it (`s-verify-mfa:start ← s-prereq-passkey-settings`).
4. `roles.ts`: the authMethodsPolicy read's least role is Global Reader / Authentication Policy Administrator per Learn (R-GAPS); correct the Security Reader entry and make a refused read produce an unresolved `fact` blocker on the step, not a silent pass.
5. `s-ladder-operator-passkey`: generate when an operator is signed in and the read of that user's methods shows no passkey. If that read needs a scope not in `GRAPH_SCOPES`, do not add it; record in BLOCKED.md and stop this task.
6. Tests: generation on a fixture with passkeys disabled, partial, and matching; campaign gating; snapshots updated with `[snapshots]`.

DON'T: change any other package; add Graph scopes.

DONE-WHEN: the step appears on the demo (passkeys not configured there) as Ready · Create and the campaign reads Up Next · After Set Up Passkeys; suite green; committed.

---

## A6 — Gauntlet, deploy, live check, report

READ: RUN-CONTEXT-A.md; BLOCKED.md.

DO:
1. Once: `npm test`, `npm run build:site`, `node scripts/compile-implementation-content.mjs --validate-library`, `node scripts/compile-implementation-content.mjs --registry`, `npm run walk`, smoke, allowlist, external health. P0 = 0. A1–A6 tests mandatory.
2. Push; wait for CI; confirm deployed HEAD.
3. Live check (Chrome, desktop + narrow) on getiamai.com/planner demo: no forbidden word on any row; chip only Report-only/Enforced; header four tiles with a Projected finish date; one Ready · Observing row; Emergency Access opened step shows Needs attention once; Token Protection (Enforced, drifted) shows a copyable correction; Plan settings opens without hanging the page; Passkey settings step present and the campaign waits on it; Defer this step / Doesn't apply here buttons.
4. Report, once: FIXED table; DEFERRED from BLOCKED.md; ACTIONABILITY counts (demo Initial/Follow-up and your tenant if a plan file is loaded); TRUST A1–A6 results; VALIDATION; LIVE CHECK PASS/FAIL; DEPLOYMENT.
