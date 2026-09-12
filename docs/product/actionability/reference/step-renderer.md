# Step renderer: from the Plan row to the opened step and its Implementation

Derived from the code at `4cde3e6` (2026-09-12). Line numbers are for that tree. Where the code does not settle something, this file says "not found" or "not traced".

## Sources

- `docs/product/actionability/RUN-CONTEXT.md` (code map, lines 1-30)
- `docs/product/actionability/IAMAI-Actionability-Dependency-Playbook.md` (§16, lines 805-835 only)
- `docs/product/actionability/BLOCKED.md` (S5/S7 entries, lines 60-70 only)
- `docs/product/actionability/SEGMENTS.md` (S5, S6, lines 90-125 only)
- `docs/design/approved/anatomy/plan-step-v1.html`
- `docs/design/content.json` (grepped keys only: `pages.app.plan.stepContract.implementation.*`, `railChannels`)
- `src/ui/App.tsx` (lines 336-380)
- `src/ui/shell/routes.ts`
- `src/ui/session.ts`, `src/ui/actions.ts` (grepped `lastScan`)
- `src/graph/collect/cache.ts` (grepped stores and loaders)
- `src/mapping/store.ts` (`loadMappingState`)
- `src/ui/surfaces/Plan.tsx`
- `src/ui/surfaces/planData.ts`
- `src/ui/surfaces/planLanes.ts`
- `src/ui/surfaces/planState.ts`
- `src/ui/surfaces/planBoard.ts` (lines 54, 160-330, 372-456)
- `src/ui/surfaces/planRows.ts`
- `src/ui/surfaces/ContentStep.tsx`
- `src/ui/surfaces/StepSections.tsx`
- `src/ui/surfaces/stepContract.ts` (lines 253-259, 300-860, 895-1258)
- `src/ui/surfaces/CleanupStep.tsx`
- `src/ui/surfaces/stepPackage.ts`
- `src/ui/surfaces/stepQuestion.ts`
- `src/ui/surfaces/stepInstructions.ts`
- `src/ui/surfaces/stepPowerShell.ts`
- `src/ui/surfaces/stepHeadings.ts`
- `src/ui/surfaces/doneWhen.ts`
- `src/ui/surfaces/MfaHandoff.tsx`
- `src/ui/surfaces/stepJson.ts` (lines 86-135, exports)
- `src/ui/surfaces/stepVars.ts` (lines 40-110, exports)
- `src/ui/surfaces/stepPortal.ts` (lines 270-300, exports)
- `src/ui/surfaces/stepExport.ts` (lines 120-140, exports)
- `src/ui/surfaces/whoBlocks.ts`, `src/ui/surfaces/readinessCells.ts` (exports only)
- `src/ui/surfaces/PrintPlan.tsx`, `src/ui/surfaces/BaselineMappings.tsx` (grepped imports)
- `src/ui/surfaces/implementationChannels.test.ts` (lines 95-135, only to confirm a removed line)
- `src/content/stepTitle.ts`
- `src/content/implementation/project.ts`
- `src/content/implementation/protocol.ts` (lines 1-30, 80, 95, 133, 440-470, 580-620, 733-800, 869-918)
- `src/content/implementation/states.ts`
- `src/content/implementation/conditions.ts`
- `src/content/implementation/invocation.ts`
- `src/content/implementation/drift.ts`
- `src/content/implementation/library.ts`
- `src/roadmap/nextSafeAction.ts` (lines 44-67)
- `src/roadmap/operations.ts` (grepped `policyResult`, `policyHold`, `unavailableReason`, `implementationOffered`, `operationsOf`)

## Origin tags

Every data read below carries one of these tags:

- **(scan)**: the tenant snapshot (`TenantSnapshot`). It lives in the session as `lastScan`, set after a scan (`ui/actions.ts:121`) or restored from the IndexedDB `snapshot` store (`ui/actions.ts:301`, `cache.ts:93`). Group memberships are read per snapshot through `readGroup` (`planData.ts:230`) and count as scan too.
- **(plan record)**: what the operator saved, loaded from IndexedDB database `iamai`, version 7 (`cache.ts:75`). The `mapping` store holds `MappingState` (`loadMappingState`). The `plan` store holds `PlanDecisions` (`loadPlanRecord`, `cache.ts:202`): skips, `stepDecisions`, `confirmations`, `checkpoints`, `observations`, `signature`, start, freeze and first deployment. Both are loaded in `planData.ts:182-190` and persisted back in `planData.ts:342-370`.
- **(engine)**: computed on every render from scan + plan record. This covers coverage, `generateRoadmap`, tracking (`planData.ts:273-335`), the actionability lanes (`planLanes.ts`), `planStateOf`, `stepContract`, Foundation A's `policyResult` (`roadmap/operations.ts:1160`) and `nextSafeAction.ts`.
- **(package)**: the implementation-content registry, `src/content/implementation/registry.generated.json`. It is compiled from `docs/implementation-content/` by `library.ts` / `protocol.ts` and read through `stepPackage.ts` and `project.ts`.
- **(content)**: words from `docs/design/content.json`, through `content/content.ts`. This tag is not one of the four origins the task named. It is added because nearly every sentence comes from here.
- **(baseline)**: the pinned baseline, `PINNED` from `baselines/*.pinned.json`. The engine and `stepPackage.ts` read it.

---

## 1. Routing and selection: which id opens which component

### 1.1 Hash to route

- `resolveHash` (`routes.ts:76-94`) routes `#/plan` and `#/plan/<id>` (`PLAN_STEP`, `routes.ts:57`) to `plan` with no redirect.
- The old deep link `#/roadmap/step/<id>` redirects to `#/plan/<id>` (`routes.ts:81-82`).
- `App.tsx:365` renders `<Plan scan={lastScan} baseline={baseline} account={account} />` when `route === 'plan'`.

### 1.2 Hash to open row

- `Plan` holds `open: string | null` (`Plan.tsx:84`). It starts from `stepFromPlanHash(window.location.hash)` (`routes.ts:102-105`, which decodes the id).
- A `hashchange` listener re-reads it (`Plan.tsx:104-108`).
- A row click calls `openStep(id)` (`Plan.tsx:109-115`). That toggles `open` (the same id closes it) and rewrites the URL with `history.replaceState` to `#/plan/<id>` or `#/plan`. `replaceState` fires no `hashchange` and adds no history entry.
- Other ways in, each writing `#/plan/<id>`:
  - a Readiness tile's step link (`stepContract.ts:1098` `stepLink` → `returnToStep`)
  - MFA Readiness's back link (`MfaReadiness.tsx:84`)
  - a finished scan that was started inside a step (`returnToStep(step.id)` passed to `scan`, then `afterScanHref`, `routes.ts:136-140`)

### 1.3 Which rows exist

- `laneReadings(c.steps, cleanupRows)` (`Plan.tsx:178`; `planLanes.ts:182-216`) returns one reading per row.
- A roadmap `Step` with `doesntApply` set gets no reading, so no row. It lives in the footer instead (`planLanes.ts:187`, `Plan.tsx:179`).
- A Cleanup row is included only if `cleanupEntry(kind)` is not null. Its id is `` `cleanup-${kind}` `` (`Plan.tsx:173`).
- `renderById` (`Plan.tsx:189`) maps each id to exactly one renderer:

| Row id | Built at | Row renderer | Opened body |
|---|---|---|---|
| a roadmap step id in `c.steps` that has a reading | `Plan.tsx:190-216` | `Row` (`Plan.tsx:519-606`) → `PlanRow` | **`ContentStep`** (`Plan.tsx:586-602`) |
| `cleanup-<kind>` | `Plan.tsx:218-237` | `CleanupRow` (`Plan.tsx:480-515`) → `PlanRow` | **`CleanupBody`** (`CleanupStep.tsx:32-120`), mounted at `Plan.tsx:512` |
| anything else (unknown id, a Doesn't-apply step) | none | none | nothing renders. `open` is set but no row matches it |

Question and decision steps have **no component of their own**:

- A step's content entry can carry `decision` (with optional `decision.question` and `decision.strict`). `ContentStep` then draws `Decision` → `SingleDecision` (`ContentStep.tsx:977-1081`) inside the What to do section.
- This happens when `decides` is true (`ContentStep.tsx:355`): `d` exists and either `d.applies` is not a string or `ex[d.applies]` is truthy.
- The option and question parsing is `stepQuestion.ts` (`optionsOf:22`, `questionFor:28`, `answerText:42`, `answerParts:47`).
- `Options` is exported from `ContentStep.tsx:1092` and reused by `BaselineMappings.tsx:21` in Plan settings.
- The content kinds in `content.json` are `blocker`, `object`, `check`, `campaign`, `policy` and `ladder` (`content/content.ts:23`). There is no `question` kind.
- A step with no content entry (a free-tier ladder rung, a validation blocker) still opens `ContentStep`. `cs` is then `{}` (`ContentStep.tsx:250`) and the contract supplies the title, Why and action.

### 1.4 Visibility of the opened row

- **Tab follows the step.** `openTab = TAB_OF[readings.get(open)?.lane ?? 'Completed']` (`Plan.tsx:243`; `TAB_OF`, `planBoard.ts:54`). `TabFollowsOpenStep` (`Plan.tsx:441-447`) switches the lane tab when `open` changes.
- **Completed and Deferred rows.** `TAB_OF` maps these lanes to `null`. `applyFocus` (`planBoard.ts:386-396`) drops such rows unless `showCompleted` / `showDeferred` is on, and both default to `false` (`NO_FOCUS`, `planBoard.ts:372`). So a hash that names a Completed or Deferred row opens nothing on screen until the matching toggle is pressed. The tab does not change for these rows.
- **Groups.** A group holding the open row is not collapsed by default, but an explicit collapse wins (`Plan.tsx:343-344`).

### 1.5 Remounting and other callers

- `ContentStep` is keyed by `snapshot.asOf` (`Plan.tsx:587`), so a new scan remounts the opened step and resets its dialog, tab and copy state.
- `PrintPlan.tsx:252,267,280` renders every step through the same `ContentStep` with `printing`.
- `src/testing/pilotPreview.tsx` renders it with a `baselineCommit` override. It is a dev harness and never built (`ContentStep.tsx:232-238`).

---

## 2. Component tree for an opened step

### 2.1 Anatomy sections (plan-step-v1.html)

The approved pack's opened step, `<article class="step">`:

- A. **Roadmap row** (`.roadmap-row`): status | title over its reason | who | when
- B. **Head** (`.step-head`)
  - eyebrow, `h3` title, `.step-sub`, and a state badge on the right
  - `.track-wrap`: `.track-caption` "Next: …", then the 4-stage `.track` and its labels
- C. **Body** (`.step-body`, two columns)
  - `.step-main` holds the `.step-section`s in order:
    - C1. **Why** (with `Learn →`)
    - C2. **Readiness**: `.readiness-strip` of `.readiness-tile`s, `.readiness-bar` with "Why IAMAI says this →", and affected people inside Readiness
    - C3. **Attention**: `.attention` "Fix before continuing" (V3), `.attention.danger` (V5)
    - C4. **What to do**: `.instruction` (V2-V5)
    - C5. **Implementation** (`.implementation-section`): `.impl-tabs` Entra / PowerShell / JSON / AI Info, `.ai-warning`, `.impl-preview` with Copy and Expand, `.impl-support` "Source updated …", or `.implementation-empty` (`.no-channels`)
    - C6. **Done when**
  - D. **Rail** (`.step-side`): "Next milestone" only (`.side-block`, `.metric`, `.metric-sub`)
- E. **Footer** (`.step-footer`): "Exclude from rollout" (excludable steps only), then "Scan to update plan"
- F. **Dialogs**: `#implementation-dialog` (expanded viewer), `#readiness-dialog` ("Why IAMAI says this"), `#rollout-dialog` (rollout exception reason)

The pack's header comment says "What IAMAI found", "Who this touches" and "More" are **not** part of the approved expanded step (lines 15-17).

### 2.2 Tree

```
App (App.tsx:365)                                   route === 'plan'
└─ Plan (Plan.tsx:74-360)
   ├─ usePlanData(scan, baseline) (planData.ts:133)  → computed steps/schedule/coverage, applied mapping, decisions
   ├─ laneReadings (planLanes.ts:182)                → lane, substatus, reason, blockers, order per row
   ├─ TabFollowsOpenStep (Plan.tsx:441)
   ├─ PlanControls (Plan.tsx:374)                    lane tabs, search, work type, Needs attention, Show completed/deferred
   └─ BoardGroupView (Plan.tsx:449) .plan-group
      ├─ Row (Plan.tsx:519)
      │  ├─ PlanRow (StepSections.tsx:43) .plan-row  [A]
      │  └─ ContentStep (ContentStep.tsx:189)  article.step  (when open)
      │     ├─ StepHead (StepSections.tsx:132) .step-head  [B]
      │     │  ├─ Line cs.changeLine / cs.partner (ContentStep.tsx:182, used 472-473)
      │     │  ├─ StepState (StepSections.tsx:118) .step-next
      │     │  ├─ PolicyMembers (StepSections.tsx:506) .step-members
      │     │  └─ LifecycleTrack (StepSections.tsx:174) .track
      │     ├─ div.step-body.has-rail (ContentStep.tsx:479)  [C]
      │     │  ├─ div.step-main
      │     │  │  ├─ section Why (ContentStep.tsx:483-493)  [C1]
      │     │  │  ├─ ReadinessSection (StepSections.tsx:253)  [C2]
      │     │  │  │  ├─ Tile ×n (StepSections.tsx:318) .readiness-tile
      │     │  │  │  │  └─ HardeningBody (StepSections.tsx:591)   (resilience tile only)
      │     │  │  │  ├─ readiness-satisfied <details>
      │     │  │  │  ├─ .readiness-bar + WhatToDoLead (StepSections.tsx:622) when no What to do
      │     │  │  │  └─ MfaHandoff (MfaHandoff.tsx:60)  (children)
      │     │  │  ├─ Callout danger: baseline conflict (ContentStep.tsx:527-536)  [C3, V5 only]
      │     │  │  ├─ section What to do (ContentStep.tsx:538-557)  [C4]
      │     │  │  │  ├─ WhatToDoLead
      │     │  │  │  ├─ Decision → SingleDecision (ContentStep.tsx:977/981)
      │     │  │  │  │  ├─ Picker (components)
      │     │  │  │  │  └─ Options (ContentStep.tsx:1092)
      │     │  │  │  └─ ol.sections: before lines + instructions.steps
      │     │  │  ├─ Implementation (ContentStep.tsx:737-889)  [C5]
      │     │  │  │  ├─ ImplementationEmptyBox (StepSections.tsx:419)   (no artifacts)
      │     │  │  │  ├─ .impl-planning "Planned work" / review notes
      │     │  │  │  ├─ TabList .impl-tabs + .ai-warning + .impl-preview
      │     │  │  │  │  └─ AuthoredText (StepSections.tsx:375)   (markdown artifacts)
      │     │  │  │  ├─ StepDialog wide (implementation viewer)  [F]
      │     │  │  │  └─ .impl-support (Microsoft Learn · Troubleshooting · note · Source checked)
      │     │  │  ├─ DoneWhen (StepSections.tsx:631)  [C6]
      │     │  │  └─ (printing only) WhatIamaiFound, Who, Dates, More (ContentStep.tsx:583-620)
      │     │  └─ StepRail (StepSections.tsx:201) .step-side  [D]
      │     ├─ StepFooter (StepSections.tsx:222) .step-footer  [E]
      │     └─ StepDialog ×5 (StepSections.tsx:434)  [F]
      │        readiness, troubleshooting → Troubleshooting (ContentStep.tsx:896),
      │        confirm, rollout → ReasonForm (ContentStep.tsx:941), doesnt-apply → ReasonForm
      └─ CleanupRow (Plan.tsx:480)
         ├─ PlanRow  [A]
         └─ CleanupBody (CleanupStep.tsx:32)  article.step  (when open)
            ├─ StepHead (title + badge only; no eyebrow, no track)  [B]
            └─ div.step-body (no rail)  [C]
               ├─ StepSection Why (+ Learn →)  [C1]
               ├─ StepSection What to do  [C4]
               ├─ not-assessed note inputs (.decision)
               ├─ DoneWhen  [C6]
               ├─ Done date control (.decision)
               └─ Scan to update the plan / Close buttons (p.actions, not a .step-footer)
```

### 2.3 Node table

Anatomy letters refer to §2.1.

| Node | File:lines | Reads (origin) | Anatomy |
|---|---|---|---|
| `Plan` | `Plan.tsx:74-360` | `lastScan` (scan). `usePlanData` returns the computed plan (engine) and `mapping` with decisions applied (plan record + engine, `planData.ts:252-256`). Also `stepDecisions`, `confirmations`, `signature` (plan record). `planDates` (engine, `stepVars.ts:460`). | page, board |
| `laneReadings` / `observe` | `planLanes.ts:182-216` / `64-104` | Step lifecycle, condition, blockers, `action.missing`, `unavailableReason` (engine). `status === 'skipped'`, which comes from saved skips (plan record). `dependency-data.json` graph (engine). | row lane |
| `planStateOf` | `planState.ts:87-133` | `step.status`, `state.condition`, `checks.failing`, `emergency`, `scheduleOf` (engine). `isHeld` (engine). | row word, badge |
| `Row` | `Plan.tsx:519-606` | `statusOf(step)` (engine). `contentTitle` (content). `rowWho` (engine + scan names). `boardWhenOf`, `boardReasonOf`, `laneLabelOf`, `readinessBlockersOf` (`planBoard.ts:276/309/175/215`, engine). `step.scheduled.wave` (engine). | A |
| `PlanRow` | `StepSections.tsx:43-100` | Props only: word, tone, lane, title, who, when, reason, next label. `role="button"`, `aria-expanded`, Enter/Space toggles. | A (`.plan-row` ≈ pack `.roadmap-row`) |
| `ContentStep` setup | `ContentStep.tsx:242-461` | `contentStepFor(step)` (content, `stepTitle.ts:24`). `stepVars(step, ctx)` (scan + plan record + engine, `stepVars.ts:105`). `stepContract` (engine, `stepContract.ts:715-781`). `stepInstructions` (engine + baseline + content, `stepInstructions.ts:69`). `baselineConflictWords` (engine + content). `implementationIsCurrent` (engine, `nextSafeAction.ts:44`). Package state, bindings, runtime, projection, readiness, troubleshooting and preview (package + engine + scan + plan record `confirmations`; §3). `whoBlocks` / `whoLeadLine` (content + engine). `mergeReadiness(readinessOf(...), pkgReadiness)` (engine + package). | whole step |
| `StepHead` | `StepSections.tsx:132-161` | `eyebrowOf(contract, cs.kind)` (content + engine, `stepContract.ts:955`). `contentTitle` (content). `cs.changeLine` / `cs.partner` filled with `ex` (content + scan). `badgeLabel(contract)` (engine, `stepContract.ts:838` → `planState.ts:140` `badgeOf`). `contract.track` = `stepTrack` (engine, `stepContract.ts:253`; empty when lifecycle is null, set aside, or baseline-conflict). | B |
| `StepState` | `StepSections.tsx:118-130` | `nextCaption(contract)` = `contract.milestone.line`, dated only (engine, `stepContract.ts:939`). | B `.track-caption` |
| `PolicyMembers` | `StepSections.tsx:506-517` | `contract.members` (engine: `tracking.members`, `state.members`). Renders only when there are 2 or more members. | B (production addition, not in pack) |
| `LifecycleTrack` | `StepSections.tsx:174-190` | `contract.track` (engine). | B `.track` |
| Why section | `ContentStep.tsx:483-493` | `contract.why` = `cs.why` filled, or `step.why` (content / engine). `learn.url` (content). `Learn →` shows here **only when no Implementation region is drawn** (`learnUrl && !showImplementation`). | C1 |
| `ReadinessSection` | `StepSections.tsx:253-309` | `readiness.tiles` / `satisfied` / `bar` from `mergeReadiness` (`stepPackage.ts:503`) over `readinessOf` (`stepContract.ts:1178`). Its inputs: emergency tiers, the state tile, exclusions exposure, the people tile, the implementation tile (engine); `fix` (engine + content `checkFixes`); engine blockers from the lane reading (engine); package tiles evaluated with `holds()` (package + scan bindings + plan record confirmations). `onWhy` shows when `hasEvidence`. `lead` = `WhatToDoLead` when What to do is not shown. | C2 |
| `Tile` | `StepSections.tsx:318-354` | Tile `label` / `value` / `note` / `link` / `confirm`. `link` is a `#/plan/<id>` anchor or a button that opens Plan settings → Baseline mappings. | C2 `.readiness-tile` |
| `HardeningBody` | `StepSections.tsx:591-619` | `contract.hardening` (engine: `step.emergency`, content `checkFixes`). Defer and Undo write `HARDENING_DEFERRAL_ID` into `confirmations` (plan record). | C2 (Resilience tile evidence) |
| `MfaHandoff` | `MfaHandoff.tsx:60-109` | `stepMfaHold(step, scoredPeople(snapshot, mapping))` (engine + scan + plan record). `readinessView` rows (scan). `readinessCells.ts` words. Links `#/readiness/step/<id>`. | C2 (affected people inside Readiness) |
| Conflict callout | `ContentStep.tsx:527-536` | `baselineConflictWords(step)` (engine + content). `CONTRACT.attentionConflict` (content). | C3 `.attention.danger` (V5) |
| What to do | `ContentStep.tsx:538-557` | Shown when `decides \|\| createIfNeeded \|\| creates \|\| ownSteps` (`:355-360`). `ownSteps` = `!implementing && (instructions.steps.length > 0 \|\| before.length > 0)`. `w.createIfNeeded` / `w.create` with `ex.createIfNeeded` / `ex.needsCreate` (content + engine). `before` / `steps` from `stepInstructions` (content; emptied while `instructionsHeld`, `stepInstructions.ts:49-52`). | C4 |
| `SingleDecision` | `ContentStep.tsx:981-1081` | `cs.decision` (content). Picker rows from `ex[pickerKey]`, `pickerUniverse` (scan). Saved decision `decision.picked` / `option` / `answers` (plan record `stepDecisions`). `answerOf(ctx.mapping, …)` (plan record applied). Save calls `onDecide` → `planData.ts:494-502`. | C4 (decision primitive, pack §04) |
| `Implementation` | `ContentStep.tsx:737-889` | `artifacts`, `preview`, `notes`, `empty`, `source`, `learn`, `scenarios` (see §3). `copyArtifact` → `exportClipboard(…, unredactedFrom('implementation-artifact'))` (`:273-275`). | C5 (+ F implementation dialog) |
| `ImplementationEmptyBox` | `StepSections.tsx:419-426` | `empty`: `implementationEmptyOf(contract)` (engine + content) or `heldBox(key)` (package hold + content). | C5 `.implementation-empty` |
| `Troubleshooting` dialog | `ContentStep.tsx:684-686`, `896-934` | `troubleshootingSafely(pkg, pkgState, pkgBindings)` (package). Opened from the support line. | F (production addition) |
| `DoneWhen` | `StepSections.tsx:631-642` | `contract.doneWhen` = `doneWhenOf` (`stepContract.ts:673-708`: engine + content `cs.doneWhen` through `doneWhenTemplates`, `doneWhen.ts:19`). | C6 |
| Print-only blocks | `ContentStep.tsx:583-620` | `WhatIamaiFound` (`contract.found`, engine). Who (content + engine). Dates (`datesLineFor`, content + engine). `More` (`ContentStep.tsx:1139-1268`: risks, `ifWrongLineFor`, `commsFor`, help desk, `managerText`; content + engine + plan record signature). | none. The pack excludes these from the expanded step; production draws them only when `printing`. |
| `StepRail` | `StepSections.tsx:201-212` | `railOf(contract, when)` (`stepContract.ts:1202-1235`): milestone date, `scheduleOf` (engine), row `when` (engine), `CONTRACT.rail` words (content). | D |
| `StepFooter` | `StepSections.tsx:222-234` | The Exclude button when `cs.skip` (content). Doesn't apply here when `offersDoesntApply` (`ContentStep.tsx:156-160`; content + engine). Put back when `step.status === 'skipped'` (plan record). Scan button unless printing. | E |
| Readiness dialog | `ContentStep.tsx:630-683` | `contract.found` (engine). Who blocks (content + engine). `pkgReadiness.conclusion` / `whyItMatters` / `unknowns` / `references` (package). | F `#readiness-dialog` |
| Confirm dialog | `ContentStep.tsx:690-712` | `confirmTile.confirm`. `pkgRuntime.prerequisites` (package + plan record). `prerequisiteBasis` (package + scan bindings). Writes via `onConfirm` → `planData.ts:504-517`. | F (production addition) |
| Rollout / Doesn't apply dialogs | `ContentStep.tsx:713-718` | `CONTRACT.rollout`, `shared.doesntApplyPrompt` (content). Writes skips / `notApplicable` (plan record, `planData.ts:466-474`, `438-447`). | F `#rollout-dialog` |
| `CleanupRow` | `Plan.tsx:480-515` | `cleanupStatusOf(cleanupComplete(row, answers))` (engine + plan record `breakGlassAnswers`, `checkpoints`). `whoLineOf` over `phase.accountIds` (engine). `cleanupWhen` (engine). | A |
| `CleanupBody` | `CleanupStep.tsx:32-120` | `cleanupEntry(kind)` words (content). `cleanupVars(phase, row, notes)` (engine + plan record `notAssessedNotes`). Done writes checkpoints (plan record, `planData.ts:449-455`). No track, rail or footer; Scan and Close sit in `p.actions`. | B, C1, C4, C6 |

---

## 3. Implementation projector

### 3.1 Two ways to draw the region, never both

`ContentStep.tsx:317-335` decides which one applies:

```ts
const pkg = implementationPackageFor(step)                    // stepPackage.ts:76
const pkgState = pkg ? packageStateOf(step, contract, ctx.snapshot) : null
const pkgBindings = pkg && pkgState ? packageBindings(step, ctx, contract) : null
const pkgRuntime = … packageRuntime(pkg, pkgState, pkgBindings, confirmations, baselineCommit)
const projection = … projectSafely(pkg, pkgState, pkgBindings, pkgRuntime.runtime)
const preview = pkg && pkgBindings && pkgRuntime ? planningPreview(pkg, step, contract, ctx.snapshot, pkgBindings, pkgRuntime.runtime, projection) : null
const packaged = preview !== null || packageDrawsImplementation(pkg, projection)   // stepPackage.ts:106-108
```

- **Package path** (`packaged === true`). The artifacts are `(preview ?? projection).channels.map(packageArtifact)` (`ContentStep.tsx:379-380`), and `data-implementation="package"`.
  - `packageDrawsImplementation` is `pkg !== null && projection?.hold?.noProjection !== true`.
  - Consequence: a step with a package but no package state (set aside, so `projection` is null) still takes the package path. It has zero artifacts and gets the contract's empty box.
- **Translator path** (`packaged === false`). This happens when there is no active package, or when the package authors nothing for the state (`hold.noProjection`). Here `data-implementation="translator"`, and `artifacts` = `channels.map(...)` (`ContentStep.tsx:381`), with:
  - `channels = implementationIsCurrent(step) ? channelsFor(hasPortal, contract.implementation.offered) : []` (`:308-310`, `channelsFor` `:125-131`).
  - `portal` when `stepPortalLines` returned lines. That requires `cs.kind === 'policy'` and `implementationOffered(step)` (`stepInstructions.ts:74`, `stepPortal.ts:276-277`). The content's `before` lines are counted too.
  - `ps` and `json` together when `contract.implementation.offered` (= `policyResult(step).kind === 'implementable'`, `operations.ts:1292`).
  - `ai` whenever any other channel exists. **Email is never a translator channel.**
  - Texts (`:368-375`): portal = numbered lines; `ps` = `powershellFor(stepOperations(step))` (`stepPowerShell.ts:14`); `json` = `policyJsonText(step)` (`stepJson.ts:107`); `ai` = `stepContext(step, stepExportView)`.

**Which package applies** (`stepPackage.ts:45-95`):

- A step meets a package at the content entry its title comes from (`BY_CONTENT`, `contentStepFor` / `contentStepForPackage`).
- The package applies only while `registry.reviews[stepId].status` is `'current'` (drift.ts `driftOf`). Status `reviewNeeded` or `held` sets the package aside, and the step uses the translator path.
- In that case `notes` carries `implementation.review.reviewNeeded` or `implementation.review.held` (`ContentStep.tsx:402-403`), drawn as `.impl-planning[data-review]`.
- The source-checked date still comes from `reviewedPackageFor` (`:444-445`).

**Whether the region shows at all** (`ContentStep.tsx:408`): `showImplementation = artifacts.length > 0 || contract.policy`, where `contract.policy` is `step.kind` `create` or `adjust`. A decision, check or preparation step with no artifacts draws no Implementation section.

### 3.2 Channel set

| Package channel (`OUTPUT_ORDER`, `project.ts:30`) | Viewer tab id (`PACKAGE_CHANNEL`, `ContentStep.tsx:90`) | Label (`CHANNEL_TABS`, `ContentStep.tsx:141-147`) | Content key |
|---|---|---|---|
| `entra` | `portal` | Entra | `pages.app.plan.stepContract.railChannels.portal` |
| `powershell` | `ps` | PowerShell | `…railChannels.powershell` |
| `json` | `json` | JSON | `…railChannels.json` |
| `aiInfo` | `ai` | AI Info | `…stepContract.implementation.ai` |
| `email` | `email` | Email | `…stepContract.implementation.email` |

- No other output channel exists.
- The package's support channels `readiness` and `troubleshooting` (`meta.supportBlocks`) are not tabs. Readiness becomes tiles and the readiness dialog (`packageReadiness`, `project.ts:628`). Troubleshooting becomes the troubleshooting dialog (`troubleshootingFor`, `project.ts:582`).
- Tabs render in `CHANNEL_TABS` order, filtered to the channels present.
- The chosen tab is clamped to what is available (`ContentStep.tsx:766`).
- The AI tab draws `implementation.aiWarning` as a Callout above the text. `artifactText` (`stepPackage.ts:482-490`) strips a package line that repeats that warning.
- A markdown artifact renders through `AuthoredText`, and anything else through `<pre>`.

### 3.3 Package state: which state a step is in

There are nine states (`PACKAGE_STATES`, `protocol.ts:80`): `missing`, `partial`, `reportOnly`, `readyToEnforce`, `inPlace`, `blocked`, `needsDecision`, `sourceConflict`, `notLicensed`.

`packageStateOf(step, contract, snapshot)` (`stepPackage.ts:175-196`) checks these in order, and the first match wins:

1. `state.setAside` → `null` (no projection)
2. `condition === 'baseline-conflict'` → `sourceConflict`
3. `condition === 'needs-decision'` → `needsDecision`
4. `!executableNow(step)` → `blocked`. `executableNow` = `implementationIsCurrent(step) && policyResult(step).kind !== 'unavailable'` (`nextSafeAction.ts:65-67`). `implementationIsCurrent` is true when the condition is `healthy`. It is also true for a blocked, not-deployed step whose next milestone is `deploy`, whose implementation is offered, and whose operations do not enforce on run (`nextSafeAction.ts:44-58`).
5. `state.satisfied` → `inPlace`
6. `correctionFieldsOf(step, snapshot).length > 0` (update operations whose body changes fields of the tenant policy, `stepPackage.ts:139-148`) → `partial`
7. the operations contain both a create and an update (`partlyDeployed`) → `partial`
8. `lifecycle === 'ready-to-enforce'` → `readyToEnforce`
9. `lifecycle === 'report-only'` → `reportOnly`
10. lifecycle `not-deployed` or `null`, with a create operation → `missing`
11. `step.kind === 'prerequisite'` → `missing`
12. otherwise → `blocked`

`notLicensed` is never returned (`states.ts:20-30` `RUNTIME_REACH` agrees). Authored states outside the nine (such as `verificationRequired` or `activeTrip`) are never entered at runtime. `states.ts` only reconciles them for validation.

### 3.4 Selection rule per state (executable projection)

`projectSafely` → `projectImplementation` → `build(pkg, state, bindings, runtime, placeholder = null)` (`project.ts:228-230`, `269-456`). The table gives the outcome by state, then the checks in the order `build` applies them.

| State | Outcome of the executable projection |
|---|---|
| `inPlace`, `blocked`, `needsDecision`, `sourceConflict`, `notLicensed` (`NO_ACTION_STATES`, `project.ts:82`) | Returns early: `{ hold: null, channels: [] }` (`:271`), whatever the package authors. The UI shows the planning preview if one applies (§3.7), otherwise the contract's empty box. |
| `missing`, `partial`, `reportOnly`, `readyToEnforce` | Built from `meta.projection[state]` through the checks below. |

Checks, in order:

1. **No authored projection for the state** → `hold.noProjection` (`:274`). `packageDrawsImplementation` returns false, so the step falls back to the translator channels (§3.1).
2. **Prerequisites of the next transition.** These are `meta.prerequisites` whose `requiredBefore` starts with `"<state>->"` (`gatingPrerequisites`, `:176-178`) and that are not in `runtime.satisfied` → `hold.pendingPrerequisites`, no channels (`:279-280`).
   - `runtime.satisfied` = the prerequisites satisfied by `evidence` (a `holds()` condition over bindings, `conditions.ts:50`), or by a confirmation in the plan record whose `basis` still equals `prerequisiteBasis` (an FNV-1a hash over the prerequisite's `invalidatedBy` binding values; `project.ts:510-534`).
3. **`mode: "composeByMismatch"`** (Partial, `:285-300`).
   - `selectMismatches` (`:190-219`) picks correction modules whose `facts` cover a field in `policy.current.changedFields`. A module scoped with `member` reads `policies.<family>.<role>.current.changedFields` instead.
   - A module can also be picked when its `select` condition holds. With `alongside: true`, that only counts beside a module picked by facts.
   - A changed field that no module covers → `hold.unknownMismatches`, no channels (`:289`).
   - No module selected → `hold.invalid = ['no correction module is selected']` (`:290`).
   - Each channel's refs = `sharedBefore[ch]` + selected modules' refs + `sharedAfter[ch]` (the shared parts only when a module contributes refs), then `p[ch]`.
   - The selected module ids are bound under `mismatchBindingOf(p)`.
   - Otherwise (not composeByMismatch), each channel's refs = `refsOf(p[ch])` (`:302`).
4. **State-wide required values.** `p.requires`, plus the selected modules' `requires`, must be present (`present()`: not null, not blank, not an empty list; `conditions.ts:40-45`). Any missing → `hold.missingBindings`, no channels (`:309-310`).
5. **Per-channel build** (`:317-446`). For each block the channel names:
   - A missing block → invalid `"<id>: no such block"`.
   - `bindText` (`:120-135`):
     - `BINDING = /\{\{(json:)?([A-Za-z0-9_.-]+)\}\}/g` (`protocol.ts:133`).
     - A line naming a value IAMAI does not hold is dropped. If that value is in `meta.requiredBindings`, the whole block refuses (`missing`).
     - `{{json:x}}` accepts a deliberate `null` (`bound()`, `:100-104`). A plain `{{x}}` does not.
     - The marker `[omit this line when|if unavailable]` (`OMIT`, `:85`) is stripped from lines that bound.
   - After binding, `UNRESOLVED = /\{\{(?:json:)?[A-Za-z0-9_.-]+\}\}|\[omit (?:this line )?(?:when|if) unavailable\]/` (`:111`) → invalid `"an unresolved placeholder"` (`:339-342`).
     - A script's own literal `-like '{{*'` does **not** match. `*` is outside the key character class and there is no closing `}}`. `runtimeContract.test.ts:147` pins this.
   - **PowerShell** `kind: "deployableAfterBinding"` (`:344-357`):
     - It needs `meta.invocation` and at least one projection ref with a `mode`, otherwise invalid.
     - `renderInvocation` (`invocation.ts:115-139`) wraps the script in `function Invoke-IAMAIStep {…}` (or `invocation.function`) and emits one call per run.
     - A parameter binding IAMAI lacks → `missing`. A switch is passed only when its prerequisite is satisfied.
   - **JSON** (`:363-396`):
     - The block must be `format` `json` or `json-template` and carry `method` and `endpoint`.
     - `PATCH`/`PUT`/`DELETE` require an identity in the endpoint (`ENDPOINT_IDENTITY = /\{[A-Za-z0-9_.-]+\}/`).
     - The bound text must parse.
     - `bindEndpoint` fills `{key}` and refuses a missing key (never invents an id).
     - Several bodies for the same method and endpoint merge into one; two bodies that set the same top-level key differently are invalid.
     - Bodies for different requests → invalid `"bodies for N different requests"` (`:413-430`).
   - **Email** (`:397-404`) attaches `audience`, `communicationTrigger` and `purpose` metadata.
6. **A channel withheld on its own.** Any `miss` or `bad` for a channel → pushed to `degraded` (`{ channel, missingBindings, invalid }`) and skipped (`:434-437`). The other channels still project.
7. **Everything withheld.** If some channel was degraded and no remaining channel is **bearing** (its blocks bind a held value, have an endpoint identity, or have an invocation; `:438-443`), the whole projection is held. `hold.missingBindings` and `hold.invalid` become the union of the degraded channels', and there are no channels (`:450-452`).
8. **Runtime fault.** Any exception becomes `hold.invalid = ['runtime fault: …']`, logged to `console.error` by `reportPackageFault` (`projectSafely`, `:470-477`).

**Compile-time withholding** runs before any of this. `withholdInvalid` (`protocol.ts:875-885`, called from `compileLibraryPackage`, `:913-918`) removes the smallest invalid part of each package before the registry is written: a block, a prerequisite, a state, a key, a module, a channel of a state, a support block or entry, or a conclusion (`protocol.ts:459-470`, `777-800`).

- **`withheldModes`** (`invocation.ts:44`; validation `protocol.ts:604-605`): when a projection ref runs a PowerShell mode that the block's invocation lists in `withheldModes`, the validator raises an issue at that channel of that state. The channel is taken out of that state's projection in the compiled registry.
- At runtime such a channel is simply not in `meta.projection[state]`, so it never appears and is not in `degraded`.
- What happens when that removal leaves a state with no channels: **not traced**.

### 3.5 What the user sees when one channel is withheld

**Nothing.** The degraded channel's tab is absent: `CHANNEL_TABS` is filtered to the artifact ids (`ContentStep.tsx:768`). No line stands in for it (`ContentStep.tsx:396-399`).

The `{channel} is not shown` line: **not found**.

- No key in `docs/design/content.json` produces it. The only "is not shown" text is `implementation.review.held`, a drift note.
- `ContentStep.tsx` does not read `projection.degraded`.
- `implementationChannels.test.ts:111-127` asserts that `ContentStep` does not read `.degraded` or `W.withheld`, that `implementation.withheld` is absent, and that content contains none of `is not shown yet`, `is not shown:` or `IAMAI does not hold {values}`.
- Whatever really holds the step belongs in Readiness tiles instead (`SEGMENTS.md` S6 item 2).

### 3.6 When the whole Implementation is held: the empty boxes

The box renders only when `artifacts.length === 0` and the region is shown (`ContentStep.tsx:796-807`). Selection (`ContentStep.tsx:412-423`):

```ts
const hold = packaged ? (projection?.hold ?? null) : null
const empty = hold === null
  ? implementationEmptyOf(contract)                               // stepContract.ts:1245-1258
  : hold.pendingPrerequisites.length > 0 ? heldBox('confirmationsPending')
  : hold.unknownMismatches.length > 0   ? heldBox('correctionUnknown')
  : hold.invalid.length > 0             ? heldBox('packageFault')
  :                                       heldBox('bindingMissing')
```

`heldBox(key)` gives tone `warn` and title/text from `pages.app.plan.stepContract.implementation.empty[key]`.

**Held-projection boxes** (package path only):

| Key | Content (title / text) | Reached when |
|---|---|---|
| `confirmationsPending` | "Confirm the checks before enforcement" / "IAMAI cannot read these from Microsoft. Confirm them under Readiness, and the enforcement artifacts appear here." | step 2 of §3.4 |
| `correctionUnknown` | "Nothing to submit yet" / "IAMAI found a difference on this policy that the step's corrections do not cover, so no partial correction is offered." | step 3 of §3.4 (unknown mismatches) |
| `packageFault` | "Nothing to submit yet" / "This step's implementation content could not be projected safely, so no artifact is offered." | `hold.invalid` is non-empty: no module selected, every bearing channel degraded with an invalid reason, or a runtime fault |
| `bindingMissing` | "Nothing to submit yet" / "IAMAI does not yet hold every value this change needs, so no artifact is produced." | any other hold: state-wide `requires` missing, or every bearing channel degraded only for missing values |

`hold.noProjection` never reaches these boxes, because that case falls back to the translator (`packaged` is false).

**Contract boxes** (`implementationEmptyOf`) apply when there is no package hold: the translator path, a no-action package state, or a set-aside step. Checked in order:

1. `condition === 'baseline-conflict'` → `conflict` (danger)
2. `setAside` → `setAside` (neutral)
3. `satisfied` → `inPlace` (good)
4. `review-required` → `review` (warn)
5. `needs-decision` → `decision` (warn)
6. not offered and a `reason` exists → `unavailable` (warn)
7. `condition === 'blocked'` → `blocked` (warn)
8. not offered with a `hold`, or action kind `observe` → `observe` (neutral)
9. otherwise → `none` (neutral)

### 3.7 "Planned work": the planning preview

- **Exact phrase:** "Planned work".
- **Key:** `pages.app.plan.stepContract.implementation.preview.label`.
- **Sibling keys:**
  - `preview.text`: "This is the work once the prerequisites are resolved. It is not ready to run, so it cannot be copied yet."
  - `preview.textValues`: "Nothing blocks this step, but IAMAI cannot fill in every value yet, so this cannot be copied."
  - `preview.values`: "Values still to resolve: {values}."
  - `preview.value`: "‹{value}›"
  - `preview.checks` ("Checks to confirm first are under Readiness.") exists in content but nothing in `src/` reads it.

**When a preview is produced.** `planningPreview(pkg, step, contract, snapshot, bindings, runtime, executed)` (`stepPackage.ts:241-251`):

1. `state = packageStateOf(...)`. `null` (set aside) → no preview. `ContentStep` also needs `pkgBindings`, which is null in that case.
2. The executable projection wins. If `executed.hold === null && executed.channels.length > 0`, there is no preview.
3. `waitsOnValues` = the executable hold exists, `invalid` is empty, `unknownMismatches` is empty, `!noProjection`, and (`missingBindings` or `pendingPrerequisites` is non-empty).
4. The previewed state:
   - For a no-action state, `plannedPackageStateOf(step, contract, snapshot)` (`stepPackage.ts:212-222`):
     - null for set aside, satisfied, or baseline conflict
     - for `create` / `adjust` steps: `partial` (correction fields, or partly deployed planned operations), then `readyToEnforce`, `reportOnly`, `missing` (lifecycle not-deployed or null), else null
     - for `prerequisite` steps: `missing`
     - for anything else: null
   - For an action state, the same state, but only if `waitsOnValues`. Otherwise null (a correctionUnknown or packageFault hold gets no preview).
5. `planSafely(pkg, planned, bindings, runtime, placeholder)` runs `build` in planning mode (`project.ts:241-243`, `480-487`), where the placeholder is `‹<bindingLabel(binding)>›`:
   - The no-action early return is skipped, and pending prerequisites do not stop the build.
   - `hold.noProjection` still returns no channels.
   - Every value the drawn blocks need but IAMAI does not hold gets a stand-in (`planningValues`, `:252-267`). That covers required bindings in block text, endpoint `{keys}`, invocation parameter bindings and `p.requires`. It excludes `policy.current.changedFields`, the mismatch binding and `*.semanticMismatches`.
   - Unknown mismatches, per-channel degrading and the "every bearing channel degraded" rule still apply.
   - The result carries `preview: true`, `hold.missingBindings` = stand-in keys, and `hold.pendingPrerequisites`.
6. The preview is used only if `preview.preview && preview.channels.length > 0`.

`bindingLabel` (`stepPackage.ts:225-233`) names a binding from `implementation.values[binding]`. Without an entry, it splits the key on `.`, drops `policy` / `target` / `current`, and turns camelCase into words.

**What the screen does with a preview** (`ContentStep.tsx:332-395`, `737-889`):

- `packaged` is true, and `artifacts` are the preview's channels. Degraded channels are still omitted.
- `.impl-planning` shows the "Planned work" label and then:
  - `preview.textValues` when `contract.fix.length === 0 && !contract.state.held`, otherwise `preview.text`
  - `preview.values` filled with the distinct labels of `preview.hold.missingBindings`, when there are any
- `data-preview="true"` is set on the section.
- Copy is never offered, inline or in the expanded viewer: `copyable = preview === null && active !== null`. Expand is still offered.
- `implementing` is false while previewing (`:358`), so a step's own instructions can show under What to do beside it.
- The translator path has no planning preview. A held step without an active package shows only its contract box.

### 3.8 Support line under Implementation

`ContentStep.tsx:864-886`. It renders only when at least one of these parts exists:

- **Left:** "Microsoft Learn" (`implementation.learn`) linking to `cs.learn.url`, then " · ", then a "Troubleshooting" button (`implementation.troubleshooting`) when `scenarios.length > 0` and the page is not printing.
- **Note:** the active artifact's note. For PowerShell runs it is `implementation.powershellInvocation` filled with the modes. For JSON requests it is `METHOD endpoint`, joined with " · " (`packageArtifact`, `ContentStep.tsx:98-108`).
- **Right:** `packageSourceLine` (`stepPackage.ts:116-119`) = "Source checked {date}" (`implementation.sourceChecked`). The date is `sourceUpdatedOn(pkg)` (`project.ts:548-554`): the latest `verifiedSources[].checkedOn` among `userFacing === true` sources that match `/^\d{4}-\d{2}-\d{2}$/`, rendered from `T12:00:00Z`. There is no line when none match.

### 3.9 State → what the Implementation region shows (summary)

| Step situation | Drawn by | Artifacts | Copy | Box / note |
|---|---|---|---|---|
| Package, action state, executable projection with channels | package | the state's projected channels, minus degraded ones | yes | none |
| Package, action state, held on prerequisites or values, preview projects | package (preview) | planned channels with `‹value›` stand-ins | no | "Planned work" + text + values |
| Package, action state, held, no usable preview | package | none | none | `confirmationsPending` / `correctionUnknown` / `packageFault` / `bindingMissing` |
| Package, no-action state (`inPlace`, `blocked`, `needsDecision`, `sourceConflict`), `plannedPackageStateOf` previews | package (preview) | planned channels | no | "Planned work" |
| Package, no-action state, no preview | package | none | none | `implementationEmptyOf(contract)` |
| Package authors nothing for the state (`noProjection`) | translator | translator channels if `implementationIsCurrent` | yes | contract box when none |
| Package set aside by re-pin review (`reviewNeeded` / `held`) | translator | translator channels | yes | review note line |
| No package | translator | Entra / PowerShell / JSON / AI Info as available; never Email | yes | contract box when none |
| Step set aside (with or without a package) | package or translator | none | none | `setAside` |
| Non-policy step with no artifacts | none | none | none | no Implementation section at all |
