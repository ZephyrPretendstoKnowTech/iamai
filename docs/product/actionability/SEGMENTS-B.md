# SEGMENTS-B — run in order, fresh session each, /effort high

Segment ids: B1 B2 B3 B4 B5 B6 B7 B8 B9.

---

## B1 — Engine: lane states for enforced policies, substatus rename, completion gates

READ: RUN-CONTEXT-B.md; MASTER (U19, U20, U21, U22, U11, U28); R-STATE; R-RENDER §3.3 (packageStateOf rules); `src/actionability/lanes.ts`, `src/ui/surfaces/planLanes.ts`, `src/ui/surfaces/stepPackage.ts` (packageStateOf), `src/roadmap/tracking.ts` (drift classifier), `src/roadmap/coverage.ts` (completion evaluation), `docs/design/content.json`.

DO:
1. **U20/U21 — enforced policy lane derivation.** In the lane engine's terminal-outcome check (playbook §4 step 1): if `lifecycle === 'enforced'` AND drift classifier reports zero drift → return Completed. If `lifecycle === 'enforced'` AND drift exists → next action = `correct` → Ready · Correct. Remove the path where enforced policies read Observing. Add tests: an enforced-no-drift fixture step reads Completed; an enforced-with-drift fixture step reads Ready · Correct; a report-only step still reads Observing.
2. **U19 — packageStateOf safe correction.** In `packageStateOf`, confirm rule 6 (`partial`) fires for enforced policies. If `lifecycle === 'enforced'` is excluded from the `partial` condition, add it. The heuristic for safe correction: if the only drift dimensions are in `excludeGroups` (adding, not removing), the correction is safe. All other drift types keep `plannedWork` until prerequisites clear. Test: an enforced block policy missing the exclusion group returns `partial`, not `plannedWork`.
3. **U22 — threshold tile state-aware text.** In the threshold tile data builder (in `engineTiles` or readiness evaluation): check `lifecycle`. If `'enforced'`: text = `"${pct}% of [scope] have a qualifying method."`. Else: existing gate text. Test on the MFA-all-users and phishing-resistant steps.
4. **U11 — substatus "Needs decision" → "Decision".** Find every occurrence of the string `"Needs decision"` in `lanes.ts`, `planLanes.ts`, `content.json`, and tests. Replace with `"Decision"`. The bar text "Needs a decision" is a different string — keep it. Test: the demo Devices step badge reads "Ready · Decision".
5. **U28 — conditional input completion gates.** In the completion evaluator (`coverage.ts`): for each step that has a conditional input field in the plan record (`decisions.mailDevices`, `decisions.partnerAccounts`, `decisions.sharedDevices`, `decisions.travelExceptions`, `decisions.deviceCodeWorkflows`), add a check: if the field is `null` or `undefined`, the step cannot reach Completed or Ready-to-enforce. Test: a fixture step with an unanswered conditional input does not read Completed even when all other conditions are met.
6. Update snapshots with `[snapshots]`. Expect lane count changes on enforced policies across all fixtures.

DON'T: touch any renderer, any DOM, any CSS, any content file.

DONE-WHEN: every enforced-no-drift step on the demo reads Completed; every enforced-with-drift step reads Ready · Correct; Devices step badge reads "Ready · Decision"; conditional input gate test passes; suite green; committed.

---

## B2 — Plan rows: subtitle, next pill, impact formatting

READ: RUN-CONTEXT-B.md; MASTER (U9, U10, U12, U13); the plan row component (grep `plan-row-reason`, `plan-row`, `next` in `src/ui/surfaces/`); `src/ui/surfaces/stepContract.ts` (impactOf or equivalent); R-SCHEMA (for the new `impact.fallbackLabel` META field).

DO:
1. **U9 — remove row subtitle.** In the plan row component, stop rendering the `span.plan-row-reason` element. Do not delete the reason data from the engine — only the rendering. Test: no `plan-row-reason` spans on any fixture.
2. **U10 — remove "next" pill.** In the plan row component, remove the "next" badge. Find the condition that adds it and remove the element. Test: no element with text "next" in any plan row.
3. **U12 — impact never shows a name.** In the impact formatter, replace any path that returns a person's displayName with the count format. `count === 1` → "1 person", not the name. Test: no plan row impact matches any user displayName in the scan.
4. **U13 — "Configuration only" replaced.** Add `impact.fallbackLabel` as an optional string to the content-schema types and the package META validator. In the impact formatter, add the fallback chain: (a) affected-people count → count format; (b) `package.meta.impact?.fallbackLabel` → that string; (c) `"—"`. Remove `"Configuration only"` as a return value. Test: no plan row shows "Configuration only" on any fixture. The fallback labels are authored in B8.
5. Update snapshots with `[snapshots]`.

DON'T: touch the step body, tiles, Implementation, engine, or any opened-step rendering.

DONE-WHEN: no row subtitle, no "next" pill, no person name in impact, no "Configuration only" on any fixture; suite green; committed.

---

## B3 — Step body layout: two-column, remove What-to-do, milestone, Planned work

READ: RUN-CONTEXT-B.md; MASTER (U1, U2, U3, U4, U5); `src/ui/surfaces/StepSections.tsx` (or the component that renders the opened step body — find by grepping `What to do` or `NEXT MILESTONE`); `src/ui/surfaces/stepContract.ts`.

DO:
1. **U1 — remove What-to-do section.** In the step body renderer, stop rendering the section with heading "What to do". The content stays in the packages; the renderer no longer shows it. The IAMAI input controls that were inside What-to-do (pickers, radios, search, Save) are re-parented to the action column in step 2. Test: no `<h4>` with text "What to do" on any opened step.
2. **U2 — two-column grid layout.** Wrap the step body in `display: grid; grid-template-columns: 1fr 260px; gap: 2rem; align-items: start;`. Left column: Why → Readiness → Implementation → Done when. Right column: new `StepActionColumn` component containing the milestone date and any input controls the step has. Media query: `@media (max-width: 900px) { grid-template-columns: 1fr; }`. The input controls previously rendered in What-to-do are now children of StepActionColumn. If a step has no inputs, the action column shows only the milestone date (or is omitted if the milestone has no date — but keep it for the layout consistency). DOM order: action column appears between Readiness and Implementation so screen readers encounter it in the right place (U5).
3. **U3 — milestone sub-text.** In the milestone renderer, replace the fallback text-generation logic with: `package.meta.milestone?.actionText || ''`. Add `milestone.actionText` as optional string to the content-schema types and validator. If empty, render only the date. No sub-text. The existing generic phrases ("Make the object this step names", "Make the decision", "Resolve prerequisites") are all removed. The per-step content pass (B8) fills in specific text where needed.
4. **U4 — remove Planned work banner.** In the Implementation section renderer, remove the "Planned work" div and all conditional rendering that shows it. The channels render unconditionally (B5 handles this). Test: no "Planned work" text on any opened step.
5. **U5 — DOM order.** Solved by step 2's grid placement: the action column div is between Readiness and Implementation in the DOM.
6. Update walk assertions and page contracts for the new DOM structure: the What-to-do heading is gone, the action column exists, the milestone is inside it.
7. Update snapshots with `[snapshots]`.

DON'T: touch the engine, lane states, tiles (B4 handles those), or Implementation channel visibility (B5 handles that).

DONE-WHEN: no "What to do" heading; two-column grid renders on the demo with milestone in the right column; no "Planned work" banner; walk assertions updated; suite green; committed.

---

## B4 — Readiness tiles: compact/expand, transitive suppression

READ: RUN-CONTEXT-B.md; MASTER (U6, U7); `src/ui/surfaces/stepContract.ts` (engineTiles); the tile component in the step body renderer; R-READY; `scripts/build-dependency-data.mjs` or `dependency-data.json` (for U7's transitive reduction).

DO:
1. **U6 — compact/expand pattern.** In the tile component: split each tile into a summary line (always visible: icon + label + one-line status + expand chevron, ~48px) and a detail div (hidden by default, shown on click). The summary line uses `role="button"` and `aria-expanded`. Click toggles the detail. The tile grid uses `align-items: start`. Expanded state resets on step close. Test: on Emergency Access, all tiles render as one-line summaries; clicking RESILIENCE expands it; adjacent tiles don't grow; closing and reopening resets.
2. **U7 — suppress transitive prerequisite tiles.** In `engineTiles` or the tile renderer: collect all prerequisite step IDs. For each pair, check if one is reachable from the other in `dependency-data.json`. If X is reachable from Y (Y is an ancestor of X), suppress Y's tile. Use a BFS or pre-computed reachability. Only suppress PREREQUISITE tiles, not THRESHOLD/AFFECTED PEOPLE/DECISION. Test: on Block Legacy Auth, only the Exclusions Group prerequisite tile shows; Emergency Access is suppressed.
3. Update snapshots with `[snapshots]`.

DON'T: touch the engine, layout, Implementation, or plan rows.

DONE-WHEN: tiles render collapsed by default; expand on click works; transitive tiles suppressed; suite green; committed.

---

## B5 — Implementation: always visible, channel filtering, sticky viewer, icon buttons, disabled copy

READ: RUN-CONTEXT-B.md; MASTER (U14, U15, U16, U17, U18); `src/ui/surfaces/stepPackage.ts` (packageStateOf); the Implementation section renderer; the expand viewer dialog component; R-RENDER §3.3–§3.7.

DO:
1. **U14 — channels always visible.** In the step body renderer: unconditionally render channel tabs and content when the package has authored channels (non-empty `channels` array in CONTENT.md). Remove the condition that hides channels when `packageStateOf` returns `plannedWork` or `nothingToSubmit`. The `nothingToSubmit` text "IAMAI offers no artifact for this policy as it stands" is removed. For baseline-conflict steps (where `packageStateOf` returns `sourceConflict`): render the message "Not enough information to provide implementation guidance. The baseline defines this policy two ways; resolve the conflict before implementation is available." with no channel tabs. Add this string to `content.json` under `pages.plan.implementation.baselineConflict`. Test: Block Legacy Auth (Enforced, prerequisites not Complete) shows Entra/JSON/AI Info tabs. Admin Portals (baseline conflict) shows the conflict message with no tabs.
2. **U15 — filter channels by step type.** In the channel tab renderer: if the step's work type (from package META `workType` or the step index) is not `policy`, filter out PowerShell and JSON tabs. The authored content stays in the packages; the renderer doesn't show those tabs. If `workType` is not available in the data, add it to the step index build script from the package META. Test: Emergency Access and Exclusions Group show only Entra and AI Info tabs. Block Legacy Auth shows all four.
3. **U16 — sticky viewer header.** In the expand viewer dialog: move the channel tabs from inside `dialog-content` (the scroll container) to inside `dialog-header`. Make `dialog-header` sticky: `position: sticky; top: 0; z-index: 1; background: var(--surface-2);`. The dialog uses `display: flex; flex-direction: column;` and `dialog-content` gets `flex: 1; overflow-y: auto;`. Test: open an Implementation viewer, scroll down 500px — tabs and buttons remain at the top.
4. **U17 — icon-only buttons.** In both the inline Implementation and the dialog header: change Copy and Expand/Minimize buttons from text to icon. Use `aria-label` for accessibility. Icons: copy = existing copy icon or `ti-copy`; expand = `ti-arrows-maximize`; minimize = `ti-arrows-minimize` or `ti-x`. Test: no visible text "Copy implementation", "Expand implementation", or "Minimize" on any button.
5. **U18 — disabled copy with tooltip.** The Copy button reads `packageStateOf`: if the state is not executable (`plannedWork`, `nothingToSubmit`, or non-executable), the button is disabled with a `title` attribute showing the reason (from `packageStateOf`'s reason field). If executable or `partial` (safe correction), enabled. CSS: `button:disabled { opacity: 0.4; cursor: not-allowed; }`. Test: on Exclusions Group, Copy is disabled with tooltip "Values not resolved: group name, group mail nickname, group members."
6. Update snapshots with `[snapshots]`.

DON'T: touch the engine, layout (B3), tiles (B4), or plan rows (B2).

DONE-WHEN: enforced policies show channels; non-policy steps show only Entra/AI Info; sticky viewer header stays on scroll; icon-only buttons; disabled copy with tooltip; baseline-conflict message on Admin Portals; suite green; committed.

---

## B6 — Data: pre-fill pickers, exclusion-group investigation

READ: RUN-CONTEXT-B.md; MASTER (U24, U27); `src/roadmap/coverage.ts`, `src/roadmap/generate.ts`, `src/ui/surfaces/stepPackage.ts` (bindings); STEPS/step-exclusions-group.md, STEPS/step-block-legacy-auth.md.

DO:
1. **U27 — exclusion-group investigation.** Read the plan record's exclusion-group step. Read the scan's group data for "Breakglass Exclusion" or "Core - Exclusions". Read Block Legacy Auth's policy `conditions.users.excludeGroups`. Determine why the step reports a missing exclusion when the group exists. Document the root cause in BLOCKED.md under "U27 investigation". If the root cause is: baseline mapping not resolved → document that the mapping resolver needs to be completed. If the root cause is: ID mismatch → fix the matching logic. If the root cause is: the step evaluates against the plan's target (which includes the mapping reference) and the mapping is unresolved → document that the mapping resolution is the prerequisite, and the current behavior is technically correct but needs the mapping to be resolved.
2. **U24 — pre-fill pickers.** In the step input components (account picker, group picker, strength picker): add a `matchedObjects` or `defaultValue` prop that reads from the scan matching. When the scan finds an unambiguous match and the plan record has no saved value, pre-fill the picker with the match. The pre-fill does NOT write to the plan record — only Save does. Add a visual indicator on the pre-filled chip (e.g. a subtle "matched" label or a different background). Test: on a tenant where the exclusions group exists but hasn't been confirmed, the picker shows the group pre-filled; the badge still reads "Decision" (not Completed); clicking Save writes the record and the badge updates.
3. Update snapshots with `[snapshots]` if any fixture state changes.

DON'T: touch the renderer, layout, tiles, or engine.

DONE-WHEN: U27 root cause documented; pre-fill works on at least one picker (exclusions group or auth strength); suite green; committed.

---

## B7 — Content fixes: channel gaps, generation rules, conditional inputs

READ: RUN-CONTEXT-B.md; MASTER (decisions 18, 19, 20); STEPS/step-sign-in-risk-high.md, STEPS/step-user-risk.md, STEPS/step-admin-portals.md, STEPS/step-workload-identity.md, STEPS/step-device-code.md.

DO:
1. **High-Risk sign-in channels.** Copy channel content from `docs/implementation-content/s-goal-sign-in-risk-medium/` CONTENT.md to `s-goal-sign-in-risk/` CONTENT.md. Adjust risk level from medium to high in the policy configuration values (riskLevels array, display name). Verify the JSON body targets high risk. Run the content validator: `node scripts/compile-implementation-content.mjs --validate-library`.
2. **High-Risk user-risk channels.** Copy from `s-goal-user-risk-medium/` to `s-goal-user-risk/`. Adjust risk level. Validate.
3. **Workload-identity generation condition.** In `generate.ts` or `registry.ts`: add a condition for `s-goal-workload-identity-block`: only generate when the scan detects a user holding the Directory Synchronization Accounts role (GUID `d29b2b05-8046-44ba-8758-1e26182fcf32` — verify against Graph documentation). If no such user exists, skip generation. Test on a fixture without a sync account: the step does not appear. Test on a fixture with one: it does.
4. **Device-code conditional input.** Add `decisions.deviceCodeWorkflows` to the plan record schema. The B1 completion gate already handles null checks. The input component (None / Yes: add exceptions) is authored in the package CONTENT.md for `s-goal-block-device-code` under the `whatToDo` field (which B3 moves to the action column). The input is a radio (None) + search (for exception accounts). Add the condition `device-code-workflows-exist` to `dependency-data.json` as a conditional enforcement edge.
5. Update snapshots with `[snapshots]`.

DON'T: touch the renderer, layout, engine, or any file outside the content packages and generation logic.

DONE-WHEN: High-Risk steps have authored channels; workload-identity skips generation on fixtures without sync; device-code conditional input exists; validator passes; suite green; committed.

---

## B8 — Per-step content pass: Source checked, Done-when, Learn links, impact labels, milestone text

READ: RUN-CONTEXT-B.md; every file in STEPS/; R-SCHEMA (for field formats).

DO:
For each step-findings doc in STEPS/, apply the content changes it specifies. Work through them in directory order. For each step:
1. **Source checked:** If the doc says "Add checkedOn", add `"checkedOn": "2026-09-12"` to the `verifiedSources` array in that package's META.json. If the doc says "present ✓", skip.
2. **Done-when:** If the doc provides a target Done-when text, update the `doneWhen` field in the package CONTENT.md. If it says "keep", skip.
3. **Learn link:** If the doc says "Add inline Learn link", append ` Learn →` to the end of the `why` field text in the package CONTENT.md. The URL target is the relevant Microsoft Learn page — search learn.microsoft.com for the policy type and use the most specific URL. If the doc says "present ✓", skip.
4. **Impact fallback label:** Add `"impact": { "fallbackLabel": "<label>" }` to the package META.json using the label from the step doc (e.g. "Authentication methods" for passkey settings, "Emergency access" for break-glass, "Network locations" for trusted location). If the step doesn't specify one, use the step title shortened to 2–3 words.
5. **Milestone actionText:** Add `"milestone": { "actionText": "<text>" }` to the package META.json. Use the specific action from the step doc if provided. If the step doc says "Remove per U3" without a replacement, leave the field absent (the renderer shows date only).
6. Run the content validator after every 5 packages: `node scripts/compile-implementation-content.mjs --validate-library`.
7. Update snapshots with `[snapshots]` at the end.

DON'T: touch the renderer, engine, layout, or any TypeScript file.

DONE-WHEN: every step-findings doc's content changes are applied; validator passes; no "Configuration only" in any fixture (B2 removed the fallback, B8 provides the labels); suite green; committed.

---

## B9 — Gauntlet, deploy, live check, report

READ: RUN-CONTEXT-B.md; BLOCKED.md.

DO:
1. **Gauntlet — once:**
   ```
   npm test
   npm run build:site
   node scripts/compile-implementation-content.mjs --validate-library
   node scripts/compile-implementation-content.mjs --registry
   npm run walk
   ```
   Then smoke, allowlist, external health. P0 = 0.

2. **Push and deploy.** Push to main. Wait for CI. Confirm deployed HEAD.

3. **Live check (Chrome, desktop)** on getiamai.com/planner demo, both scans:
   1. No row subtitles on any row
   2. No "next" pill
   3. No "Configuration only" in impact column
   4. No "Planned work" banner on any opened step
   5. No "What to do" heading on any opened step
   6. Two-column layout: milestone in right column on a step with inputs
   7. Tiles collapsed by default; clicking expands
   8. Enforced no-drift step reads Completed (check via Show completed)
   9. Enforced with-drift step reads Ready · Correct with visible Implementation channels
   10. Threshold tile on enforced policy uses informational text (not gate language)
   11. Devices step badge reads "Ready · Decision"
   12. Non-policy step shows Entra + AI Info only (no PowerShell)
   13. Expand viewer: scroll content, tabs + copy stay at top
   14. Copy button disabled with tooltip on a step with unresolved values
   15. Passkey step present; campaign waits on it
   16. No "Nothing to submit yet" on any step (except Admin Portals conflict message)
   17. No forbidden words (Blocked, Held, Needs attention, Skipped, Set aside)
   18. No console errors

4. **Report:**
   ```
   ## FIXED
   | # | Root cause | Change |

   ## DEFERRED
   From BLOCKED.md only.

   ## LANE COUNTS
   Demo Initial: Ready / Up Next / On Hold / Completed / Deferred
   Demo Follow-up: Ready / Up Next / On Hold / Completed / Deferred

   ## VALIDATION
   npm test / build / validator / registry / walk P0·P1·P2 / smoke / allowlist / health

   ## LIVE CHECK
   1–18 PASS/FAIL

   ## DEPLOYMENT
   Commits / CI / deployed HEAD
   ```

Stop after the report.
