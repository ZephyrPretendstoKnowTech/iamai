# Readiness taxonomy: tiles, blockers, edges (as implemented)

This file is taken from the code at `4cde3e6` (main). It records what the code does, not what the playbook intends. "not found" means the code read for this file does not settle the point.

## Sources

- `src/ui/surfaces/StepSections.tsx` (ReadinessSection, Tile, MARK)
- `src/ui/surfaces/stepContract.ts` (ReadinessTile, ReadinessTone, PrerequisiteBlocker, readinessOf and its tile builders, fixOf, standingOf)
- `src/ui/surfaces/stepPackage.ts` (mergeReadiness, RESULT_TONE, SEVERITY)
- `src/ui/surfaces/ContentStep.tsx` (lines 326, 350, 507–511: wiring)
- `src/ui/surfaces/planBoard.ts` (BOARD.blockers, laneLabelOf, holdLabelOf, readinessBlockersOf)
- `src/ui/surfaces/planLanes.ts` (observe, prerequisiteOf, prerequisites, tenantStateOf, laneReadings)
- `src/ui/surfaces/planState.ts` (barKeyOf)
- `src/ui/surfaces/readinessCells.ts` (MFA Readiness worklist cells; no Plan tiles, see note below)
- `src/ui/surfaces/whoBlocks.ts` (Who evidence; no tiles)
- `src/ui/shell/routes.ts` (returnToStep)
- `src/ui/app.css` (lines 2340–2472, Readiness styles)
- `src/actionability/lanes.ts` (BlockerKind, Blocker, BLOCKER_ORDER, unresolvedOn, layersOf, milestoneReached, deriveUncached)
- `src/actionability/sorting.ts` (unlockCounts, sortUpNext)
- `src/actionability/parseDependencyDoc.ts` (PrerequisiteKind, Edge)
- `src/actionability/dependency-data.json` (counted with a read-only `node -e` script)
- `src/content/implementation/protocol.ts` (READINESS_RESULTS)
- `src/content/implementation/project.ts` (PackageReadinessTile, packageReadiness, readinessSafely)
- `src/roadmap/types.ts` (roadmap Blocker, Action.readinessGate, Action.escapeHatch, Action.missing)
- `src/roadmap/generate.ts` (lines 1030–1150, 1170–1180, 1260–1330, 1490–1615, 1895–1980)
- `src/roadmap/holds.ts` (HoldKind, holdOf, markHoldChains)
- `src/roadmap/stateReason.ts` (blockedReasonFor, holdReasonFor, holdWaitsOn)
- `src/roadmap/blockerSteps.ts` (GATING_SUBJECTS, blockerStepId, gateReason, gateFor)
- `src/roadmap/constants.ts` (readiness thresholds, OBSERVATION_DAYS)
- `src/roadmap/tracking.ts` (lines 410–417, the two report-only gates)
- `src/derive/readyWhen.ts` (readyWhen)
- `src/copy/reasons.ts` (BLOCKED_REASON, READINESS_MEASURE)
- `docs/design/content.json` (these keys only, found with grep: `stepContract.readiness.tiles` / `.bar`, `stepContract.hardening.tiles`, `stepContract.condition`, `stepContract.foundLabel`, `stepContract.foundReadiness`, `fixStep`, `fixMapping`, `fixReview`, `confirm.control` / `confirmedControl`, `pages.plan.blocked`, `engine.milestone`, `engine.readiness.notMeasured`)
- `docs/product/actionability/IAMAI-Actionability-Dependency-Playbook.md` (§6, §8, §15, §16.1 only, for comparison)
- `docs/product/actionability/RUN-CONTEXT.md` (grep only)

---

## How a tile is drawn (common to every row of Table 1)

- **Region.** `ReadinessSection` (StepSections.tsx:253–309) renders `<section class="step-section readiness-section">` with heading `pages.app.plan.stepContract.readiness.heading` = "Readiness" (content.json:1312).
- **Unresolved strip.** `<ul class="readiness-strip unresolved tiles-N">`, where N = min(tile count, 4) (StepSections.tsx:237, 269). CSS gives 4, 3, 2 or 1 grid columns (app.css:2347–2364).
- **Nothing unresolved.** `<p class="readiness-clear">` shows a `readiness-status readiness-status-good` glyph ✓, then `readiness.tiles.clear` = "Clear" and `readiness.tiles.clearNote` = "Nothing outstanding changes the next action." (StepSections.tsx:281–287; content.json:1335–1336).
- **Satisfied evidence.** `<details class="readiness-satisfied">` with summary `readiness.tiles.satisfied` = "{n} satisfied", over `<ul class="readiness-strip satisfied tiles-N">` (StepSections.tsx:289–294; content.json:1337).
- **One tile.** `<li class="readiness-tile readiness-tile-{tone}">`, then `.readiness-tile-head` holding `.key-label` (the label) and the glyph span `readiness-status readiness-status-{tone}`, then `<strong>` (the value) (StepSections.tsx:329–338).
- **Glyph by tone** (`MARK`, StepSections.tsx:240):
  - `good` = ✓
  - `warn` = !
  - `wait` = …
  - `info` = no glyph
- **Tone colours.** `.readiness-status-good` uses `--success-text`. `.readiness-status-warn` and `.readiness-status-wait` both use `--attention-text` (app.css:2453–2459). No CSS rule was found for `.readiness-tile-{tone}` itself, so the tile box looks the same whatever its tone.
- **Unresolved vs satisfied.** A tile is unresolved when its tone is `warn` or `wait`. Fact tiles with `good` or `info` tone go to `satisfied` (stepContract.ts:1180, 1186). Package tiles also count as open while `confirm.satisfied` is false (stepPackage.ts:511).
- **Disclosure.** `<details class="readiness-more">` has summary `readiness.tiles.detail` = "Why" (content.json:1338). It renders only when the tile has a `note`, a link or `extra` (StepSections.tsx:327, 339–346).
- **Links** (StepSections.tsx:326):
  - An `href` link renders `<p class="readiness-link"><a href="#/plan/<stepId>">`, labelled `readiness.tiles.openStep` = "Open {step}". The href comes from `returnToStep` (routes.ts:97–99; stepContract.ts:1098).
  - A `mappings: true` link renders `<button class="inline-link">`, labelled `readiness.tiles.openMappings` = "Open Baseline mappings". Its onClick is `onOpenMappings`, which Plan passes in (Plan.tsx:596) to open Plan settings → Baseline mappings. It is null when printing (ContentStep.tsx:508).
- **Confirm button.** Only for a package tile with `confirm`: `<button class="inline-link readiness-confirm">` reading "Confirm", or "Confirmed" once confirmed (`stepContract.confirm.control` / `confirmedControl`, content.json:1600–1601). onClick calls `onConfirm(tile.key)`, which opens the step's `confirm` dialog (ContentStep.tsx:507).
- **Order of tiles** (stepContract.ts:1179–1185), then `mergeReadiness` (stepPackage.ts:503–515):
  1. unresolved fact tiles, except `resilience`
  2. fix tiles
  3. engine tiles
  4. open package tiles
  5. `resilience` (always last)

## Table 1: Readiness tile kinds

Content keys below are relative to `pages.app.plan.stepContract` (stepContract.ts:52, 156) unless a full path is given.

| kind (tile `key`) | label: text (key) | value text (key) | tone / glyph | produced by (file:function, condition) | resolved by | link |
|---|---|---|---|---|---|---|
| `emergency` | "Emergency access" (`hardening.tiles.access`, content.json:1297) | "Available" (`hardening.tiles.available`) or "Not available" (`hardening.tiles.unavailable`) | `good` ✓ when available, else `warn` ! | stepContract.ts:1070–1077 `emergencyTiles`, when `step.emergency` is set and the step is not set aside. The note lists each account's standing when there is more than one account (`hardening.tiles.accountMinimum` / `accountHardening` / `accountMeets` / `accountUnchecked`; stepContract.ts:788–794). | `step.emergency.minimum === 0`: every minimum safety check on the break-glass report passes (generate.ts:1141–1174) | none |
| `resilience` | "Resilience" (`hardening.tiles.resilience`) | "Meets recommendations" (`meets`), "Needs attention" (`needsAttention`), or "Deferred to Cleanup" (`deferred`) when `emergency.deferredAt` is set | `good` ✓ when `hardening === 0`, else `warn` ! | stepContract.ts:1083–1086. The note is `hardening.leadBlocked`, `leadDefer` or `deferredOn`. `extra` is `HardeningBody` with "Defer hardening" / "Undo deferral" buttons (ContentStep.tsx:510–511; StepSections.tsx:591–619). | `step.emergency.hardening === 0`. A deferral changes only the value; the tone stays `warn`. | none |
| `baseline` | "Baseline definition" (`readiness.tiles.baseline`, content.json:1318) | "Conflict unresolved" (`readiness.tiles.conflictValue`) | `warn` ! | stepContract.ts:1035 `stateTile`, when `state.condition === 'baseline-conflict'` (set at generate.ts:1947–1973). Note: `engine.milestone.conflict`. | a reviewed baseline no longer lists the goal in `conflictGoals` (generate.ts:1948) | none |
| `evidence` | "New evidence" (`foundLabel.observation`, content.json:1219) | "Review required" (`condition.review-required`) | `warn` ! | stepContract.ts:1037, when `state.condition === 'review-required'`. Note: the observation note, or `milestone.gatedBy`. | the condition leaves `review-required` (lifecycle `heldForReview`; owner not found in the files read) | none |
| `decision` | "Decision" (`readiness.tiles.decision`) | "Needs decision" (`condition.needs-decision`) | `warn` ! | stepContract.ts:1038, when `state.condition === 'needs-decision'`. That condition comes from roadmap `decision` blockers (Table 2). Note: `engine.milestone.decide`. | the device plan is answered (generate.ts:1044) or the exclusions choice is made (`awaitsOperator` false, generate.ts:1137) | none |
| `coverage` | "Existing coverage" (`readiness.tiles.coverage`) | the stage word (`stageOf`) | `good` ✓, so it goes to satisfied | stepContract.ts:1039, when `state.satisfied`. Note: the `in-place` finding. | already resolved; the tile is evidence | none |
| `gate` | "Threshold" (`readiness.tiles.gate`) | `readinessGate.value`, e.g. "29%" or "not measured" (`engine.readiness.notMeasured`, content.json:293) | `warn` ! (never ✓) | stepContract.ts:1042–1043, when `step.action.readinessGate` is set and status is not done or skipped. The gate is set at generate.ts:1517–1523 when the family threshold is unmet or unmeasured: mfa/guest 90, admin 100, device 80 (constants.ts:2–4). Note: `foundReadiness` = "{measure} is {value} today; enforcement waits for {threshold}." (content.json:1244). | readiness percent reaches the threshold on a later scan | none |
| `observation` | "Observation" (`readiness.tiles.observation`) | "Until {date}" (`readiness.tiles.observationUntil`), or the stage word when undated | `wait` … | stepContract.ts:1044, when `milestone.kind === 'observe'` and no earlier state tile applied | both report-only gates close (see Table 3, report-only gates) | none |
| `exclusions` | "Exclusions" (`readiness.tiles.exclusions`) | "Reaches emergency access" (`exclusionsReached`) or "Not proven" (`exclusionsUnproven`) | `warn` ! | stepContract.ts:1054–1062 `exclusionsTile`, when `action.emergencyExposure.reached` or `.unproven` is non-empty and the step is not satisfied, set aside or in conflict. Note: `implementation.because`. | Foundation A records no exposure (`emergencyExposure` lists empty) | none |
| `people` | "Affected people" (`readiness.tiles.people`) | the population line, or "Not established" (`peopleUnknown`) | `info` (no glyph, goes to satisfied) when known; `warn` ! when unknown | stepContract.ts:1091–1095 `peopleTile`, whenever `whoOf` is non-null (stepContract.ts:493–501) | reach is settled (`reached(step)` non-null) | none |
| `implementation` | "Implementation" (`readiness.tiles.implementation`) | "Unavailable" (`readiness.tiles.unavailable`) | `warn` ! | stepContract.ts:1162–1167 `implementationTile`: no fixes, implementation not offered, `unavailableReason` non-null, and not satisfied, set aside, conflict, needs-decision or review-required. Note: `implementation.because`. | `unavailableReason(step)` becomes null | none |
| `step:<stepId>` / `missing:<stepId>` (fix) | "Prerequisite step" (`readiness.tiles.prerequisite`) | the prerequisite step's content title | `warn` ! | stepContract.ts:1113–1116 `fixTiles` over `fixOf`. `step:` comes from a roadmap `step` blocker (stepContract.ts:597–601). `missing:` comes from `action.missing[].stepId` whose content step exists (stepContract.ts:578–579). Note: `fixStep` = "Finish {step} first." | a scan regenerates the plan without that blocker / missing entry | `href` `#/plan/<stepId>` |
| `mapping` (fix) | "Baseline mapping" (`readiness.tiles.mapping`) | "Baseline references an unmapped group" (`pages.plan.blocked.sourceMapping`, content.json:649) | `warn` ! | stepContract.ts:1118, from `fixOf` when an `action.missing` entry has `decision` and no content step (stepContract.ts:581). Note: `fixMapping`. | the reference is mapped or omitted in Plan settings → Baseline mappings | button, `onOpenMappings` |
| `review:<memberKey>` (fix) | "Review" (`readiness.tiles.review`) | "Review required" (`condition.review-required`) | `warn` ! | stepContract.ts:1119, from `fixOf` when `heldForReview(step)` and the member's `change.reviewRequired` (stepContract.ts:556–562). Note: `fixReview`. | the member's review flag clears | none |
| `check:<i>:<ruleKey>` (fix) | "Check" (`readiness.tiles.check`) | the filled `checkFixes` template for the failing check | `warn` ! | stepContract.ts:1120, from `fixOf` over `ex.failingChecks` (stepContract.ts:569–573) | the validation check passes (it drops out of `failingChecks`) | none |
| `<kind>:<label>` (fix; roadmap `readiness` / `setup` / `evidence` blocker with a binding) | "Prerequisites" (`readiness.tiles.blockers`) | the blocker's `binding` sentence, e.g. "when 1 safe way in for the signed-in account exist (now 0)" | `warn` ! | stepContract.ts:1121, from `fixOf` at stepContract.ts:606. Skipped for the step's own threshold (596), for every readiness blocker while the schedule's transition is `createReportOnly` (591, 596), for `decision` (605), and for everything when the condition is `baseline-conflict` (549). | the roadmap blocker is not re-emitted on the next scan | none |
| `engine:step:<id>` / `engine:suspendedPrerequisite:<id>` | "Prerequisite on hold" / "Deferred prerequisite" (`BOARD.blockers.step` / `.suspendedPrerequisite`, planBoard.ts:100–101; hard-coded, not in content.json) | the prerequisite's content title | `warn` ! when `abnormal`, else `wait` … | stepContract.ts:1139–1143 `engineTiles`, from `readinessBlockersOf` (planBoard.ts:215–218) over `LaneReading.blockers` (lanes.ts:223–246). Skipped when a fix tile already has `step:<id>` or `missing:<id>`. Note: `fixStep`. | the prerequisite reaches the edge's milestone (lanes.ts:185–205), or is un-deferred | `href` `#/plan/<id>` |
| `engine:sourceMapping:<id>` | "Baseline mapping" (`readiness.tiles.mapping`) | "Baseline references an unmapped group" (`BOARD.blockers.sourceMapping` = `pages.plan.blocked.sourceMapping`) | `warn` ! / `wait` … | stepContract.ts:1145–1148. Skipped when the fix `mapping` tile is present. | the Baseline mapping is answered | button, `onOpenMappings` |
| `engine:<kind>:<id>` (decision, fact, missingObject, license/platform, sourceConflict, baselineSafetyConflict, unsupported) | label = value = `BOARD.blockers[kind]` (planBoard.ts:91–103) | same as the label | `warn` ! / `wait` … | stepContract.ts:1153. Skipped: conflicts when the `baseline` tile is present (1150); `decision` when a `decision` tile is present or the condition is needs-decision (1151); `missingObject` when any `missing:` fix tile is present (1152). No note. | see Table 2 | none |
| package tile (`key` = package tile id) | the package's `label` / `gate` (package content, not content.json) | the rule result, one of `READINESS_RESULTS` = Ready, Review required, Unknown, Blocked, Not applicable (protocol.ts:98) | `RESULT_TONE` (stepPackage.ts:492): Ready `good` ✓; Review required, Unknown, Blocked `warn` !; Not applicable `info` | project.ts:628–659 `packageReadiness`: the first rule whose `if` holds; a tile with no matching rule is not shown. Merged at stepPackage.ts:503–515. Dropped when `gateKey` names a runtime tile already present (506). Ordered unconfirmed-first, then by `SEVERITY` (493, 507). | the rule condition changes, or the person confirms (`confirm.satisfied`) | Confirm / Confirmed button (`onConfirm(key)`) |

**Bar headline.** The bar is not a tile. Its `bar.key` is one of: deploy, attention, observe, enforce, verify, preserve, decide, resolve, review, blocked, correction, deferred, conflict, restore, none. The text comes from `readiness.bar.*` (content.json:1344–1360), e.g. "Ready now", "Held", "Blocked". The key is chosen by `barKeyOf` (planState.ts:157–165), falling back to `standingOf` (stepContract.ts:1021–1029, 1192–1195).

**readinessCells.ts is not a Plan tile source.** It renders the MFA Readiness worklist cells, using `pages.readiness.*` and `ReadinessState` (Ready / Needs proof / Needs setup / Unknown). No Plan tile kind is produced there.

## Table 2: Blocker kinds

There are two separate blocker vocabularies.

### 2a. Engine `BlockerKind` (lanes.ts:66–68)

Order is `BLOCKER_ORDER` (lanes.ts:97–100). Every engine blocker reaches the step through `readinessBlockersOf` and then `engineTiles`. The On Hold group heading and the row's lane label read `BOARD.blockers[kind]` (planBoard.ts:175–207).

| kind | label: text (source) | visual | produced by | resolved by | link |
|---|---|---|---|---|---|
| `baselineSafetyConflict` | "Baseline safety conflict" (planBoard.ts:92) | engine tile `warn`; on the row, "On Hold · Baseline safety conflict" | Graph edge `s-goal-unmanaged-browser:enforce ← baselineSafetyConflict:unmanaged-browser-emergency-exclusion` (the only one in dependency-data.json). planLanes.ts:111–113 reads it `blocked` iff that step's condition is `baseline-conflict`, else `resolved`. Counted only when the next action is `enforce`. planLanes never emits it as an observed blocker. | condition leaves `baseline-conflict` | none; tile skipped when `baseline` tile present (stepContract.ts:1150) |
| `sourceConflict` | "Baseline conflict" (planBoard.ts:93) | as above | Edge `s-goal-admin-portals-protected:create ← sourceConflict:admin-portals-target` (planLanes.ts:111–113). Also an observed blocker on any step whose condition is `baseline-conflict`, id = `state.conflictSource` (planLanes.ts:71). | condition leaves `baseline-conflict` | none; skipped when `baseline` tile present |
| `sourceMapping` | "Baseline references an unmapped group" (`pages.plan.blocked.sourceMapping`) | engine tile `warn`, label "Baseline mapping" | The 14 graph edges (`sourceMapping:62d67e66` on 14 policy creates) are always read `resolved` (planLanes.ts:116–121). The real source is observed: each `action.missing` entry with `unreadable` or `decision` gives id `sourceMapping:<first 8 of token>` plus `role` (planLanes.ts:79–84). For runtime-only rows it is carried as the reason (planLanes.ts:205–207). | mapping answered, so `action.missing` no longer flags it | button `onOpenMappings`; skipped when fix `mapping` present |
| `license/platform` | "Licence or platform" (planBoard.ts:96) | would be engine tile `warn` | not found at runtime: no edges of this kind in dependency-data.json, and planLanes.observe never emits it. `prerequisiteOf` would read one `blocked` (planLanes.ts:122–123). | not found | none |
| `decision` | "Decision" (planBoard.ts:97) | engine tile `wait` (healthy) | Edge `s-goal-workload-identity-block:create ← decision:workload-identity-type`. Read `actionable` iff that step's condition is `needs-decision`, else `resolved` (planLanes.ts:114–115). An actionable decision is healthy (`abnormal: false`, lanes.ts:236). planLanes never produces a `blocked` decision, so an abnormal decision is not found. | condition leaves `needs-decision` | none; the tile is always skipped in practice, because it is only unresolved while the condition is needs-decision (stepContract.ts:1151) |
| `fact` | "Tenant fact" (planBoard.ts:98) | engine tile `warn` | Observed from roadmap `setup` blockers as id `setup:<n>` (planLanes.ts:72), but no producer of `setup` blockers was found in `src` (non-test). Also the fallback kind for non-step edges of kind `fact` / `evidence` / `time/evidence-window` / `suspendedPrerequisite` in `nonStepKind` (lanes.ts:211–218); no such edges exist in the data. | not found | none |
| `missingObject` | "Missing object" (planBoard.ts:99) | engine tile `warn` | Observed: an `action.missing` entry (not unreadable, not decision) whose `stepId` is null, or whose maker step is neither a graph prerequisite of this action nor done. Id `missingObject:<stepId or token>` (planLanes.ts:85). Also `nonStepKind` for a `fact` edge in state `actionable` (lanes.ts:215); no such edges. | the scan finds the object, or the maker step is done | none; skipped when any `missing:` fix tile is present (stepContract.ts:1152). That fix tile links to the maker step. |
| `step` | "Prerequisite on hold" (planBoard.ts:100). Used for every step prerequisite, healthy ones included. | engine tile `warn` if the prerequisite's lane is On Hold, else `wait` … | lanes.ts:240–243, for each direct graph edge on the next action whose milestone is unmet. `ordinal` = the prerequisite's substatus ordinal (lanes.ts:103–106). The Up Next row label becomes "Up Next · After {step}" (planBoard.ts:179–182). | prerequisite reaches the edge's milestone (`created`, `complete`, `enforced`, `ready-to-enforce`, `minimum-satisfied`, `hardening-complete`; lanes.ts:185–199) | `href` `#/plan/<id>` |
| `suspendedPrerequisite` | "Deferred prerequisite" (planBoard.ts:101) | engine tile `warn` (always abnormal) | lanes.ts:227–231 (any applicable, unsatisfied edge of any action) and 241 (next-action edge), when the prerequisite's lane is `Deferred`. Deferred = roadmap status `skipped` (planLanes.ts:150). | the owner un-skips the prerequisite. The "condition becomes not applicable" path is not found, because planLanes supplies no `conditions` (planLanes.ts:149). | `href` `#/plan/<id>` |
| `unsupported` | "Not supported" (planBoard.ts:102) | engine tile `warn` | planLanes.ts:87–88, on an open policy step (not done or skipped) whose `unavailableReason` is `unmatched-pair` or `no-operation` | `unavailableReason` becomes null | none |

### 2b. Roadmap `Blocker` kinds (roadmap/types.ts:252–272)

These are written by `generate.ts` and read by `fixOf`, `holdOf` and `blockedReasonFor`.

| kind | label field / binding text | visual | produced by | resolved by | link |
|---|---|---|---|---|---|
| `step` | label `create-object` or the gate's "after: {stepTitle}" (`pages.plan.blocked.after`) | fix tile `step:<id>`, "Prerequisite step", `warn` | generate.ts:1282–1286 `blockByStep`, from two places: a template placeholder's maker step (1289–1293, `PLACEHOLDER_STEP` in resolvePolicy.ts:36), and the emergency gate on every deny-capable goal step (1561–1562). The gate is `s-prereq-break-glass` first, then `s-prereq-exclusion-group` (generate.ts:1175–1177; blockerSteps.ts:22–29, 121–132). `held: true` when the waited-on step is itself held (holds.ts:99–116). | the next generation no longer adds it: the gate is null once both gating reports have no blocking checks and both steps are done (generate.ts:1175–1177). The placeholder case is not settled by the files read. | `href` `#/plan/<stepId>` |
| `setup` | `questionNumber`, `binding` | would become fix tile "Prerequisites" and engine `fact` | not found (type only) | not found | none |
| `readiness` | `readiness`: "when {measure} reaches {threshold} (now {value})" (generate.ts:1524) | no fix tile; shown as the `gate` state tile | generate.ts:1517–1525 (unmet or unmeasured threshold) | threshold met | none |
| `readiness` | `operator`: "when 1 safe way in for the signed-in account exist (now 0)" (generate.ts:1601) | fix tile "Prerequisites", `warn` (skipped while the transition is `createReportOnly`) | generate.ts:1600–1603, when the strand simulator returns `stranded` | the operator is no longer stranded | none |
| `readiness` | sequence-safety label, optional binding (`blockLate`) | fix tile "Prerequisites" only when a binding exists | generate.ts:1931–1938. Also pushes `dependsOn` into `blockedBy`. | not settled by the files read (per rule) | none |
| `evidence` | `baseline-conflict`: "the baseline defines this policy two ways" | no fix tile (`fixOf` returns [] on conflict); shown as the `baseline` state tile | generate.ts:1972 | reviewed baseline without the conflict | none |
| `decision` | `device-plan` ("until phones and computers are decided") / `exclusions-decision` ("until you choose the exclusions group") | no fix tile (stepContract.ts:605); shown as the `decision` state tile | generate.ts:1050, 1138. Sets condition `needs-decision` through `conditionFor`. | device plan recorded / exclusions group chosen | none |

**Holds.** `HoldKind` (holds.ts:43) is unavailable, readiness, prerequisite, decision, conflict, review or evidence. It is not a tile. It sets `state.held`, which drives the bar key (`blocked` etc.; stepContract.ts:1194) and the row reason (stateReason.ts:68–119).

## Table 3: Dependency-edge kinds and gates

### 3a. Edge fields in dependency-data.json

The file has 48 steps, 109 edges and 6 conditions.

| field | values (count in data) | how it surfaces |
|---|---|---|
| `prerequisiteKind` | `step` 92, `sourceMapping` 14, `sourceConflict` 1, `baselineSafetyConflict` 1, `decision` 1. Parser also allows `fact`, `evidence`, `license/platform`, `time/evidence-window`, `suspendedPrerequisite`, with 0 edges each (parseDependencyDoc.ts:14–16). | `step` gives an engine `step` or `suspendedPrerequisite` blocker. Non-step kinds pass through `nonStepKind` (lanes.ts:211–218): the five conflict/mapping/licence/decision kinds keep their own kind; `fact` becomes `fact` when blocked or `missingObject` otherwise; anything else becomes `fact`. |
| `edgeKind` | `hard` 71, `conditional` 38 | Not read by the engine. Applicability is read only from `condition` (lanes.ts:161). |
| `condition` | `sd-enabled` (on every §11 E–H policy's enforce, expanded from the placeholder row), `mail-devices-incompatible-path`, `partner-accounts-exist`, `travel-exceptions-allowed`, `shared-devices-exist`, `campaign-targets-passkey` | planLanes never passes `conditions`, so each is `unresolved` and its edge participates (lanes.ts:152–154, 161). `sd-enabled` is left out of the unlock counts only (planLanes.ts:35). |
| `milestone` | `complete` 82, `resolved` 17, `ready-to-enforce` 4, `minimum-satisfied` 3, `created` 2, `enforced` 1 | `milestoneReached` (lanes.ts:185–199). A milestone the prerequisite has not reached leaves the edge unresolved and gives a blocker. |
| `action` | `create` 50, `enforce` 45, `start` 12, `complete` 2 | Only edges on the step's next action (`nextActionOf`, lanes.ts:175–181) become blockers or tiles. The exception is deferred prerequisites (lanes.ts:227–231). Enforce-side edges on a not-yet-created policy draw no tile. |
| `status` | `ok` 109 | not read at runtime |

### 3b. Gates

| gate | where | tile / blocker |
|---|---|---|
| Readiness threshold (enforcement only) | generate.ts:1517–1524 sets `action.readinessGate` plus a roadmap `readiness` blocker; constants.ts:2–4 | `gate` tile (`warn`). Not listed as a fix while the step's transition is `createReportOnly` (stepContract.ts:591). |
| Emergency gate (`GATING_SUBJECTS` = breakGlass, exclusionGroup) | blockerSteps.ts:22, 121–132; generate.ts:1175–1177, 1561–1563; also `action.escapeHatch` when an operation submits enforcement | roadmap `step` blocker, shown as the "Prerequisite step" fix tile with a link. Row reason "after: …" (stateReason.ts:36–38). |
| Report-only two gates (time + evidence) | tracking.ts:410–417 (time: `OBSERVATION_DAYS` = 7, constants.ts:50; evidence: zero failures and every active person in scope seen); `readyWhen` (readyWhen.ts:57–66) | No tile of its own. While open, the step's milestone is `observe`, giving the `observation` tile (`wait`). A closed window with uncleared records is `holdOf` → `evidence` (holds.ts:75–76), which feeds `state.held` and the bar. |
| Package gates | project.ts:628–659; READINESS_RESULTS (protocol.ts:98) | package tiles with an optional Confirm button (Table 1, last row) |
| Engine lane gates (§15 abnormal) | lanes.ts:318–327 | On Hold plus engine tiles (Table 2a) |

## Transitive vs direct prerequisites

The engine stores and evaluates direct edges only. Everything it says in a tile names a direct edge of the step. Transitive walking happens in five places, and one roadmap path names a prerequisite that is not a direct edge.

1. **Engine tiles are direct only.** `unresolvedOn` iterates `graph.gates.get(id)`, which holds only this step's own edges (lanes.ts:223–246). An ancestor affects the tile only through the direct prerequisite's own lane: if that lane is On Hold, the direct prerequisite's `step` blocker becomes `abnormal`, so the tile turns `warn` ! (lanes.ts:242). The tile still names the direct prerequisite, never the ancestor. `holdLabelOf` likewise names only `reason.id` (planBoard.ts:194–202).
   - Example from dependency-data.json: `s-goal-mfa-all-users:create ← s-prereq-exclusion-group@complete` and `s-prereq-exclusion-group:start ← s-prereq-break-glass@minimum-satisfied`. Suppose break-glass has not reached minimum-satisfied. Exclusion-group is then Up Next behind break-glass. `s-goal-mfa-all-users` gets one engine tile, "Prerequisite on hold" → the exclusion group's title, tone `wait`. Break-glass is not named by any engine tile on that step.
2. **`layersOf` walks the graph transitively, for a count only** (lanes.ts:272–286). It follows each unsatisfied step prerequisite's own remaining actions (`remainingActions`, 264–270). In the example above, `layers` = 2 (exclusion-group and break-glass). The count feeds Up Next ordering (sorting.ts:83–91) and is not shown in any tile.
3. **`ready-to-enforce` milestones read the prerequisite's own gates** (lanes.ts:193–197). The edge is satisfied only if every applicable `enforce` edge of the prerequisite is satisfied, apart from the edge back to the requester.
   - Example: `s-prereq-security-defaults:start ← s-goal-mfa-all-users@ready-to-enforce [sd-enabled]`, and `s-goal-mfa-all-users:enforce ← s-verify-mfa@complete`. An incomplete `s-verify-mfa` keeps security-defaults' edge unsatisfied. The tile on `s-prereq-security-defaults` names `s-goal-mfa-all-users`, not `s-verify-mfa`.
4. **Unlock counts are transitive** (sorting.ts:19–40). They feed Ready and Up Next sorting only.
5. **Hold chains are transitive, but the named step stays direct.** `markHoldChains` marks `Blocker.held` along the whole chain (holds.ts:99–116). `holdWaitsOn` and `holdReasonFor` then name the directly waited-on step, `after(chain.stepId)` (stateReason.ts:88–89, 135). The ancestor that actually holds the chain is not named.
6. **The roadmap emergency gate names a prerequisite that is not a direct edge.** This is the case where a tile names a non-direct prerequisite.
   - generate.ts:1561–1562 adds a roadmap `step` blocker to the gate step on every deny-capable goal step. `fixTiles` then draws it as "Prerequisite step" with a link (stepContract.ts:597–601, 1113–1116). The gate is `s-prereq-break-glass` whenever the break-glass report blocks or that step is not done (generate.ts:1175–1176).
   - For `s-goal-mfa-all-users`, dependency-data.json has no edge to `s-prereq-break-glass`. It is an ancestor, through `s-prereq-exclusion-group`. That step can show both tiles: fix "Prerequisite step → Create or Correct Emergency Access…" (the ancestor, `warn`) and engine "Prerequisite on hold → exclusion group" (the direct edge, `wait`). The dedupe at stepContract.ts:1140 compares ids, so the two different ids both survive. The step titles here are those the code resolves from content; exact words not read.
   - For policy steps with no exclusion-group edge in the graph at all, the same gate tile names a step that is not even a graph ancestor. Those steps are `s-goal-guests-mfa`, `s-goal-mobile-app-protection`, `s-goal-service-accounts-trusted-network`, `s-goal-unmanaged-browser` and `s-goal-workload-identity-block`. It appears whenever the runtime judges the step deny-capable (generate.ts:1536–1539); whether it does for a given tenant is not determinable from code.
7. **Prerequisites that are sequenced but never tiled.**
   - generate.ts:1895–1911 adds `s-verify-mfa` to `blockedBy` only, not to `blockers`. It can therefore appear in the row reason (stateReason.ts:41–42) but never as a tile.
   - `blockLate` does the same with `dependsOn` (generate.ts:1933). Its readiness blocker becomes a tile only when it carries a binding.
8. **Missing object makers.** `action.missing[].stepId` names the step that makes an object the policy body references. If the graph already gates this action on that step, the engine reads it as a healthy direct `step` blocker (planLanes.ts:77, 85). If not, it becomes an abnormal `missingObject`, and `fixOf` adds a `missing:<stepId>` tile linking to the maker (stepContract.ts:578–579). That tile is also a prerequisite that is not a direct graph edge.
