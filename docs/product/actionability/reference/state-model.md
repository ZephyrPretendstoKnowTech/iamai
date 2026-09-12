# State model: every state word IAMAI displays (HEAD 4cde3e6)

## Sources

- `src/roadmap/lifecycle.ts`
- `src/roadmap/types.ts`
- `src/roadmap/holds.ts`
- `src/roadmap/stepSchedule.ts`
- `src/roadmap/tracking.ts`
- `src/roadmap/ics.ts`
- `src/roadmap/artifactLines.ts`
- `src/roadmap/plan.ts`
- `src/roadmap/prompts.ts`
- `src/ui/surfaces/statusWord.ts`
- `src/ui/surfaces/planState.ts`
- `src/ui/surfaces/planBoard.ts`
- `src/ui/surfaces/planRows.ts`
- `src/ui/surfaces/planLanes.ts`
- `src/ui/surfaces/Plan.tsx`
- `src/ui/surfaces/StepSections.tsx`
- `src/ui/surfaces/stepContract.ts`
- `src/ui/surfaces/ContentStep.tsx` (lines 300–474 only)
- `src/ui/surfaces/stepPackage.ts` (lines 165–264, 480–515 only)
- `src/ui/surfaces/CleanupStep.tsx`
- `src/ui/surfaces/cleanupExport.ts`
- `src/ui/surfaces/stepExport.ts`
- `src/ui/surfaces/Export.tsx`
- `src/ui/surfaces/PrintPlan.tsx`
- `src/ui/surfaces/PlanFooter.tsx` (grep only)
- `src/ui/surfaces/rowWhen.ts` (grep only)
- `src/ui/surfaces/inventoryTables.ts` (grep only)
- `src/ui/surfaces/MfaReadiness.tsx`
- `src/ui/surfaces/readinessCells.ts`
- `src/ui/scan/connectView.ts` (lines 454–503 and grep)
- `src/actionability/lanes.ts`
- `src/actionability/sorting.ts`
- `src/content/implementation/drift.ts`
- `src/content/implementation/protocol.ts` (grep: `PACKAGE_STATES`, `READINESS_RESULTS`)
- `src/content/implementation/states.ts`
- `src/coverage/coverage.ts` (grep only)
- `src/coverage/types.ts` (grep and lines 225–239)
- `src/copy/statements.ts` (grep `inPlaceStatement`)
- `src/derive/facts.ts` (lines 40–77)
- `src/derive/sets.ts` (grep `doneSteps`, `trackableSteps`)
- `src/derive/planHeader.ts` (grep only)
- `src/derive/mfaReadiness.ts` (grep only)
- `src/scoring/phishingResistant.ts` (grep only)
- `docs/design/content.json` (grepped keys only)
- `docs/product/actionability/RUN-CONTEXT.md`
- `docs/product/actionability/IAMAI-Actionability-Dependency-Playbook.md` (grep, §2 and §15–16 read)

## Conventions

- **Key**: a `docs/design/content.json` path. Every `stepContract.*` key below lives under `pages.app.plan.stepContract`.
- **hard-coded**: the literal sits in a TypeScript file and has no content.json key.
- Surface abbreviations:
  - **Row**: the status chip on a Plan board row (`StepSections.tsx` `PlanRow`, line 82).
  - **Lane label**: the `.lane` line under that chip (line 83).
  - **Badge**: the pill in the opened step's head (`StepHead`, line 153).
  - **Track**: the lifecycle track.
  - **Bar**: the readiness bar headline.
  - **Rail**: the Next milestone rail.
  - **Tile**: a Readiness tile.
  - **When**: the board's When column.
  - **Impl box**: the Implementation empty box.
  - **Header tiles**: the Plan progress tiles.
  - **Tabs**, **Toggles**, **Filter**, **Group**: the board controls and group headings.
  - **Print**: the print document.
  - **ICS**, **CSV**, **Bundle** (grounding bundle JSON), **Plan file** (plan JSON), **Prompt pack**: the exports.
- `ContentStep` renders the opened step both on screen and in Print (`PrintPlan.tsx:252,267,280`). Anything a badge, bar, rail or tile shows therefore also prints.

---

## A. Legacy lifecycle vocabulary

### A.1 `Lifecycle`: the stage axis (`roadmap/lifecycle.ts:41`)

`Lifecycle` is set by the Foundation B tracker:
- `tracking.ts` `trackExecution` (lines 971, 1065, 1073).
- `reopen` sets `not-deployed` (line 122).
- Builders set it through `stateFields` (`lifecycle.ts:133`).

It is `null` on a step that deploys no policy.

| Internal | Key | User-facing text | Produced by (words) | Consumed by | Surfaces |
|---|---|---|---|---|---|
| `not-deployed` | `stepContract.lifecycle.not-deployed` | Not deployed | `stepContract.ts` `stageOf` (359), `stepTrack` (253) | `planState.ts` `badgeOf`; `planLanes.ts` `observe` (`exists=false`); `stepPackage.ts` `packageStateOf` → `missing`; `stepSchedule.ts` `createsWhileGated` | Badge, Track |
| `report-only` | `stepContract.lifecycle.report-only` | Report-only | `stageOf`, `stepTrack`; `planState.ts:128` (row word "Report-only", hard-coded) | `projectStatus` → `in-report-only`; `observe` (`exists=true`); `stepScheduleOf` → `observing` | Row, Badge, Track, Tile (observation value falls back to stage) |
| `ready-to-enforce` | `stepContract.lifecycle.ready-to-enforce` | Ready to enforce | `stageOf`, `stepTrack`; `planState.ts:131` (hard-coded "Ready to enforce", or `LIFECYCLE['ready-to-enforce']` + " · " + condition label when held for review) | `projectStatus` → `ready-to-enforce`; `observe` (`evidenceSatisfied=true`) | Row, Badge, Track |
| `enforced` | `stepContract.lifecycle.enforced` | Enforced | `stageOf` (366, only when `satisfied && !inPlace`); `stepTrack`; `planState.ts:111` (hard-coded "Enforced") | `observe` (`enforced=true`, `evidenceSatisfied=true`) | Row, Badge, Track, Tile (coverage value) |
| (outcome, not in union) | `stepContract.lifecycle.in-place` | In place | `stageOf:366` | badge / coverage tile | Badge, Tile |
| (outcome, not in union) | `stepContract.lifecycle.set-aside` | Set aside | `stageOf:361` | badge | Badge |

`stepTrack` returns no stages when lifecycle is `null`, when the step is set aside, or on `baseline-conflict` (`stepContract.ts:255`). The track's aria label comes from `stepContract.trackLabel`: "Rollout lifecycle".

### A.2 `Condition` and `CONDITION_RANK` (`roadmap/lifecycle.ts:44`, `:230`)

The condition is produced by:
- `conditionFor(blockers)` (line 222).
- `raiseCondition` (line 255), called from `tracking.ts:979,983`.
- `reopen` sets `review-required` (`tracking.ts:122`).

| Internal | `CONDITION_RANK` | Key | User-facing text | Consumed by | Surfaces |
|---|---|---|---|---|---|
| `healthy` | 0 | `stepContract.condition.healthy` | Healthy | `badgeOf` (never shown beside a stage, `stepContract.ts:835`) | none found rendering "Healthy" |
| `review-required` | 1 | `stepContract.condition.review-required` | Review required | `heldForReview` (`lifecycle.ts:248`); `planState.ts:98,128,131`; `standingOf` → `review`; `stateTile` / `fixTiles` values; `observe` → `drift=true` | Row (as a suffix), Badge, Tile, Bar ("Held for review") |
| `needs-decision` | 2 | `stepContract.condition.needs-decision` | Needs decision | `projectStatus` → `blocked`; `planState.ts:119` kind `decision`; `observe` → engine kind `decision`; `prerequisiteOf` → `actionable` | Row, Badge, Tile, Rail |
| `blocked` | 3 | `stepContract.condition.blocked` | Blocked | `projectStatus` → `blocked`; `holdOf`; `standingOf` → `blocked` | Row, Badge, Bar |
| `baseline-conflict` | 4 | `stepContract.condition.baseline-conflict` | Baseline conflict | `projectStatus` → `blocked`; `planState.ts:120` kind `conflict` (row word "Blocked"); `observe` → engine blocker `sourceConflict`; `boardWhenOf` → When "Deferred" | Badge, Tile ("Conflict unresolved"), When, Rail, Bar |

Three other `StepState` flags sit on neither axis:
- `satisfied`: the goal is delivered.
- `inPlace`: delivered by a control the tenant already had.
- `setAside`: the operator put the step aside.

They are written only through `setState` and `advanceState`.

### A.3 `StepStatus`: the legacy single word (`roadmap/types.ts:12`)

`projectStatus` (`lifecycle.ts:147`) is the only writer. Its `RANK` (`lifecycle.ts:158`) guards `advanceState`. The word is never rendered raw on screen: `planStateOf` turns it into a row word (A.4).

| Internal | `RANK` | Projected from | Exported raw in |
|---|---|---|---|
| `skipped` | -1 | `setAside` | Bundle `status` (`prompts.ts:233`); Plan file step `status` (`plan.ts` `fileStep` keeps every Step field) and `decisions.steps[].status` |
| `blocked` | 0 | `baseline-conflict`, or `blocked` / `needs-decision` with no lifecycle stage | same |
| `ready` | 0 | otherwise | same |
| `in-report-only` | 1 | lifecycle `report-only` | same |
| `ready-to-enforce` | 2 | lifecycle `ready-to-enforce` | same |
| `done` | 3 | `satisfied` | same; Print cover counts (`PrintPlan.tsx:104,133`); header counts (`derive/sets.ts` `doneSteps`) |

### A.4 The Plan presentation state: row word and chip (`ui/surfaces/planState.ts:48`, `planStateOf` at line 87)

`statusOf` (`statusWord.ts:16`) returns `word` and `tone`. The following read the same `PlanState`:
- `Plan.tsx:562` → `PlanRow`
- `stepContract.ts:721` (`state.word`, `kind`, `badge`)
- `stepExport.ts:138` (`status`)
- `planLanes.ts:201` (`fallbackOf`)
- `Plan.tsx:195–204` (`attention`, `waiting`)

| `PlanStateKind` | When | Row word | Source | Tone | `complete` | `attention` |
|---|---|---|---|---|---|---|
| `inPlace` | `done` and (`inPlace` or lifecycle ≠ `enforced`) | In place | hard-coded `planState.ts:111` | ok | yes | only if `review-required` |
| `enforced` | `done`, not `inPlace`, lifecycle `enforced` | Enforced | hard-coded `planState.ts:111` | ok | yes | only if `review-required` |
| `deferred` | `done` and `emergency.deferredAt` and `hardening > 0` | Minimum in place | `stepContract.stateWords.minimumInPlace` | ok | yes | only if `review-required` |
| `skipped` | `skipped` | Skipped | hard-coded `planState.ts:113` | stop | no | only if `review-required` |
| `attention` | `ready`, not held, `checks.failing > 0` | Needs attention | hard-coded `planState.ts:116` | wait | no | yes |
| `ready` | `ready`, not held | Ready | hard-coded `planState.ts:117` | ok | no | if `operatorSafe === false` or `review-required` |
| `blocked` | `ready` and held; or `blocked` that is neither a decision nor a conflict | Blocked | hard-coded `planState.ts:105` | wait (stop if `operatorSafe === false`) | no | as above |
| `correction` | same as `blocked`, but `kind === 'adjust'` and lifecycle `enforced` | Needs correction | `stepContract.stateWords.needsCorrection` | wait / stop | no | as above |
| `decision` | `blocked` + `needs-decision` | Needs decision | hard-coded `planState.ts:119` | wait | no | yes |
| `conflict` | `blocked` + `baseline-conflict` | Blocked | hard-coded `planState.ts:120` | wait | no | no (excluded from the `operatorSafe` rule) |
| `reportOnly` | `in-report-only` | Report-only; held: `Report-only · Blocked` (healthy) or `Report-only · {condition label}` | hard-coded + `stepContract.condition.*` | wait / stop | no | as above |
| `readyToEnforce` | `ready-to-enforce` | Ready to enforce; held and `review-required`: `Ready to enforce · Review required` | hard-coded + `stepContract.lifecycle` / `stepContract.condition` | ok / wait | no | as above |

- `held` is `roadmap/holds.ts` `isHeld`.
- `waiting` is `scheduleOf(step).class === 'waiting'` (`planState.ts:92`), which drives the "Waiting" header tile.

**Cleanup rows.** `statusWord.ts` `cleanupStatusOf` (line 32) returns "In place" (ok) when `cleanupComplete`, otherwise "Ready" (ok). Both are hard-coded. The words render in:
- `Plan.tsx` `CleanupRow`: Row (line 511) and Badge through `CleanupBody` → `StepHead` (`CleanupStep.tsx:61`).
- Print: `PrintPlan.tsx:290`.

### A.5 Badge (`planState.ts` `badgeOf:140` → `stepContract.ts:759` → `badgeLabel:838`)

The stage is `stageOf` (A.1).

| Case | Badge text |
|---|---|
| No stage | the row word |
| `complete` or `skipped` | the stage (In place / Enforced / Set aside); for kind `deferred`, "Minimum in place" |
| `withStage` (held report-only, held ready-to-enforce) | the row word, e.g. "Report-only · Review required" |
| `attention`, `decision`, `correction`, `blocked` | `{stage} · {row word}` |
| `conflict` | `{stage} · Baseline conflict` |
| Anything else | healthy and not held: `{stage}`; healthy and held: `{stage} · Blocked`; otherwise `{stage} · {condition label}` |

The badge renders in:
- The opened step: `ContentStep.tsx:474`, on screen and in Print.
- Exports as `ExportStep.state` (`stepExport.ts:137`):
  - ICS `DESCRIPTION` through `artifactLines.ts` `stateLine` (lines 41, 56).
  - Bundle `state` (`prompts.ts:244`).
  - Bundle `statusWord` is the row word (`prompts.ts:245`).
  - The Prompt pack reads the same export view (`Export.tsx:230`). Whether it prints `state` was not verified.

### A.6 Readiness bar (`stepContract.ts` `readinessOf:1178`)

The key is chosen in this order (line 1194):
1. `barKeyOf(kind)` (`planState.ts:157`) settles `attention`, `decision`, `conflict`, `deferred`, `correction` and `blocked`.
2. Otherwise `standingOf` (`stepContract.ts:1021`) gives `conflict`, `restore`, `review`, `decide` or `blocked` from the condition and set-aside flag.
3. Otherwise it uses `whatToDo.kind`. The union for that type was not read.
4. A held step at `deploy` or `verify` is forced to `blocked`.
5. `deploy` with fixes outstanding is forced to `attention`.

Words come from `stepContract.readiness.bar.<key>`. Surfaces: Bar (`StepSections.tsx:297`), on screen and in Print.

| Key | Text |
|---|---|
| `deploy` | Ready now |
| `attention` | Needs attention |
| `observe` | Continue observation |
| `enforce` | Ready to enforce |
| `verify` | Ready to check |
| `preserve` | Already satisfied |
| `decide` | Needs a decision |
| `resolve` | Held |
| `review` | Held for review |
| `blocked` | Blocked |
| `correction` | Needs correction |
| `deferred` | Minimum in place, hardening deferred |
| `conflict` | Deferred |
| `restore` | Set aside |
| `none` | Nothing left to do |

### A.7 Rail metric (`stepContract.ts` `railOf:1202`, rendered `StepSections.tsx:207`)

| Case | Metric | Key |
|---|---|---|
| Milestone has a date | the date | none |
| kind `deferred` | Hardening deferred | `stepContract.stateWords.hardeningDeferred` |
| Schedule `scheduled` or `observing` with a date, not a decision | the date, over the transition words | `stepContract.railTransition.createReportOnly` "Create in report-only" / `.change` "Change the existing policy" / `.enforce` "Turn the policy on" |
| standing `conflict` | Deferred | `stepContract.rail.deferred` |
| standing `restore` | Set aside | `stepContract.rail.setAside` |
| standing `decide` | Needs decision | `stepContract.rail.decision` (sub: `rail.decideSub` "Make the decision") |
| standing `preserve` | No change needed | `stepContract.rail.noChange` |
| standing `review`, `blocked` or `resolve` | Held, or the row's When text when that text is "After …" or "Held" | `stepContract.rail.held` (sub: `rail.resolveSub` "Resolve prerequisites") |
| anything else | Not scheduled | `stepContract.rail.undated` |

### A.8 Next milestone (`lifecycle.ts` `nextMilestone:270`)

`Milestone.kind` values: `decide`, `resolve`, `deploy`, `observe`, `enforce`, `verify`, `preserve`, `none`.

Labels come from `shared.engine.milestone.*` (content.json line 246). The key path is taken from the comment at `lifecycle.ts:49`; the parent object was not grepped. The labels are:
- `setAside`: "This step is set aside."
- `conflict`: "Wait for a reviewed baseline that settles the contradiction; there is nothing to submit."
- `decide`: "Answer the question this step is waiting on."
- `resolve`: "Clear what this step is waiting on."
- `prepareHeld`, `prepareHeldOther`, `prepareScheduled`, `prepareScheduledOther`
- `prepare`: "Make the object this step names."
- `deploy`: "Create the policy in report-only."
- `review`: "Leave it in report-only, find out what changed…"
- `observe`: "Leave it in report-only and watch it."
- `observeUntil`: "…until {date}."
- `observeRecords`
- `enforce`: "Turn the policy on."
- `verify`: "Check it did what it should."
- `preserve`: "Keep what is already doing this."
- `none`: "Nothing left to do."

These are sentences, not state words. They surface as:
- the Rail sub-line
- tile notes
- `ExportStep.next` (dated lines only)
- the ICS `SUMMARY` fallback (`ics.ts:74`).

### A.9 Readiness tiles (`stepContract.ts:1032–1195`, `stepPackage.ts` `mergeReadiness:503`)

Labels and values come from `stepContract.readiness.tiles.*` unless noted. Rendered by `StepSections.tsx` `Tile` (line 318), on screen and in Print.

| Tile key | Label | State value(s) | Producer |
|---|---|---|---|
| `baseline` | Baseline definition | Conflict unresolved | `stateTile:1035` |
| `evidence` | New evidence (`stepContract.foundLabel.observation`) | Review required (condition key) | `stateTile:1037` |
| `decision` | Decision | Needs decision (condition key) | `stateTile:1038` |
| `coverage` | Existing coverage | stage: In place / Enforced | `stateTile:1039` |
| `gate` | Threshold | gate value | `stateTile:1043` |
| `observation` | Observation | "Until {date}", or the stage | `stateTile:1044` |
| `emergency` | Emergency access (`stepContract.hardening.tiles.access`) | Available / Not available | `emergencyTiles:1077` |
| `resilience` | Resilience | Meets recommendations / Deferred to Cleanup / Needs attention | `emergencyTiles:1083` |
| `exclusions` | Exclusions | Reaches emergency access / Not proven | `exclusionsTile` |
| `people` | Affected people | the reach sentence, or "Not established" | `peopleTile` |
| `step:` / `missing:` | Prerequisite step | the step title | `fixTiles:1116` |
| `mapping` | Baseline mapping | Baseline references an unmapped group (`pages.plan.blocked.sourceMapping`) | `fixTiles:1118` |
| `review` | Review | Review required | `fixTiles:1119` |
| `check` | Check | the fix text | `fixTiles:1120` |
| other fix | Prerequisites | the fix text | `fixTiles:1121` |
| `engine:<kind>:<id>` | lane blocker label (B.3) | step title, or the blocker label | `engineTiles:1132` |
| `implementation` | Implementation | Unavailable | `implementationTile:1166` |
| none unresolved | Clear | "Nothing outstanding changes the next action." | `StepSections.tsx:285` |
| satisfied disclosure | "{n} satisfied" | none | `StepSections.tsx:291` |
| package tile | authored gate | one of `READINESS_RESULTS`: Ready, Review required, Unknown, Blocked, Not applicable (hard-coded `protocol.ts:98`) | `stepPackage.ts:510`; tone from `RESULT_TONE:492` |

Tile marks are hard-coded in `StepSections.tsx:240`: good ✓, warn !, wait ….

### A.10 When column and reason line (`planBoard.ts` `boardWhen:238`, `boardWhenOf:276`; `rowWhen.ts`)

| Word | Key / source | When |
|---|---|---|
| Complete | `pages.plan.when.complete` | `status === 'done'` |
| Not scheduled | `pages.plan.when.notScheduled` | no date |
| After {step} | `pages.plan.when.after` | the step it waits on, title ≤ 32 characters |
| After prerequisites | `pages.plan.when.afterPrerequisites` | several waits, or a long title |
| Held | `BOARD.held`, hard-coded `planBoard.ts:84` | schedule class `waiting` and nothing else to name |
| Deferred | `stepContract.rail.deferred` (`planBoard.ts:280`) | condition `baseline-conflict`, not done, not skipped |
| now | `pages.plan.now` (`rowWhen.ts:94,119`) | generic now, which the board replaces with the phase day |
| ready {date} / ready now | `pages.plan.readyOn` / `pages.plan.readyNow` (`rowWhen.ts:91–92`) | report-only readiness |
| held until the records clear | `pages.plan.heldForEvidence` (`rowWhen.ts:71,92`) | evidence hold |
| held until reviewed | `pages.plan.heldForReview` (`rowWhen.ts:68,165`) | `heldForReview` |

The reason line under the title comes from `rowWhen.ts:163–193`. It can read:
- `pages.plan.satisfiedBy` / `satisfiedTogether`
- `pages.plan.blocked.*` reasons, e.g. "after: {stepTitle}".

The `Blocked` condition on the Rail uses the same "After …" and "Held" text (`stepContract.ts:1232`).

### A.11 Implementation empty box (`stepContract.ts` `implementationEmptyOf:1245`, `ContentStep.tsx` `heldBox:413`)

Words come from `stepContract.implementation.empty.<key>[0]` (title).

| Key | Title |
|---|---|
| `inPlace` | No implementation needed |
| `observe` | No tenant change to submit right now |
| `review`, `decision`, `blocked`, `unavailable`, `conflict`, `bindingMissing`, `packageFault`, `correctionUnknown` | Nothing to submit yet |
| `setAside` | Nothing to submit |
| `none` | No generated implementation |
| `confirmationsPending` | Confirm the checks before enforcement |

Package re-pin review notes (`ContentStep.tsx:403`) come from `DriftStatus` (`drift.ts:24`: `current` | `reviewNeeded` | `held`):
- `stepContract.implementation.review.reviewNeeded`: a sentence beginning "IAMAI's written guidance for this step was reviewed against an earlier version…"
- `stepContract.implementation.review.held`: "A baseline policy this step's written guidance was reviewed for is no longer in the baseline…"
- `current` shows nothing.

### A.12 Internal schedule, hold and package states (drive words; never displayed by name)

| Type (file:line) | Values | Words or counts it drives |
|---|---|---|
| `ScheduleClass` (`stepSchedule.ts:48`) | `complete`, `setAside`, `scheduled`, `observing`, `waiting` | `waiting` → `PlanState.waiting` → "Waiting" header tile; When "Held"; Rail date vs Held; ICS books only `scheduled` / `observing` (`scheduledEventOf:201`) |
| `ScheduledTransition` (`stepSchedule.ts:51`) | `prepare`, `decide`, `verify`, `createReportOnly`, `change`, `enforce`, `review` | `railTransition` words on Rail and ICS `SUMMARY` (`ics.ts:74`); `decide` is never booked |
| `EnforcementReadiness` (`stepSchedule.ts:59`) | `none`, `forecast`, `gated`, `earned` | not displayed; Bundle `enforcement` comes from `statedEnforcement`, not read (the comment names `forecast` / `committed` / `unearned`, `prompts.ts:238`) |
| `HoldKind` (`holds.ts:43`) | `unavailable`, `readiness`, `prerequisite`, `decision`, `conflict`, `review`, `evidence` | `isHeld` → row word Blocked / Needs correction / "Report-only · …"; Bar held / blocked; When Held |
| `PackageState` (`protocol.ts:80`) | `missing`, `partial`, `reportOnly`, `readyToEnforce`, `inPlace`, `blocked`, `needsDecision`, `sourceConflict`, `notLicensed` | selects the package projection (`stepPackage.ts` `packageStateOf:175`); no word found |
| `AUTHORED_STATES` (`states.ts:49`) | 37 authored names (e.g. `reviewRequired` → `blocked`) | reconciliation report only; the runtime never enters them |
| `GoalStatus` (`coverage/types.ts:229`) | `below-baseline`, `enforced`, `partial`, `absent`, `licence-limited`, `not-applicable`, `unknown` | Plan file `coverage[].state` (`plan.ts:84`); Bundle `findings[].status` (`prompts.ts:215`); Print "Doesn't apply ({n})" (`PrintPlan.tsx:136`); `coverage.ts:825` writes `inPlaceStatement` ("Delivered by …", `copy/statements.ts:48`) for `enforced`. `coverage.ts` produces no "In place" state word. |
| Policy state (`coverage/types.ts:10`) | `enabled`, `enabledForReportingButNotEnforced`, `disabled`, `unknown` | Plan file `policies[].state` (`plan.ts:91`) |
| `StepTracking.state` (`types.ts:633`) | typed `string`; values not found | Bundle `tracking.state` (`prompts.ts:234`) |

### A.13 Header tiles, counts and print cover

| Word | Key | Value | Producer | Surface |
|---|---|---|---|---|
| Steps | `pages.plan.progress.steps` | `stepFacts.steps` = steps that are not skipped and have no `doesntApply`, plus Cleanup rows | `derive/facts.ts:60`, `derive/sets.ts:201` | Header tiles (`Plan.tsx:249`) |
| In place | `pages.plan.progress.inPlace` | `stepFacts.done` = `status === 'done'` (In place, Enforced and Minimum in place alike) plus complete Cleanup rows | `derive/sets.ts:206` | Header tiles (`Plan.tsx:250`) |
| Waiting | `pages.plan.progress.waiting` | board items with `PlanState.waiting` (Cleanup rows are always false) | `Plan.tsx:247` | Header tiles |
| Remaining | `pages.plan.progress.remaining` | `max(0, Steps − In place − Waiting)` | `Plan.tsx:252` | Header tiles |
| Started {date} | `pages.plan.progress.started` | none | `Plan.tsx:272` | Header |
| "{steps} steps · {inPlace} in place · …" | `pages.plan.line1`, `line1CannotFinish`, `line1Started` | `stepFacts` | `derive/planHeader.ts:33` | Print cover (`PrintPlan.tsx:153`) |
| In place ({n}): / To do ({n}): / Doesn't apply ({n}): | `app.print.posture.*` | `status === 'done'` / not done and not skipped / `GoalStatus` `not-applicable` | `PrintPlan.tsx:132–136` | Print cover |
| Waiting on something else | `app.plan.held.heading` | `undatedRows` (`planRows.ts:54`) | `PrintPlan.tsx:263` | Print only |

Connect's Plan tile (`connectView.ts:465,489`) reads the same `stepFacts`. Its words were not resolved; the tile is outside this document's surfaces.

### A.14 MFA Readiness (a third vocabulary; shares the word "Ready")

`ReadinessState` (`scoring/phishingResistant.ts:182`) takes the values `ready`, `needsProof`, `needsSetup`, `unknown`.

Words come from `pages.readiness.states.<s>.title`: Ready / Needs proof / Needs setup / Unknown. `readinessCells.ts` `stateTitle:58` and `readinessWord:94` add:
- `pages.readiness.show.notActive`: "Not active"
- `pages.readiness.notAPerson`: "not a person"

Surfaces:
- Readiness chip: `MfaReadiness.tsx:247` (tones `STATUS_TONE:80`).
- Summary counts: `states.<s>.stat` "Need proof" / "Need setup" / "Unknown" (`MfaReadiness.tsx:289–295`).
- Filter pills: `pages.readiness.show.*`.
- Gate strip: `strip.gateMore` "{n} more" / `gateMet` "Met" / `gateNotMeasured` "Not measured".
- CSV: readiness column via `rowCells` (`readinessCells.ts:225`) → `inventoryTables.ts:175` → Export CSV (`Export.tsx:320`).

---

## B. Lane vocabulary

### B.1 `Lane` (`actionability/lanes.ts:16`)

Lanes are produced by `deriveUncached` (`lanes.ts:304`), which runs playbook §4 in order:
1. Completed (310)
2. Deferred (312)
3. On Hold on abnormal blockers (324)
4. Ready if started (331)
5. Ready if executable (338)
6. Up Next (342)

The adapter is `planLanes.ts` `laneReadings:182`: engine rows first, then a fallback for rows the graph does not know. Label words are hard-coded in `BOARD.lanes` (`planBoard.ts:69`). The comment at lines 60–65 says they are deliberately kept out of content.json.

| Internal | Tab id (`TAB_OF`, `planBoard.ts:54`) | User-facing text | Engine trigger | Adapter input | Surfaces |
|---|---|---|---|---|---|
| `Ready` | `ready` (default, `Plan.tsx:95`) | Ready | started and no abnormal blocker; or next action executable | `observe()` | Tab + badge count, Group heading (`groupsFor:436`), Lane label |
| `Up Next` | `upNext` | Up Next | not started, healthy unresolved prerequisites; also any step caught in a derivation cycle (`lanes.ts:296`) | `observe()` | Tab + count, Group, Lane label |
| `On Hold` | `onHold` | On Hold | any abnormal blocker (`lanes.ts:324`) | `observe().blockers`, `prerequisites()` | Tab + count, Groups per blocker label (`groupsFor:423–434`), Lane label |
| `Completed` | `null` (toggle) | Completed; toggle "Show completed" | `observation.complete` = `status === 'done'` or `doesntApply` (`planLanes.ts:100`) | `observe()` | Toggle + count, secondary Group (`groupsFor:439`), Lane label |
| `Deferred` | `null` (toggle) | Deferred; toggle "Show deferred" | owner deferred = `status === 'skipped'` (`planLanes.ts:150`) | `tenantStateOf` | Toggle + count, secondary Group (`groupsFor:441`), Lane label |

No identifier named `Suspended` exists for the Deferred lane or for a skipped step. The only "suspended" identifier is the blocker kind `suspendedPrerequisite` (B.3).

Other lane words:
- Empty-lane messages: "Nothing in this lane." and, under an active focus, "No steps match this search." (`planBoard.ts:88–89`).
- Tab strip aria label: "Lanes" (`planBoard.ts:68`).

### B.2 `Substatus` (`lanes.ts:17`)

The literal string is the display text. `laneLabelOf` renders it as `Ready · {substatus}` (`planBoard.ts:178`).

| Substatus | Engine trigger (`lanes.ts:332–339`) | `SUBSTATUS_ORDINAL` (`lanes.ts:103`) | Ready sort (`sorting.ts`) | Fallback from `PlanStateKind` (`planLanes.ts:155`) |
|---|---|---|---|---|
| `Ready to enforce` | started, next action `enforce`, no healthy unresolved prerequisites | 0 | actionable; `kind` rank 2 | `readyToEnforce` |
| `Observing` | started, otherwise | 1 | not actionable (last) | `reportOnly` |
| `Correct` | started, next action `correct` (drift) | 2 | actionable, unlocking | `attention` |
| `Create` | not started, executable, kind ≠ decision | 3 | actionable, unlocking | default branch (kind `ready`; `inPlace` / `enforced` / `deferred` are always `complete` and never reach it) |
| `Needs decision` | not started, executable, kind `decision` | 4 | actionable, unlocking | `decision` |
| (Up Next) | none | 5 (`UP_NEXT_ORDINAL`) | `sortUpNext` | `blocked` / `correction` / `conflict` when not held |

### B.3 `BlockerKind` (`lanes.ts:66`) and On Hold labels (`BOARD.blockers`, `planBoard.ts:91–103`)

Primary order is `BLOCKER_ORDER` (`lanes.ts:97`).

| Kind | Label (hard-coded unless noted) | Produced by |
|---|---|---|
| `baselineSafetyConflict` | Baseline safety conflict | graph edge only (`nonStepKind:213`); a planLanes observation never produces it |
| `sourceConflict` | Baseline conflict | `observe:71` (condition `baseline-conflict`); graph edge |
| `sourceMapping` | Baseline references an unmapped group (`pages.plan.blocked.sourceMapping`) | `observe:83` (`action.missing` that is unreadable or a decision) |
| `license/platform` | Licence or platform | graph edge only; presence in `dependency-data.json` not verified |
| `decision` | Decision | graph edge (non-step) |
| `fact` | Tenant fact | `observe:72` (Setup blocker); graph edge in `blocked` state |
| `missingObject` | Missing object | `observe:85`; graph fact edge not in `blocked` state (`nonStepKind:215`) |
| `step` | Prerequisite on hold (abnormal); healthy when the prerequisite is not On Hold | `unresolvedOn:242–243` |
| `suspendedPrerequisite` | Deferred prerequisite | `unresolvedOn:229,241` |
| `unsupported` | Not supported | `observe:88` (`unmatched-pair`, `no-operation`) |

Where the labels appear:
- On Hold group heading (`holdGroupOf:205`); "Held" when the lane has no reason.
- Lane label `On Hold · {label}` or `On Hold · {label}: {title}` (`holdLabelOf:194`).
- Up Next tail when the reason is not a step (`laneLabelOf:181`).
- Readiness tile label (`readinessBlockersOf:215` → `stepContract.ts` `engineTiles:1142,1153`), with tone warn when abnormal and wait when healthy. These tiles render on screen and in Print.

### B.4 Lane label composition (`planBoard.ts` `laneLabelOf:175`)

| Lane | Label |
|---|---|
| Ready | `Ready · {substatus}`, or `Ready` |
| Up Next | `Up Next · After {title}` (`pages.plan.when.after`); `Up Next · {blocker label}`; `Up Next · After prerequisites` (`pages.plan.when.afterPrerequisites`) |
| On Hold | `On Hold · {holdLabelOf}` |
| Completed | `Completed` |
| Deferred | `Deferred` |

Rendered under the row word in the same status cell (`StepSections.tsx:83`) for step rows (`Plan.tsx:196,574`) and Cleanup rows (`Plan.tsx:226,235,511`).

### B.5 Controls and counts (`Plan.tsx` `PlanControls:374`; `planBoard.ts` `focusCounts:399`, `applyFocus:386`)

| Control | Word | Count | Vocabulary counted |
|---|---|---|---|
| Tabs | Ready / Up Next / On Hold | `counts.lanes[tab]` = every board item whose lane maps to that tab; no filter applied | lane |
| Needs attention toggle | Needs attention | items with `PlanState.attention`, across all lanes, including hidden Completed and Deferred rows | legacy |
| Show completed | Show completed | lane `Completed` | lane |
| Show deferred | Show deferred | lane `Deferred` | lane |
| Work type filter | Work type / All work / Conditional Access / MFA & Authentication / Tenant setup / Resolution & decisions | none | neither (`workTypeOf:166`) |
| Group summary | "{n} step(s)" + " · {m} need(s) attention" (hard-coded `planBoard.ts:450`) | counted in the group | lane group, legacy attention |
| Next marker | next (`pages.plan.next`) | first `Ready` lane step by engine order (`Plan.tsx:182`) | lane |

### B.6 Where the lane vocabulary does not reach

- **Print** groups by phase, undated and floor (`planRows.ts`, `PrintPlan.tsx:117–121`) and shows no lane, tab or substatus. Lane blocker labels still appear inside engine Readiness tiles.
- **Every export** reads `stepExportView` (`stepExport.ts:126`), which carries only the legacy `state` (badge) and `status` (row word). `laneReadings` is called only in `Plan.tsx:178` and `PrintPlan.tsx:102`. No ICS, CSV, Bundle, Plan file or Prompt pack field carries a lane.
- **The opened step** (`ContentStep`) receives the engine's blockers but not the lane.

---

## Where the two vocabularies meet

| # | File:line | What happens |
|---|---|---|
| 1 | `planLanes.ts:64–104` | `observe()` converts legacy state into engine input: `lifecycle` → `exists` / `evidenceSatisfied` / `enforced`; `status === 'done'` → `complete`; `baseline-conflict` → `sourceConflict`; `review-required` or an `adjust` that exists → `drift` (substatus `Correct`); `needs-decision` → kind `decision`; `setup` blockers → `fact`. |
| 2 | `planLanes.ts:109–125` | `prerequisiteOf` converts condition into non-step prerequisite state. `needs-decision` is always `actionable`, never `blocked`, and a `sourceMapping` edge is always `resolved`. |
| 3 | `planLanes.ts:150` | Legacy `skipped` becomes owner-deferred, i.e. lane `Deferred`. The same step reads row "Skipped", badge "Set aside", Bar and Rail "Set aside", lane label "Deferred", and blocker label "Deferred prerequisite" on dependents. |
| 4 | `planLanes.ts:155–175` | `fallbackOf` maps `PlanStateKind` to lane and substatus for rows the graph does not know. It uses legacy `held` to choose On Hold vs Up Next, where the engine uses abnormal blockers. A not-held `correction` (an enforced policy) goes to Up Next. |
| 5 | `planLanes.ts:201–207` | For a fallback row in On Hold, the adapter re-runs `observe()` only to borrow a `sourceMapping` reason. |
| 6 | `planLanes.ts:147,211` | Cleanup rows get `Completed` or `Ready · Create` from `cleanupComplete`, while their row word is "In place" / "Ready" (`statusWord.ts:32`). |
| 7 | `Plan.tsx:195–207` | Each `BoardItem` takes `lane` / `laneLabel` / `hold` from the engine and `attention` / `waiting` from `planStateOf`. |
| 8 | `Plan.tsx:562,571–584`; `StepSections.tsx:82–83` | One status cell draws the legacy word (chip) over the lane label. `holdOf` kinds `readiness`, `evidence` and most `unavailable` reasons have no counterpart in `observe()`, so a "Blocked" row can carry "Ready · Create" or "Up Next · …". A "Ready to enforce" row reads "Ready · Observing" wherever an enforce-side graph edge is unresolved (`lanes.ts:333`). A "Report-only" row can read "On Hold · …" or "Ready · Correct". |
| 9 | `Plan.tsx:182,581` | The "next" pill is the first engine `Ready` row, whatever its legacy word (it can be "Blocked" or "Needs attention"). |
| 10 | `Plan.tsx:214`; `planBoard.ts:276–297` | The When column reads schedule `waiting` / `isHeld` ("Held", "After …") beside the engine lane. "Held" can sit on a Ready or Up Next row. |
| 11 | `planBoard.ts:280` | Baseline conflict gives When "Deferred" (rail word) while the engine puts the step in On Hold (`sourceConflict`). "Deferred" is also the lane for skipped steps. |
| 12 | `planBoard.ts:84,195,206,241,426` | `BOARD.held` "Held" is both the On Hold group heading when the reason is null (lane) and the When word for schedule-waiting rows in any lane (legacy). |
| 13 | `Plan.tsx:247–253` | Header tiles "In place", "Waiting" and "Remaining" are legacy counts: `status === 'done'`, schedule `waiting`, and the difference. The tabs directly under them count lanes. "Remaining" is not the sum of the Ready, Up Next and On Hold tab counts. "Steps" excludes skipped steps, which are still board rows in the Deferred lane. "In place" counts Enforced and Minimum in place rows. |
| 14 | `Plan.tsx:332`; `planBoard.ts:399–411` | `focusCounts` returns the legacy attention count and the lane counts in one object. The attention count spans every lane, including hidden Completed and Deferred rows. `applyFocus` (`planBoard.ts:391`) filters only within the active tab, so the badge number can exceed the rows shown. |
| 15 | `planState.ts:98` | `attention` is true for any `review-required` condition, whatever the status or lane, so a Completed-lane row can count in Needs attention. |
| 16 | `planBoard.ts:450` | Group summary "n steps · m need attention": groups are lane groups, the attention part is legacy. |
| 17 | `Plan.tsx:215` → `ContentStep.tsx:350` → `stepContract.ts:1132–1156` | Engine blockers (lane labels, abnormal → warn, healthy → wait) are merged with the contract's legacy tiles in one Readiness strip. Deduplication reads legacy keys and `condition === 'needs-decision'` (line 1151). |
| 18 | `stepContract.ts:1192–1194`; `planState.ts:157` | The Bar comes from `PlanStateKind` and `standingOf` only. It never reads the lane, so an opened step can show Bar "Ready now" under a row labelled "Up Next · After …" wherever a graph edge has no legacy blocker. |
| 19 | `stepContract.ts:1202–1234` | The Rail reads schedule class and standing, never the lane. Its "Held" and "After …" copy the When column (#10), not the lane label. |
| 20 | `planState.ts:128,140–154` | Held report-only reads "Report-only · Blocked" on Row and Badge. The playbook §3 reading of started healthy observation is `Ready · Observing`, and the adapter gives exactly that when no engine blocker exists. Both render in the same row. |
| 21 | `Plan.tsx:243` | `TAB_OF` picks the tab for a hash-opened step from its lane, then opens the legacy step body. |
| 22 | `PrintPlan.tsx:102–103,252,267,280` | Print calls `laneReadings(steps)` without Cleanup rows, and only for Readiness tile blockers. It groups by legacy phases and `undatedRows` ("Waiting on something else"). Its step title lookup uses `s.title`; Plan uses `plainTitle || title` (`Plan.tsx:169`). |
| 23 | `stepExport.ts:135–148`; `prompts.ts:233–245`; `ics.ts:74,84` | Exports carry legacy `status` (raw `StepStatus`), `statusWord` (row word) and `state` (badge) only. A step shown under "Up Next" or "On Hold" leaves the browser as "Blocked" or "Report-only · Blocked", with no lane. |
| 24 | `lanes.ts:17` vs content.json | "Ready to enforce" and "Needs decision" exist twice. Substatus literals are hard-coded in `lanes.ts` / `sorting.ts`. The legacy words live in `stepContract.lifecycle.ready-to-enforce`, `stepContract.condition.needs-decision`, and hard-coded `planState.ts:119,131`. "Ready" is hard-coded in both `planState.ts:117` and `BOARD.lanes.ready`. |
| 25 | `planState.ts:108`; `planLanes.ts:156`; `stepContract.ts:1086` | "Deferred" carries four meanings on one board: PlanStateKind `deferred` (row "Minimum in place", lane Completed); lane `Deferred` (skipped); the Resilience tile "Deferred to Cleanup"; and the baseline-conflict When, Rail and Bar "Deferred" (#11). |
| 26 | `holds.ts:84` vs `lanes.ts:324` | `isHeld` (legacy Held) and On Hold (engine abnormal blockers) are computed independently from different inputs. Neither reads the other. |
| 27 | `connectView.ts:465,489`; `PrintPlan.tsx:139,153` | Connect's Plan tile and the Print cover count `stepFacts` (legacy) only; neither shows lane counts. |
| 28 | `readinessCells.ts:58`; `MfaReadiness.tsx:247` | MFA Readiness "Ready" (person readiness) is a third meaning of the Plan's "Ready" row word and "Ready" lane, on a separate surface. |
