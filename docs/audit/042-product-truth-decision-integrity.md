# 042 — Product Truth & Decision Integrity

The first post-restoration semantic integrity pass across Connect → Plan → MFA Readiness →
Export, after the visual-restoration program (tasks 030–041) closed at `5d2d2ec`.

Central rule: **one fact, one authority, many presentations.**

Scope note: this audit reports what the corpus in `src/roadmap/fixtures/semantics.ts` and the
suite in `src/semanticIntegrity.test.ts` actually exercise. It does not claim correctness
beyond those scenarios.

---

## 1. Truth-authority map

Classification key: `PSA` = production semantic authority · `DP` = derived presentation ·
`EI` = engineering implementation · `LRF` = landed repo fact.

### Identity

| Fact | Authoritative producer | Intermediate derivations | Consumers | Duplicate derivations |
|---|---|---|---|---|
| tenant id | `TenantSnapshot.tenantId` (`graph/collect`) — `PSA` | `roadmap/generate.ts` `planIdFor` | plan record key, mapping store, plan-file tenant check, export file names | none found |
| user/object id | `UserRow.id` — `PSA` | `derive/ladder.ts` `ladder`, `derive/population.ts` | MFA Readiness rows (`rowKey={r.user.id}`), remediation panel (`OpenGuide.userId`), step handoff ids, campaign lists | none found |
| policy id | `PolicyOperation.policyId` / `Step.tracking.policyId` — `PSA` | `roadmap/tracking.ts` `matchPolicy` (tag, then fingerprint) | JSON, PowerShell (`Update-Mg… -ConditionalAccessPolicyId`), portal open line, observations | none found |
| decision-target identity | `MappingState.breakGlassUserIds` / `records[EXCLUSIONS_RECORD_KEY]` — `PSA` | `mapping/emergencyChoice.ts`, `mapping/safetyChoice.ts` | `derive/sets.ts` `notPeopleIds`, `emergencyExposureOf`, `validation/rules.ts` | none found |

Display name is never identity anywhere the audit reached. The remediation panel, the row key,
the guide lookup and the plan handoff all carry `user.id`. Verified by a synthetic case with two
accounts sharing a display name and a third given an 8×-repeated label (`collidingNamesCase`).

### Baseline / policy

| Fact | Producer | Consumers | Duplicates |
|---|---|---|---|
| baseline object | `baselines/*.pinned.json` + `baseline/interpretation.ts` — `LRF` / `PSA` | `roadmap/goalMap.ts`, `stepPortal.ts` reference lines | none |
| tenant mapping of a reference | `roadmap/resolvePolicy.ts` — `PSA` | `step.action.resolution` | none |
| resolved policy / canonical operation | `roadmap/operations.ts` `policyResult` → `operationsOf` / `validOperations` — `PSA` | JSON tab, download, PowerShell, portal lines, export view, `forecast.ts`, schedule | none |
| targets / exclusions / grant controls | `operations.ts` `effectOf` (+ `READ_LEAVES`) — `PSA` | `emergencyExposureOf`, `enforcesOnRun`, portal translator | none |
| create vs change | `stepJson.ts` `createsNewPolicy` / `updatesExistingPolicy` / `enforcesByStateOnly` over `operationsOf` — `DP` | `stepExport.ts` `datesLineFor`, `ifWrongLineFor` | none |
| verification / completion | `roadmap/tracking.ts` gates → `derive/readyWhen.ts` | row date column, `doneWhen`, `rowReason` | none |

### Plan

| Fact | Producer | Consumers | Duplicates |
|---|---|---|---|
| `Step.state` (lifecycle + condition) | `roadmap/lifecycle.ts` — `PSA` (Foundation B) | `stepContract.ts` `state`/`track`, `statusWord.ts`, export view `stage`/`condition` | none |
| status word | `ui/surfaces/statusWord.ts` `statusOf` — `DP` | collapsed row, `contract.state.word`, export view `status` | **Cleanup rows had two** — corrected, see §3.1 |
| action mode | `stepContract.ts` `actionOf` — `DP` over Foundations A/B/C | opened step, export view, prompt pack, ICS | none |
| blockers | `Step.blockers` + `lifecycle.ts` `conditionFor` — `PSA` | `contract.fix`, `rowReason`, `derive/finish.ts` | none |
| timing | `roadmap/schedule.ts` + `forecast.ts` — `PSA` | `rowWhen`, `contract.milestone`, `datesLineFor`, ICS | none |
| plan length in weeks | `derive/finish.ts` `planFinish` — `PSA` | Plan header, print cover, Connect sample tile | **three copies of the arithmetic** — corrected, see §3.2 |
| implementation eligibility | `operations.ts` `implementationOffered` — `PSA` | `contract.implementation`, `jsonOffered`, `stepPortalLines`, export view | none |
| goal already satisfied, and by which policy | `coverage/coverage.ts` `satisfaction` → `Step.satisfiedBy` → `stepContract.ts` `existingOf` — `PSA` → `DP` | opened step finding, rail block, collapsed row reason | **row had its own copy** — corrected, see §3.3 |
| Cleanup row completion | `roadmap/cleanupDone.ts` — `PSA` | Plan row, print | **two readings** — corrected, see §3.1 |

### MFA

| Fact | Producer | Consumers | Duplicates |
|---|---|---|---|
| registered methods | `derive/ladder.ts` `methodsIndex` / `scoring/fromSnapshot.ts` — `PSA` | rung, method word, group | none |
| proof / recency | `scoring/mfaViability.ts` (evidence set only in the verified branch) — `PSA` | `rungOf`, `personEvidence` | none |
| strongest proven method / rung | `derive/ladder.ts` `rungOf` — `PSA` | badge, sort, `groupOf`, `toSetUp` | none |
| readiness group | `derive/mfaReadiness.ts` `groupOf` — `PSA` | summary counts, row cell, CSV, remediation choice | none |
| readiness summary counts | `readinessView.groups` + `actionable` — `DP` | summary panel, pills, footer ledger | none |
| population membership | `derive/population.ts` `campaignIds` / `derive/sets.ts` — `PSA` | ladder, facts, step handoff | none |
| a step's MFA hold | `derive/stepMfaReadiness.ts` `stepMfaHold` — `PSA` | Plan step handoff, MFA Readiness callout, filter | none |
| "still to set up" for the verification window | `derive/facts.ts` `toSetUp` — `PSA` | printed plan | **was inline in `Export.tsx`** — corrected, see §3.4 |

### Decisions

`mapping/emergencyChoice.ts` and `mapping/safetyChoice.ts` keep detected / recommended /
confirmed / prior apart, and `pickerRows.ts` `defaultDecisions` excludes both safety-sensitive
pickers by construction. No duplicate derivation found; the audit adds a standing assertion
rather than a change.

### Outputs

Portal (`stepPortal.ts`), JSON (`stepJson.ts`), PowerShell (`stepPowerShell.ts`) and the export
view (`stepExport.ts`) all read `operations.ts`. `stepExport.ts` reads the Step Contract for the
stage, condition, status word, next line, reach, action, fixes, completion and offer. No second
operation resolution exists downstream.

---

## 2. Regression scenario matrix

`src/roadmap/fixtures/semantics.ts` — selection by production predicate only, no id, no display
name, no fixture name in any predicate (asserted by reading the file's own bytes, test `042.14`).

14 cases: the 10 curated fixtures, plus three states a first scan cannot produce and one the
sweep cannot: the exclusions question unanswered, colliding/long display names, a second scan
that finds a policy rewritten, and a step set aside.

| # | Contract scenario | Corpus key | Instances |
|---|---|---|---|
| 1 | clean/simple tenant | `implementable` | 110 |
| 2 | equivalent policy already exists | `equivalentExists` | 54 |
| 3 | policy needs create | `needsCreate` | 108 |
| 4 | policy needs change | `needsChange` | 5 |
| 5 | blocked prerequisite | `blockedPrerequisite` | 146 |
| 6 | operator decision required | `needsDecision` | 1 |
| 7 | confirmed safety-sensitive object | asserted per case in `042.6` | 14 cases |
| 8 | confirmed object missing/stale | `missingObject` | 45 |
| 9 | baseline/source conflict | `baselineConflict` | 3 |
| 10 | missing/unknown evidence | `unknownReach`, `methodsUnknown` | 50 / 34 |
| 11 | admin, strong method + fresh proof | `strongProven` ∩ `admin` | 489 / 164 |
| 12 | registered method, no qualifying proof | `registeredNotProven` | 263 |
| 13 | weaker method with qualifying proof | `weakerProven` | 2108 |
| 14 | emergency/service/shared/disabled | `notAPerson`, `notActive` | 53 / 918 |
| 15 | long/odd identifiers, no semantic change | `collidingNamesCase` | 1 case |
| — | sound operation, window not earned | `heldForWindow` | 3 |
| — | policy rewritten in the tenant | `heldForReview` | 1 |
| — | operator set the step aside | `setAside` | 1 |

Test `042.0` fails if any scenario finds nothing, so a fixture change that stops producing a case
is a failure rather than a silently vacuous suite.

---

## 3. Contradictions found and corrected

### 3.1 A Cleanup row read In place on the Plan and Ready in the printed plan — `DIRECT_DEFECT`

**Authority bypassed.** None: the fact had no authority. A Cleanup row's completion was derived
twice, in two JSX files, from different inputs.

**Evidence.** `Plan.tsx` `CleanupRow` read
`row.done || (alertingDone && row.kind === 'alerting')` where `alertingDone` was
`mapping.breakGlassAnswers.signInMonitoring === true`. `PrintPlan.tsx` read `r.done` alone, and
was never handed the attestations at all. Both then wrote the words `'In place'` and `'Ready'`
into their own JSX.

**Authoritative expected result.** The attestation `bg.signInMonitoring` is the answer to
"does a sign-in by an emergency account raise an alert somebody sees" — `validation/rules.ts`
already treats it as that answer. It completes the alerting row. One row, one answer, on both
surfaces.

**Failure scenario.** An operator ticks the sign-in-monitoring attestation on the emergency step,
sees the alerting Cleanup row read "In place" on the Plan, exports the plan to PDF for a client,
and the same row reads "Ready" — outstanding work — in the document.

**Root cause.** A fact recorded in the mapping was threaded into one renderer's props and not the
other's, with no module owning the reading.

**Correction.** `roadmap/cleanupDone.ts` `cleanupComplete(row, answers)` — the module that already
owns Cleanup completion — is the one reading. `ui/surfaces/statusWord.ts` `cleanupStatusOf` is the
one wording, beside `statusOf`, so the board has one status vocabulary. `PrintPlan` takes an
`answers` prop; `Export.tsx` passes `mapping.breakGlassAnswers`.

**Branches removed.** Two ad-hoc completion expressions and four hard-coded status words in JSX.
**Branches added.** None: one predicate replaced two.
**Invariant.** `042.13` (the attestation completes the alerting row and only that row; nothing
recorded completes nothing; absent and unread are the same) and `042.15` (neither surface writes a
status word or re-derives completion).

### 3.2 The plan's length in weeks was computed three times — `ARCHITECTURAL_RISK`

**Evidence.** The identical expression
`finish.finish ? Math.max(1, Math.ceil((… ) / (7 * 86_400_000))) : schedule.weeks` appeared in
`Plan.tsx:120`, `PrintPlan.tsx:119` and `demoFacts.ts:23`. The third states the number Connect
shows a signed-out visitor for the sample tenant, which a person compares directly with the Plan's.

No divergence observed today — three identical copies. Recorded as a risk rather than a defect.

**Correction.** `derive/finish.ts` `planWeeks(finish, start, scheduleWeeks)` beside `planFinish`,
which already owns the finish date. All three read it.

**Invariant.** `042.12` (the sample tile's four numbers are the production functions' own) and
`042.15` (no surface contains the arithmetic).

### 3.3 The collapsed row re-derived the satisfying policy — `ARCHITECTURAL_RISK`

**Evidence.** `rowWhen.ts` `rowReason` read `step.satisfiedBy` directly and chose its plural
sentence on `by.sufficient === null`. `stepContract.ts` `existingOf` — which the opened step's
finding and the rail both read — chooses on `policies.length > 1`. The two agree on every set the
current classifier produces; they differ on a set of one with no sufficient policy, where the row
would announce one policy as two covering the goal "together".

Reachability of that set through `coverage.ts` today: not demonstrated. Recorded as a duplicate
derivation with a latent divergence, not as a proven contradiction.

**Correction.** `existingOf` is exported and `rowReason` consumes it. The two sentences stay
different — they are the same truth worded for a row and for an opened step — and the reading
behind them is now one.

**Invariant.** `042.3` asserts the row and the opened step name the same policies and agree on
whether one covers the goal alone; `042.15` asserts the row no longer reads the coverage field.

### 3.4 The printed plan's verification note was business logic and copy in JSX — `DIRECT_DEFECT`

**Evidence.** `Export.tsx:346` built the note inline:

```
verificationNote={tenantFacts && toSetUp > 0 ? `${toSetUp} of ${tenantFacts.active} active
people still to set up.` : 'Everyone active is ready.'}
```

with `toSetUp = tenantFacts.rungs[1] + tenantFacts.rungs[2]` on the line above. Two problems:
the two sentences existed in no content file — the only strings in the printed plan that did not
— and a readiness population was computed in a render surface, one route away from MFA Readiness
computing a different one from the same ladder.

The `tenantFacts &&` guard also stated "Everyone active is ready." whenever the counts were
absent. It is unreachable today (`usePlanData` returns `computed` only once the mapping has
loaded, and `Export` returns early without it), so this is a latent unknown→safe fallback rather
than a live one — but it was the fallback, not a stated absence.

**Correction.** `derive/facts.ts` `toSetUp(facts)` is the count, with the reason rungs 3 and 4 are
excluded written down. `pages.app.print.verificationNote` and `verificationNoteReady` are new
content keys. `PrintPlan` renders the note from `Facts | null`, and states nothing where the
counts are absent. `Export.tsx` passes counts and words nothing.

**Invariant.** `042.2` (still-to-set-up is a subset of the active people) and `042.15` (Export
neither computes the population nor words the sentence).

---

## 4. What the audit checked and found sound

Reported so a later task does not re-derive them.

- **Operator-decision integrity.** `emergencySelection` never promotes a nomination, `migrateEmergencySelection` empties an unprovenanced record at the persistence boundary, and `defaultDecisions` excludes both safety-sensitive pickers. Asserted over all 14 cases (`042.6`).
- **Counts.** The three readiness groups plus `unknown` partition the active people and equal the rows carrying them; the ledger's parts sum to every account once; the needs-action filter equals `actionable + unknown` (the page states both). No rows are hidden to make a total fit (`042.2`).
- **Registration is not proof.** No active person stands above rung 3 without a sign-in record; `groupOf` never places anyone at `ready` off rung 5; Windows Hello stays at rung 3 whatever the records show (`042.9`).
- **Summary and rows share one authority.** Every exported readiness cell equals the rendered cell, row for row; every id in a step's MFA handoff is a row on the page (`042.10`).
- **Unknown stays unknown.** An unsettled reach carries no count anywhere; an unreadable method inventory produces no settled `needsPasskey` finding; an unknown hold is never reported as "nothing is waiting" (`042.11`).
- **Four channels, one operation.** Portal, JSON, PowerShell and the export view stand or fall together on `implementationOffered`, and the JSON is the operations' own bodies with one command per operation (`042.8`). A preserved goal offers none of them and carries no rollback and no dates (`042.7`).
- **Lifecycle is one authority and orthogonal to condition.** The export view's stage, condition and status word are the Step Contract's; the track marks the lifecycle and nothing else; at least one condition occurs at more than one lifecycle in the corpus, so the axes have not collapsed (`042.4`).
- **Demo.** Both demo tenants go through the corpus like any other and satisfy every invariant; the sample tile's four numbers are `facts`, `stepFacts` and `planWeeks` over the production path (`042.12`).
- **A blocker never becomes informational.** A prerequisite elsewhere in the plan never sits under a Ready row and never under a finished one, and the opened step names it — with one carve-out the product already documents: a goal whose baseline contradicts itself asks for nothing under Fix, because nothing in the tenant would clear it. That step still carries an action and a completion, which `042.5` holds it to.

---

## 5. Remaining concerns

| # | Item | Class |
|---|---|---|
| R1 | `readinessTable` (Export's CSV) writes six columns; the MFA Readiness page's own `DataTable` export writes seven, including the hidden UPN column. Both use the file name `iamai-mfa-readiness.csv`. Same name, two shapes. No semantic disagreement — every shared cell is identical (`042.10`) — but a person who exports from both surfaces gets two different files under one name. | `POST_043_STATE_CHECK` |
| R2 | A person outside the sign-in window keeps a rung badge derived from `methodsIndex` (which carries sign-in evidence for any account), while their Proof cell reads "Inactive since …" from `MfaViability` (which sets evidence only in the verified branch, for active people). Both are documented and deliberate — the ladder does not count them — but the badge and the proof line beside it are read from two different evidence readings. Not shown to produce a wrong claim. | `ARCHITECTURAL_RISK` |
| R3 | `stepExport.ts` still carries a branch chain over `unavailableReason` that produces, for six of the eight reasons, the exact string `contract.whatToDo.text` already holds; the `lines.includes(action)` guard then keeps it once. The output is correct and the duplication is real. It was left alone because the two branches that genuinely differ (the baseline conflict's own paragraph, the in-place finding) are interleaved with the six, and collapsing them changes line ORDER on steps that carry a content lead — a rendering change beyond this task's remit. | `NICHE_SCENARIO_DEFERRED` |
| R4 | `powershellFor` filters its input through `isValidOperation` although every caller passes `stepOperations`, which is already all-valid. Harmless belt-and-braces; noted so it is not mistaken for a second eligibility gate. | `POST_043_STATE_CHECK` |
| R5 | This file is at `docs/audit/` as the task contract names it; the repo's existing audit directory is `docs/audits/`. Two directories one letter apart. | `POST_043_STATE_CHECK` |

No `MANUAL_DECISION_REQUIRED`. No authority conflict was found that current project authority
does not already resolve.

---

## 6. Architecture trend

| Measure | Before | After |
|---|---|---|
| Semantic authorities | unchanged | unchanged — no new authority; `cleanupComplete`, `planWeeks` and `toSetUp` each moved a calculation into the module that already owned the fact |
| Duplicate derivations | 4 (Cleanup completion ×2, weeks ×3, satisfying policy ×2, still-to-set-up ×1 in JSX) | 0 |
| One-off branches in render surfaces | 2 ad-hoc completion expressions, 4 hard-coded status words, 1 hard-coded readiness sentence pair | 0 |
| Page-specific business logic | Export computed a readiness population; Plan and Print each computed a Cleanup state | none |
| Durable invariants | — | 16 tests, 14 synthetic tenants, 21 named scenarios, all selected by predicate |

No fixture-name, object-id, UPN, display-name or page-name special case was added. Test `042.14`
enforces that by reading the corpus's and the suite's own bytes.
