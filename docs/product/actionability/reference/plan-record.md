# Plan record: persistence reference

What IAMAI keeps in the browser about a plan: the stores, the shapes, who writes and reads each field, and the record's lifecycle. This was extracted from the code at `4cde3e6`. Where the code does not answer a question, the entry says "not found".

## Sources

- `src/graph/collect/cache.ts`
- `src/mapping/store.ts`
- `src/mapping/types.ts`
- `src/mapping/emergencyChoice.ts`
- `src/mapping/safetyChoice.ts` (grep: `EXCLUSIONS_RECORD_KEY`, `exclusionsGroupRecord`)
- `src/roadmap/decisions.ts`
- `src/roadmap/progress.ts`
- `src/roadmap/plan.ts`
- `src/roadmap/observation.ts`
- `src/roadmap/cleanupDone.ts`
- `src/roadmap/tracking.ts` (grep: `observations`)
- `src/roadmap/generate.ts` (grep: `planIdFor`, `notApplicable`, `hardeningDeferral`)
- `src/roadmap/baselineConflict.ts` (grep: `RETIRED_DECISION_STEPS`)
- `src/roadmap/sourceMappings.ts` (grep: `BASELINE_MAPPINGS_KEY`)
- `src/roadmap/stepIds.ts` (grep: `BREAK_GLASS_STEP_ID`, `PREREQ_STEP_ID`)
- `src/roadmap/blockerSteps.ts` (grep: `blockerStepId`, `isEmergencyAccess`)
- `src/roadmap/constants.ts` (grep: `SizeBand`, `BANDS`)
- `src/roadmap/schedule.ts` (grep: `ChangeFreeze`)
- `src/validation/emergencyTiers.ts` (grep: `HARDENING_DEFERRAL_ID`)
- `src/derive/planStart.ts` (grep: `effectiveFirstDeployment`, `proposedStart`)
- `src/ui/surfaces/planData.ts`
- `src/ui/surfaces/Plan.tsx`
- `src/ui/surfaces/Export.tsx`
- `src/ui/surfaces/ContentStep.tsx` (excerpts and grep)
- `src/ui/surfaces/CleanupStep.tsx` (grep)
- `src/ui/surfaces/PlanFooter.tsx` (grep)
- `src/ui/surfaces/BaselineMappings.tsx` (grep)
- `src/ui/surfaces/pickerRows.ts` (grep: `appliedMapping`)
- `src/ui/surfaces/planLanes.ts` (excerpts)
- `src/ui/surfaces/planBoard.ts` (grep: `Focus`, `NO_FOCUS`)
- `src/ui/surfaces/Connect.tsx` (grep)
- `src/ui/surfaces/MfaReadiness.tsx` (grep)
- `src/ui/App.tsx` (excerpts)
- `src/ui/actions.ts`
- `src/ui/session.ts`
- `src/ui/demo.ts` (excerpt)
- `src/ui/demoMode.ts`
- `src/ui/exportGuard.ts`
- `src/ui/tipState.ts`
- `src/ui/preloadError.ts` (grep)
- `src/ui/shell/AppShell.tsx` (grep)
- `src/ui/scan/scanRecord.ts` (grep)
- `src/ui/baseline.ts` (grep: `origin`)
- `src/ui/diagnosticsDownload.ts` (grep)
- `src/ui/sessionTruth.test.ts`
- `src/graph/msal.ts` (excerpt)
- `src/graph/auth.ts` (grep)
- `src/graph/collect/onDemand.ts` (grep)
- `src/graph/collect/laneB.ts` (grep)
- `src/redact.ts` (grep)
- `src/redactSnapshot.ts` (grep)
- `SECURITY.md` (grep)
- `home/index.html` (grep)
- `docs/product/actionability/RUN-CONTEXT.md`
- `docs/product/actionability/IAMAI-Actionability-Dependency-Playbook.md` (grep)
- `docs/product/actionability/BLOCKED.md`

Terminology used below:

- **Plan record**: the row in the `plan` object store. Its type is `PlanDecisions`.
- **Mapping record**: the row in the `mapping` object store. Its type is `MappingState`.
- **Plan file**: the JSON download produced by Export → Save plan file. Its type is `PlanFile`.

---

## 1. Browser storage

### 1.1 IndexedDB

- **Database name:** `iamai` (the one database).
- **Version:** `7` (`src/graph/collect/cache.ts:75`).
- **Opening:** `db()` at `cache.ts:74-119` opens it once per page and memoises the promise in `dbPromise`.
  - Every connection closes itself on `versionchange` (`cache.ts:107-110`).
  - An open that takes longer than 6000 ms rejects with `StorageBlockedError` (`cache.ts:65-72`, `cache.ts:113`).
  - `probeStorage()` (`cache.ts:278-280`) is called from `App.tsx:295`, only once an account exists. A failure renders `app.shell.storageBlocked` as a Callout (`App.tsx:336`).
- **Failure handling:** every load/save helper swallows errors. A failed load returns `null` and a failed save does nothing (`cache.ts:121-256`). `forgetTenant` is the exception: it throws.

| Store | keyPath / key shape | Indexes | Value type | Created at (upgrade) | Written by | Read by |
|---|---|---|---|---|---|---|
| `signin-rows` | `['tenantId', 'id']`, i.e. `[string, string]` | `byTenant` on `tenantId` | `StoredSignIn & { tenantId }` | `oldVersion < 1`, `cache.ts:77-79` | `saveEvidenceCache` (`cache.ts:159-182`) via `graph/collect/laneB.ts:36` | `loadEvidenceCache` (`cache.ts:142-157`) via `laneB.ts:30` |
| `evidence-meta` | `'tenantId'` | none | `EvidenceCacheMeta` `{ tenantId, covered{from,to}, asOf, schema? }` | `oldVersion < 1`, `cache.ts:80` | `saveEvidenceCache` | `loadEvidenceCache` (a stale `schema` is ignored, `cache.ts:151`) |
| `group-members` | `['tenantId', 'groupId']` | `byTenant` on `tenantId` | `GroupMembersCacheEntry` | `oldVersion < 2`, `cache.ts:82-85` | `saveGroupMembersCache` via `graph/collect/onDemand.ts:198`; demo seed `App.tsx:120`; mock seed `App.tsx:187` | `loadGroupMembersCache` via `onDemand.ts:132`, `onDemand.ts:217` |
| `mapping` | `'tenantId'` | none | `{ tenantId } & Record<string, unknown>`; in practice `MappingState` | `oldVersion < 3`, `cache.ts:86-88` | `saveMappingRecord` (`cache.ts:193-200`) via `mapping/store.ts:20-22 saveMappingState` | `loadMappingRecord` (`cache.ts:184-191`) via `mapping/store.ts:10-18 loadMappingState` |
| `plan` | `'tenantId'` | none | `{ tenantId } & Record<string, unknown>`; in practice `PlanDecisions`, or the demo's `DemoSnapshotState` | `oldVersion < 4`, `cache.ts:89-91` | `savePlanRecord` (`cache.ts:211-218`), called from `planData.ts:368`, `Export.tsx:216`, `App.tsx:137-138` | `loadPlanRecord` (`cache.ts:202-209`), called from `planData.ts:182`, `planData.ts:546`, `App.tsx:135` |
| `snapshot` | `'tenantId'` | none | `ScanRecord` `{ snapshot: TenantSnapshot; at: string }` (`ui/scan/scanRecord.ts:7`) | `oldVersion < 5`, `cache.ts:92-94` | `saveSnapshotRecord` via `ui/actions.ts:122` (scan) | `loadSnapshotRecord` via `actions.ts:117` (MFA history merge), `actions.ts:299` (restoreSession), `ui/diagnosticsDownload.ts:21` |
| `baseline` | `'tenantId'` | none | `BaselineResult['origin']`: `{ kind:'github'; owner; repo; commit; files? } \| { kind:'upload'; files }` (`ui/baseline.ts:20`) | `if (!d.objectStoreNames.contains('baseline'))`, `cache.ts:95-97` | `saveBaselineRecord` via `actions.ts:246` (only a pick: `chosen === true`) | `loadBaselineRecord` via `actions.ts:304` |

Notes on the upgrade code (`cache.ts:76-98`):

- Versions 1–5 each have an `oldVersion < N` block.
- Version 6 has no block of its own.
- Version 7 creates `baseline` by an existence check rather than a version check. Per the comment, the store was first declared under version 6 without a bump.
- No store is ever deleted or migrated in `upgrade`.
- Record-shape migrations happen on read, not in `upgrade` (§3.3).

Every `save*Record` writes `{ ...value, tenantId }`, so the stored row always carries its key. `d.put` replaces the whole row, so no save merges fields.

### 1.2 Web storage (sessionStorage / localStorage)

`src/ui/sessionTruth.test.ts:66-77` asserts the complete list of source files that call `.setItem(`, and the key each one uses.

| Storage | Key | Value | Written at | Read at | Cleared by |
|---|---|---|---|---|---|
| localStorage | `iamai-theme` | theme (`light` / `dark`) | `src/ui/shell/AppShell.tsx:97` (`THEME_KEY`, `:84`); also `home/index.html:132-155` | `AppShell.tsx:89` | not found (never removed) |
| localStorage | `iamai.tip.<page>` | `'closed'` \| `'open'` | `src/ui/tipState.ts:26-32` (`KEY`, `:6`) | `tipState.ts:17-23` | not found (never removed) |
| sessionStorage | `iamai.preloadReloaded` | `'1'` | `src/ui/preloadError.ts:15` (`PRELOAD_RELOAD_KEY`, `:6`) | `preloadError.ts:14` | not found in app code (tab close only) |
| sessionStorage | MSAL cache keys (`msal.*` and keys matching `login.windows` / `microsoftonline`) | MSAL token cache | MSAL library (`src/graph/msal.ts:18` `cacheLocation: 'sessionStorage'`) | MSAL library | `clearAuthCache()` `msal.ts:103-109`, called from the sign-out path `msal.ts:93` |

No plan, mapping or tenant data goes to web storage. The Plan board's focus state (`Show completed`, `Show deferred`, search, filters) is React `useState` (`Plan.tsx:96`, `NO_FOCUS` at `planBoard.ts:372`) and is not persisted anywhere.

---

## 2. The persisted plan record

The plan is **not** stored. Only decisions are:

- `planData.ts:51-56` and `progress.ts:119-127`: "The persisted record holds decisions only… Steps, statuses, populations, evidence and dates are regenerated from the snapshot on every load and re-scan."
- Lanes (Ready / Up Next / On Hold / Completed / Deferred) are not stored either. `planLanes.ts` derives them on every render.

Two IndexedDB rows together make up "what a person decided":

1. **`plan` store → `PlanDecisions`**: skips, dates, freeze, checkpoints, step decisions, confirmations, observations, signature.
2. **`mapping` store → `MappingState`**: the tenant mapping and Setup answers.

The plan applies every saved `stepDecisions` entry over the stored mapping on each derivation (`pickerRows.ts:239-241 appliedMapping` → `decisions.ts:143 applyStepDecisions`). **The applied result is not written back by `planData.ts`.**

### 2.1 Type definitions (verbatim)

`src/roadmap/decisions.ts:17-101`:

```ts
/** A step the operator set aside, with the reason and when. */
export type SkipDecision = { reason: string; at: string }

/**
 * A picker's saved decision: the ticked ids, the chosen option, the answers to
 * the step's questions by their label, and when (prompt 52 Part 3).
 */
export type StepDecision = { picked?: string[]; option?: string; answers?: Record<string, string>; at: string }
/** What a Save hands over: the decision without its time. */
export type StepDecisionInput = Omit<StepDecision, 'at'>

export type OwnerConfirmation = { at: string; basis: string }

export type PlanDecisions = {
  planId: string
  /** Skipped steps by id. */
  skips: Record<string, SkipDecision>
  /** The plan start the operator set, when they set one (prompt 49.1 item 11). */
  startDate?: string
  /** When Start the plan was pressed (target-state §5): the anchored dates hold from here. */
  startedAt?: string
  firstDeployment?: string
  /** The size band override, when set. */
  band?: SizeBand
  /** The change freeze, when set. */
  freeze?: ChangeFreeze | null
  /** Plan checkpoints written at save time. */
  checkpoints: unknown[]
  planCreatedAt?: string
  /** Every picker's saved decision, by step id (prompt 52 Part 3). */
  stepDecisions?: Record<string, StepDecision>
  /** Owner confirmations of the checks IAMAI cannot read, by step id, then by prerequisite id. */
  confirmations?: Record<string, Record<string, OwnerConfirmation>>
  observations?: Record<string, import('./observation.ts').StepObservationRecord>
  reportOnlySeen?: Record<string, string>
  /** The name every Tell your people box signs with (Plan settings); in the plan file. */
  signature?: string
}
```

(Multi-line doc comments on `firstDeployment`, `planCreatedAt`, `observations` and `reportOnlySeen` are abridged here. See the source for the full text.)

Referenced types:

```ts
// src/roadmap/constants.ts:15
export type SizeBand = 'small' | 'mid' | 'large'
// src/roadmap/schedule.ts:67
export type ChangeFreeze = { from: string; to: string }

// src/roadmap/cleanupDone.ts:12
export type CleanupCheckpoint = { at: string; cleanup: CleanupKind; date: string }
// CleanupKind values accepted (cleanupDone.ts:18): 'alerting' | 'drill' | 'hardening' | 'naming' | 'consolidation' | 'notAssessed'

// src/roadmap/observation.ts:47, 62-106, 548-553
export type ObservedState = 'absent' | 'disabled' | 'report-only' | 'enforced' | 'unknown'
export type StepObservation = {
  artifact: string | null        // artifactIdOf(policyId): two FNV-1a hashes, never the raw id
  state: ObservedState
  semantics: string              // fingerprint of conditions/grantControls/sessionControls
  fields: Record<string, string> // per-dimension fingerprints
  firstSeenAt: string
  since: 'first-scan' | 'observed-change'
  lastSeenAt: string
  evidenceAt: string | null
}
export type StepObservationRecord = {
  members: Record<string, StepObservation>   // keyed by memberKeyOf (hashed baseline policy key, or `m{index}`)
  unattributed: StepObservation | null
}

// src/roadmap/plan.ts:14-32 (a scan checkpoint; only ever produced by Save plan file)
export type Checkpoint = {
  at: string
  coverage: { goalId: string; state: string }[]
  tenantPolicies: { id: string; state: string; microsoftManaged: boolean; laneB: { reportOnlyFailure: number; reportOnlyInterrupted: number; enforcedFailure: number; enforcedSuccess: number } | null }[]
  mfaStateCounts: TenantMfaSummary['counts']
  activityCounts: TenantMfaSummary['activityCounts']
  exclusionGroups: { groupId: string; memberCount: number; memberIds?: string[] }[]
  breakGlass: { userId: string; lastSignIn: string | null }[]
  adminIds?: string[]
  capabilities: TenantSnapshot['capabilities']
  laneBCoveredWindow: { from: string; to: string } | null
}
```

The load-time read type, `src/ui/surfaces/planData.ts:56`:

```ts
type LegacyOrDecisions = Partial<PlanDecisions> & { steps?: Record<string, { status: string; skipReason?: string | null; history?: { at: string }[] }> }
```

The mapping record, `src/mapping/types.ts:30-112`:

```ts
export type Provenance = 'auto' | 'confirmed' | 'overridden'

export type ValidationResult = {
  checkedAt: string
  passed: boolean
  findings: string[]
  toFix?: number
  recommended?: number
  unknown?: number
}

export type MappingRecord = {
  placeholder: string
  kind: string
  group: QuestionGroup
  resolvedId: string | null
  resolvedName: string | null
  provenance: Provenance
  doesNotExist: boolean // → Phase 0 step
  validation: ValidationResult | null
}

export type MappingState = {
  tenantId: string
  records: Record<string, MappingRecord>
  variantChoices: Record<string, string> // intentKey → chosen policy name
  facetOverrides: Record<string, { on: boolean; reason: string }>
  targetState: Record<string, { include: boolean; reason: string | null }>
  breakGlassUserIds: string[]
  breakGlassPriorIds?: string[]
  breakGlassAnswers?: { credentialStorage: boolean | null; signInMonitoring: boolean | null }
  highCareUserIds: string[]
  trustedLocationIds: string[]
  serviceAccountsGroupId: string | null
  serviceAccountUserIds: string[]
  serviceAccountRejectedIds: string[]
  allowedCountries: string[]
  displayTimeZone: string | null
  frameworks: string[]
  wizardAnswered: Record<string, boolean>
  assumed?: Record<string, 'detected' | 'confirmed' | 'noneFound'>
  notApplicable?: Record<string, string>
  questionAnswers?: Record<string, string>
  notAssessedNotes?: Record<string, string>
  omittedReferences?: string[]
  updatedAt: string
}
```

(Doc comments abridged; `QuestionGroup` is at `types.ts:4-12`. The defaults come from `emptyMappingState`, `types.ts:114-135`.)

The demo's extra row types, `src/ui/demo.ts:103-109`:

```ts
export type DemoSnapshotKey = 'initial' | 'followUp'
export type DemoPlanRecord = Record<string, unknown> & { stepDecisions?: Record<string, unknown>; checkpoints?: unknown[] }
export type DemoSnapshotState = { current: DemoSnapshotKey; records: Partial<Record<DemoSnapshotKey, DemoPlanRecord>> }
export type DemoSeed = { decisions: Record<string, StepDecision> | null; checkpoints: unknown[] | null }
```

### 2.2 How the record is written and read (common path)

- **In-memory owner:** `usePlanData` (`src/ui/surfaces/planData.ts:133-530`) holds `saved: PlanDecisions | null` (`:142`) and `mapping: MappingState | null` (`:141`).
- **Load** (`planData.ts:182-190`): `Promise.all([loadMappingState(tenantId), loadPlanRecord(tenantId)])` → `setSaved(decisionsOf(p, planId))`.
- **Plan-record write** (`planData.ts:341-370`): one effect writes the whole `PlanDecisions` via `savePlanRecord` after `computed` exists, but only when `readOnly` is false.
  - It is skipped when a JSON key of the persisted fields equals the last write (`lastPersist`, `:365-367`).
  - That key covers skips, startDate, startedAt, firstDeployment, band, freeze, stepDecisions, confirmations, observations, signature, and cleanup entries of checkpoints. It does not include `planId` or `planCreatedAt`.
  - `lastPersist` starts as `''`, so each mount of a writing surface writes once.
- **Mapping writes** are immediate: each mapping setter calls `saveMappingState(next)` (`planData.ts:386, 435, 445, 463, 490`).
- **Which surfaces write:**
  - `Plan.tsx:81` `usePlanData(scan, baseline)` writes.
  - `Export.tsx:80` `usePlanData(scan, baseline)` also writes.
  - `Connect.tsx:493` and `MfaReadiness.tsx:101` pass `readOnly = true` and never write.
  - `MfaReadiness.tsx:118` also reads via `useAppliedMapping` (`planData.ts:538-556`), which never writes.
- **Not fenced by the tenant turn:** `planData.ts` does not use `tenantTurn` / `stillThisTurn`. Its writes are gated only on `snapshot` being non-null.

### 2.3 Field table: `PlanDecisions` (the `plan` store)

| Field | Type | Required | Meaning | Written (file:function ← UI control) | Read (file:function → surface) |
|---|---|---|---|---|---|
| `tenantId` | `string` | yes (added by `savePlanRecord`) | Store key (the snapshot's tenant id) | `cache.ts:214 savePlanRecord` | `cache.ts:205 loadPlanRecord` |
| `planId` | `string` | yes | `plan-<first 8 chars of tenantId>` (`generate.ts:2225-2227 planIdFor`) | `planData.ts:345`; `decisionsOf` keeps a stored one (`progress.ts:173`) | Not read for derivation; `usePlanData` computes `planId` from the tenant id (`planData.ts:140`) and passes it to `generateRoadmap` |
| `skips` | `Record<stepId, SkipDecision>` | yes | Steps the owner set aside. **This is the stored Deferred.** | `planData.ts:466-474 onSkip` ← ContentStep "Skip this step" (`ContentStep.tsx:1254`) and the rollout-exception dialog (`ContentStep.tsx:459` opens it, `:714` confirms); both gated by content `cs.skip`. Removed by `planData.ts:475-484 onUnskip` ← "Put back" (`ContentStep.tsx:457`, `:1265`) | `progress.ts:196-206 applySkips` (ignored for emergency-access ids, `blockerSteps.ts:45`) sets `status 'skipped'`; `planLanes.ts:150` maps skipped → OwnerState `deferred`; `planLanes.ts:158-159` → lane `Deferred`; Plan board (`Show deferred`) |
| `startDate` | `string` (ISO, noon UTC) | no | Anchored plan start; absent means propose today on each visit (`planData.ts:260`, `derive/planStart.ts:39-41`) | `planData.ts:390-402 setStart` ← Plan header date input (`Plan.tsx:287`) and Plan settings "Plan starts" (`Plan.tsx:637`); `planData.ts:411-416 startPlan` ← "Start the plan" (`Plan.tsx:291`) | `planData.ts:260` → `generateRoadmap({ startDate })` → Plan, Export, print, ICS |
| `startedAt` | `string` (ISO) | no | When "Start the plan" was pressed. Plan-level, not per step. | `planData.ts:414 startPlan` ← `Plan.tsx:291`; cleared when `setStart(null)` (`planData.ts:399`) | `planData.ts:409-410` `startedFrom` / `startedAt` → Plan header line `Plan.tsx:272` and hides the start field (`:282`); `derive/planStart.ts:25 effectiveFirstDeployment`; Export plan file (`Export.tsx:177`) |
| `firstDeployment` | `string` (ISO) | no | First day deployment-capable work lands | `planData.ts:403-406 setFirstDeployment` ← Plan settings "First deployment" (`Plan.tsx:641`); anchored by `startPlan` (`:414`); reset by `setStart` when it would precede the start (`:398`) | `planData.ts:265` `effectiveFirstDeployment` → `generateRoadmap({ firstDeployment })` |
| `band` | `SizeBand` | no | Size-band override (`BANDS`: small 4 weeks, mid 8 weeks, large 12 weeks; `constants.ts:16-20`) | `planData.ts:417-420 setBand`. **No UI control found** calling it. Also set by plan-file load (`Export.tsx:205-210`). | `planData.ts:270` → `generateRoadmap({ band })`; Export plan file `schedule.band` |
| `freeze` | `ChangeFreeze \| null` | no | Change-freeze window | `planData.ts:421-424 setFreeze` ← Plan settings freeze from/to (`Plan.tsx:651`, `:653`) | `planData.ts:271` → `generateRoadmap({ changeFreeze })` |
| `checkpoints` | `unknown[]` | yes | Mixed list: `CleanupCheckpoint` entries (Cleanup row Done), plus `Checkpoint` scan snapshots **only if a plan file was loaded** (Save plan file does not write to IndexedDB) | `planData.ts:449-455 markCleanupDone` → `cleanupDone.ts:31 withCleanupDone` ← Cleanup row Done (`CleanupStep.tsx:98`, wired `Plan.tsx:235`); `Export.tsx:206-216` (plan-file load); demo seed `demo.ts:127-131` | `planData.ts:312 cleanupRecord(saved.checkpoints)` → `generateRoadmap({ cleanupRecord })` (row done dates, drill dates); `planData.ts:448` → `Export.tsx:177` into the plan file |
| `planCreatedAt` | `string` (ISO) | no | When the plan was first generated. A policy created after it is the plan's own. | `planData.ts:351` (`saved.planCreatedAt ?? new Date().toISOString()` on first persist). No UI control. | `planData.ts:320 applyProgress(..., saved.planCreatedAt)` → tracking |
| `stepDecisions` | `Record<stepId, StepDecision>` | no (always written as `{}` or more) | Each picker's / decision's saved answer (§2.5) | `planData.ts:494-502 onDecide` ← decision Save (`ContentStep.tsx:1029-1035`, passed via `Plan.tsx:215`); Baseline mappings Save / clear (`BaselineMappings.tsx:78`, `:46`, via `Plan.tsx:671` under key `BASELINE_MAPPINGS_KEY`); demo seed `demo.ts:130` | `planData.ts:200`, `:255` `appliedMapping(..., saved.stepDecisions)` → every derived surface; `Plan.tsx:215` `decision` prop → ContentStep; `Plan.tsx:671` BaselineMappings `saved`; `planData.ts:549` → MFA Readiness |
| `confirmations` | `Record<stepId, Record<prereqId, OwnerConfirmation>>` | no (omitted when empty) | Owner confirmations of checks IAMAI cannot read, each with a `basis` fingerprint. **Also carries the emergency-access hardening deferral** under `[s-prereq-break-glass]['hardening-deferred']`. | `planData.ts:504-517 onConfirm` ← Readiness tile Confirm dialog (`ContentStep.tsx:436-439`) and hardening Defer (`ContentStep.tsx:514`); `planData.ts:518-528 onUnconfirm` ← `ContentStep.tsx:701` and hardening Undo (`ContentStep.tsx:515`) | `planData.ts:314` `hardeningDeferral` → `generate.ts:1151 hardeningDeferred`; `Plan.tsx:215` → ContentStep → `content/implementation/project.ts` (prerequisite confirmations) |
| `observations` | `Record<stepId, StepObservationRecord>` | no (always written) | IAMAI's own scan-to-scan history per required policy member (hashed artifact and member ids) | `planData.ts:360 observationsOf(computed.steps, saved.observations)` on every persist. No UI control. | `planData.ts:320 applyProgress(..., saved.observations)` → `tracking.ts:808-819` |
| `reportOnlySeen` | `Record<stepId, string>` | no | Legacy (pre-Foundation-B) report-only date per step | **Never written** (read-only migration source) | `observation.ts:585-591 observationsFrom` migrates it into `observations` |
| `signature` | `string` | no (omitted when empty) | Name the "Tell your people" boxes sign with (default `'IT'`, `planData.ts:425`) | `planData.ts:426-429 setSignature` ← Plan settings text input (`Plan.tsx:669`) | `Plan.tsx:215` → ContentStep / stepVars; `Export.tsx:177`, `:224` |

Other fields `decisionsOf` drops on load: a legacy `steps` blob. Only its skips are kept (`progress.ts:141-144`).

### 2.4 Field table: `MappingState` (the `mapping` store)

**How writes happen:**

- `mapping/store.ts:20-22 saveMappingState` always stamps `updatedAt`.
- The planData setters write the stored, un-applied mapping.
- Two other writers save a whole `MappingState` directly:
  - `App.tsx:112` (demo seed) and `App.tsx:194` (mock only).
  - `Export.tsx:217` (plan-file load, which writes `plan.mappings`).
- `plan.mappings` was built from `data.mapping`, the **applied** mapping (`Export.tsx:177`, `planData.ts:378`).

**Where decision-derived fields live:** `breakGlassUserIds`, the exclusions record, `questionAnswers`, `allowedCountries` and similar are produced at derive time by `applyStepDecisions` (`decisions.ts:143-231`). On the normal path they are not persisted into this store. They only reach the store through a plan-file load.

| Field | Type | Required | Meaning | Written (← control) | Read (→ surface) |
|---|---|---|---|---|---|
| `tenantId` | `string` | yes | Store key | `store.ts:17` forces it; `cache.ts:196` | `loadMappingState` |
| `records` | `Record<string, MappingRecord>` | yes | Resolved references. `__globalExclusion` (`safetyChoice.ts:319`) = exclusions group; `__breakGlassMissing`; source references by lowercased id | Derive-time only via `decisions.ts:174`, `:193`, `:202`; stored via plan-file load / mock seed | `safetyChoice.ts` (`exclusionsGroupIdToVerify`, `actionableExclusionsGroupId`), `planData.ts:219`, `:287`; resolvePolicy |
| `variantChoices` | `Record<string,string>` | yes | Baseline variant chosen per intent | No writer found in UI | `generate.ts:1229`; `plan.ts:205` (plan file `baseline.variantChoices`) |
| `facetOverrides` | `Record<string,{on,reason}>` | yes | Facet overrides for coverage | No writer found in UI | `planData.ts:288` → `coverage.ts:154` |
| `targetState` | `Record<string,{include,reason}>` | yes | Include-in-plan per baseline policy | No writer found in UI | not traced |
| `breakGlassUserIds` | `string[]` | yes | Confirmed emergency-access accounts | Derive-time only, via `decisions.ts:189-194`. Requires provenance `'confirmed'`, i.e. `stepDecisions['s-prereq-break-glass' \| blockerStepId('breakGlass')].picked`. Emptied on load when unproven (`emergencyChoice.ts:88-97`). | `store.ts:38 toCoverageMapping`; `Export.tsx:170` (checkpoint); `derive/sets.ts notPeopleIds` |
| `breakGlassPriorIds` | `string[]` | no | Ids with no proof of operator authorship; offered in the picker, never used | `emergencyChoice.ts:88-97 migrateEmergencySelection` (on load) | `emergencyChoice.ts:69-71`, `:113` → emergency picker |
| `breakGlassAnswers` | `{ credentialStorage; signInMonitoring }` | no | Two emergency-access attestations Graph cannot read | `planData.ts:485-492 tickAnswer`. `Plan.tsx:215` passes it to `Row` as `onTick`, but `Row` does not forward `onTick` to `ContentStep` (`Plan.tsx:586-602`). **UI control not found.** | `Plan.tsx:150`; `cleanupDone.ts:90-96 cleanupComplete`; `validation/report.ts:31`; `Export.tsx:355`; `Connect.tsx:497` |
| `highCareUserIds` | `string[]` | yes | High-care people (campaign picker) | Derive-time `decisions.ts:216` (`s-verify-mfa`) | not traced |
| `trustedLocationIds` | `string[]` | yes | Trusted named locations | Derive-time `decisions.ts:209` | not traced |
| `serviceAccountsGroupId` | `string \| null` | yes | Service-accounts group | No UI writer found | `planData.ts:221`; `store.ts:41` |
| `serviceAccountUserIds` / `serviceAccountRejectedIds` | `string[]` | yes | Confirmed / rejected service accounts | Derive-time `decisions.ts:211-214`, `:225-229` | `store.ts:46` |
| `allowedCountries` | `string[]` | yes | ISO country codes | Derive-time `decisions.ts:206`, `:223-224` | not traced |
| `displayTimeZone` | `string \| null` | yes | Display zone for every date | `planData.ts:431-437 setTimeZone` ← Plan settings time-zone select (`Plan.tsx:658`) | `planData.ts:260`, `:268` `setDisplayTimeZone`; `Plan.tsx:624` |
| `frameworks` | `string[]` | yes | Frameworks selection | No UI writer found | not traced |
| `wizardAnswered` | `Record<string, boolean>` | yes | Which answers exist | Derive-time `decisions.ts:148` | not traced |
| `assumed` | `Record<string,'detected'\|'confirmed'\|'noneFound'>` | no | Provenance per answer | Derive-time `decisions.ts:149`; `emergencyChoice.ts:95`. Stripped from the plan file (`plan.ts:155-159`). | `emergencyChoice.ts:64-66 operatorConfirmedEmergency` |
| `notApplicable` | `Record<stepId, string>` | no | "Doesn't apply here" reason per step | `planData.ts:438-447 setNotApplicable` ← ContentStep doesn't-apply dialog (`ContentStep.tsx:717`) and inline Save (`:1262`); removed by PlanFooter "Put back" (`PlanFooter.tsx:53`, wired `Plan.tsx:357`) | `generate.ts:734-735`, `:2107` (ignored for emergency-access ids); `PlanFooter.tsx` |
| `questionAnswers` | `Record<'stepId:label', string>` | no | Option / answer words per question | Derive-time `decisions.ts:156-157` from `stepDecisions[].option` / `.answers` | `roadmap/answers.ts:123` |
| `notAssessedNotes` | `Record<policyName, string>` | no | Cleanup "not assessed" note per baseline policy | `planData.ts:456-465 setNotAssessedNote` ← CleanupStep note Save (`CleanupStep.tsx:88`, wired `Plan.tsx:235`) | `Plan.tsx:235`; `Export.tsx:227`, `:354` |
| `omittedReferences` | `string[]` | no | Baseline references the person said need no counterpart | Derive-time `decisions.ts:164-177` from `stepDecisions['s-prereq-source-references'].answers` | `resolvePolicy.ts:107` |
| `updatedAt` | `string` | yes | Last save time | `store.ts:21` | not traced |

### 2.5 The named fields asked about

| Asked-for name | Found? | Where it actually lives |
|---|---|---|
| `stepDecisions` | yes | `PlanDecisions.stepDecisions`, keyed by step id. The Baseline mappings (Plan settings) persist under `stepDecisions['s-prereq-source-references']`, a key that names a removed step (`sourceMappings.ts:18`, BLOCKED.md S4 choice). Answers are keyed by the lowercased source id. |
| `mappings` | **not found** on the plan record | Nearest: the separate `mapping` store (`MappingState`). `mappings` is the field name only in `PlanFile` (`plan.ts:51`). |
| `checkpoints` | yes | `PlanDecisions.checkpoints: unknown[]` (§2.3) |
| `deferrals` | **not found** | Nearest: `PlanDecisions.skips` (read as `status 'skipped'`, then lane `Deferred`). The emergency hardening deferral is `PlanDecisions.confirmations['s-prereq-break-glass']['hardening-deferred']` (`emergencyTiers.ts:31`). |
| `Suspended` | **not found** as a stored field or step state | The word appears only as the blocker kind `suspendedPrerequisite` (`actionability/lanes.ts:68`, `:229`, `:241`; `planBoard.ts:101`). |
| done / completion marks | partly | Cleanup rows: `CleanupCheckpoint` entries in `checkpoints`. The alerting row is also completed by `breakGlassAnswers.signInMonitoring === true` (`cleanupDone.ts:90-96`). Policy steps: **not stored**, re-derived from the scan. |
| settings: start date | yes | `startDate`, `startedAt`, `firstDeployment` |
| settings: cadence | **not found** | Nearest: `band` (sets weeks per band). `PlanFile.schedule.pace` is typed (`plan.ts:64`) but Export never sets it. |
| settings: report-only window | **not found** in the record | Observation history is `observations`. Window lengths are not persisted. |
| settings: freeze, time zone, signature | yes | `freeze`, `signature` in the plan record; `displayTimeZone` in the mapping |
| emergency / exclusions decisions | yes (indirect) | `stepDecisions['s-prereq-break-glass'].picked` → `breakGlassUserIds` (confirmed only). `stepDecisions['s-prereq-exclusion-group'].picked[0]` → `records['__globalExclusion']` (confirmed only). `blockerStepId('breakGlass' \| 'exclusionGroup')` returns those same ids (`blockerSteps.ts:24-28`). Attestations: `MappingState.breakGlassAnswers`. |
| answers to question steps | yes (indirect) | `stepDecisions[stepId].option` / `.answers[label]`, applied to `questionAnswers['stepId:label']` at derive time |

---

## 3. Record lifecycle

### 3.1 Creation

- **Plan record:** not created by sign-in or scan. It is first written when a writing surface (Plan or Export) mounts with a computed plan:
  - `decisionsOf(null, planId)` yields `{ planId, skips: {}, checkpoints: [], stepDecisions: {}, observations: {}, freeze: null }`.
  - The first persist adds `planCreatedAt = now` (`planData.ts:351`).
  - Connect and MFA Readiness compute read-only and never create it (`planData.ts:136-137`).
- **Mapping record:** a load returns `emptyMappingState(tenantId)` merged with whatever is stored (`store.ts:17`). Nothing is written until a mapping setter, the demo/mock seed, or a plan-file load runs.
- **Demo:** `App.tsx:134-139` writes both rows on each snapshot switch, under the synthetic ids `demo-sample-tenant` and `demo-sample-tenant#snapshots` (`demoMode.ts:13`, `:26`).

### 3.2 Keying: per tenant, not per snapshot

- **Real tenant:** one plan record and one mapping record per tenant id (`keyPath: 'tenantId'`; the key is `snapshot.tenantId`).
  - A re-scan replaces the `snapshot` row and keeps the plan record.
  - Each persist merges the new scan's observations over the stored ones (`planData.ts:360`, `tracking.ts observationsOf`).
- **Demo:** the demo holds one plan record per snapshot (`demo.ts:95-101`, `:143-155 nextDemoRecord`):
  - The `demo-sample-tenant` row is a copy of the selected snapshot's record.
  - `demo-sample-tenant#snapshots` holds `{ current, records: { initial?, followUp? } }`.
  - Selecting a snapshot stores the live record under the previous key and restores (or seeds) the wanted one.
  - Going initial → followUp for the first time carries the live record forward.

### 3.3 Versioning and migration

- **`PlanDecisions`:** version field **not found**. Migration happens on read, in `progress.ts:135-187 decisionsOf`:
  - A legacy `steps` blob is reduced to skips (`:141-144`).
  - Decisions for `RETIRED_DECISION_STEPS` (`baselineConflict.ts:211`: `s-goal-admin-portals-protected`) are dropped (`:151`).
  - Each `stepDecisions` entry is normalised to `picked` / `option` / `answers` / `at` (`:153-154`).
  - `confirmations` entries without string `at` / `basis` are dropped (`:158-167`).
  - `observations` and legacy `reportOnlySeen` are normalised by `observation.ts:556-593 observationsFrom`.
  - The migrated shape is written back on the next persist (`planData.ts:337-340`). `reportOnlySeen` is never written again.
- **`MappingState`:** version field **not found**.
  - On read, `store.ts:17` merges over `emptyMappingState`.
  - It then runs `emergencyChoice.ts:88-97 migrateEmergencySelection`: without `assumed.breakGlass === 'confirmed'`, `breakGlassUserIds` move to `breakGlassPriorIds`. This is idempotent.
- **IndexedDB schema:** version 7, upgrade blocks only (§1.1).
- **Plan file:** `PLAN_SCHEMA_VERSION = 2` (`plan.ts:12`). Older files are upgraded by `plan.ts:261-296 upgradePlanFile` / `upgradeStep`.

### 3.4 Redaction

- **IndexedDB rows are not redacted.**
  - The plan record holds step ids, reasons, dates, picked object ids, and `basis` fingerprints.
  - `observations` stores hashed ids only: `artifactIdOf` and `memberKeyOf` (`observation.ts:205-255`).
  - The mapping record holds object ids.
- **Exports** route through `src/ui/exportGuard.ts`:
  - `REDACTED` applies `redact.ts:5 redactIdentifiers`.
  - The plan file is exported **unredacted** via `unredactedFrom('plan-file')` (`Export.tsx:179`, `exportGuard.ts:32-34`). The reason given: the loader's tenant check needs the real id.
  - In demo mode every download is prefixed with `app.shell.demoWatermark` (`exportGuard.ts:63-65`).
- `redactSnapshot.ts redactDeep` has no non-test caller in `src` (grep). Its use on the plan record: **not found**.

### 3.5 Export to a plan file

- **Control:** Export → plan-file card, first button ("Save plan file"), `Export.tsx:255` → `savePlan` (`:166-180`).
- **Build:** `plan.ts:161-234 buildPlanFile`. It creates a fresh scan `Checkpoint` (`plan.ts:73-114 makeCheckpoint`) and appends it after `data.checkpoints`.
- **File name:** `iamai-plan-<first 8 chars of tenantId>.json`, JSON with 2-space indent, `application/json`.
- **Top-level fields:**
  - `_readme[]`, `schemaVersion: 2`, `createdAt`, `displayTimeZone` (the browser's zone, not the mapping's), `planId`
  - `tenant { id, name, domains[], operator { userId, userPrincipalName } }`
  - `baseline { source (github owner/repo/commit, or upload fileName), variantChoices[] }`
  - `mappings` (the applied `MappingState` without `assumed`)
  - `steps[]` (`fileStep`: prose fields emptied)
  - `decisions` (a `PlanDecisions` subset)
  - `checkpoints[]`
  - `schedule { startDate, band, freeze }`
  - `revision: 1`, `revisions[]`, `baselinePin`
- **The `decisions` block contains** (`plan.ts:214-227`):
  - `planId`
  - `skips`, rebuilt from steps whose `status === 'skipped'`
  - `startDate`, `startedAt`, `band`, `freeze`
  - `checkpoints`, trimmed to the first plus the last 20 (`plan.ts:117-120 trimCheckpoints`). The trim applies to Cleanup Done entries too.
  - `stepDecisions`, `confirmations` (when non-empty), `signature`
- **It does not contain** `observations`, `planCreatedAt`, `firstDeployment` or `reportOnlySeen`.
- **Save plan file does not write IndexedDB.**

### 3.6 Re-import from a plan file

Control: Export → plan-file card, second button ("Load plan file"), `Export.tsx:258-261`. It opens a hidden `<input type="file" accept=".json">` and runs `loadPlanInner` (`Export.tsx:186-219`).

1. **Parse** with `plan.ts:236-252 parsePlanFile`:
   - Parsing starts at the first `{`, so a demo watermark line is skipped.
   - It rejects a file unless `schemaVersion` is a number and `steps` is an array.
   - It rejects `schemaVersion > 2` ("newer… update the app").
   - It runs `upgradePlanFile`.
   - Any failure shows `window.alert`.
2. **Tenant check**, before anything is persisted:
   - The file's tenant is `plan.tenant.id || plan.mappings.tenantId`.
   - Missing → alert `app.export.planTenantUnknown`.
   - Different from the current snapshot's tenant → alert `app.export.planFromAnotherTenant`.
3. **Decisions:**
   - `decisionsOf(plan.decisions ?? <legacy reconstruction from steps/schedule/checkpoints>, plan.planId)`.
   - The band comes from `plan.schedule.band` when valid, else the current band.
4. **Persist:**
   - `savePlanRecord(tenantId, record)` **replaces** the plan record (`put`). Anything the file lacks is gone: `observations`, `planCreatedAt` (set to now on the next persist) and `firstDeployment`.
   - `saveMappingState(plan.mappings)` runs only when `plan.mappings.tenantId` matches. It replaces the mapping record with the file's applied mapping.
   - No further schema validation of `mappings` was found.
5. **Navigate** to `#/plan`. On the next load, `migrateEmergencySelection` moves the file's `breakGlassUserIds` to prior ids, because `assumed` was stripped. The emergency `stepDecisions` entry in the decisions block re-applies them as confirmed.

Tests named for this path (not read): `src/roadmap/plan.test.ts`, `src/roadmap/planTenant.test.ts`. The format document `plan-file.md` referenced by `plan.ts:1` and `mapping/types.ts:1` exists only under `archive/design/`, which was not read.

### 3.7 Sign out and Forget this tenant

| Action | Control | What it does to stored data | What it does in memory |
|---|---|---|---|
| **Sign out** | Account menu (`AppShell.tsx`) → `ui/actions.ts:189-195 signOut` | IndexedDB untouched: the plan, mapping and all other rows stay. MSAL sessionStorage keys removed (`msal.ts:93` → `:103-109`), then `logoutRedirect`. localStorage keys and `iamai.preloadReloaded` untouched. | `endTenantTurn()`; the session drops account, tenantName, lastScan, scan, baseline, demoWeek2. `usePlanData` clears `mapping` / `saved` / groups when `snapshot` goes null (`planData.ts:164-175`). |
| **Forget this tenant** | Account menu item (`AppShell.tsx:165`, `SHELL.forgetTooltip`) → `actions.ts:207-221 forgetTenant` | Waits for any in-flight baseline save, then `cache.ts:258-275 forgetTenant(tenantId)` deletes that tenant's rows from all seven stores in one transaction (index cursors for `signin-rows` / `group-members`, key deletes for the others). Other tenants' rows are untouched. MSAL sessionStorage is **not** cleared by this action (no non-test caller of `graph/auth.ts:38 clearAuthCache` found). Web storage untouched. Rejects if the store cannot be cleared. | `endTenantTurn()` first; the session drops lastScan, scan, baseline, demoWeek2; still signed in; navigates to `#/connect`. |

- **Demo:** the Account menu is not rendered in demo mode (`AppShell.tsx:294`, `signedIn && !isDemo()`), so Forget is not offered there.
- **Demo snapshots row:** `forgetTenant` deletes exact keys only, so it would not delete the `demo-sample-tenant#snapshots` row.
- **In-flight writes:** `restoreSession`, `scan` and `chooseBaseline` check `stillThisTurn` before landing (`actions.ts:110`, `:118`, `:243`, `:300`, `:305`). The plan and mapping writes in `planData.ts` do not; they stop because `snapshot` becomes null.

### 3.8 Statements elsewhere that differ from the code

- `SECURITY.md:134-135` says the `plan` store holds "the plan and its history". The code stores decisions only (§2).
- `PlanDecisions.checkpoints` is documented as "Plan checkpoints written at save time" (`decisions.ts:60`). In IndexedDB it holds Cleanup Done entries. Scan checkpoints reach it only through a plan-file load.
- `msal.ts:98-101` describes `clearAuthCache` as what lets "Forget this tenant" leave nothing behind. The Forget action does not call it; only sign-out does (`msal.ts:93`).
