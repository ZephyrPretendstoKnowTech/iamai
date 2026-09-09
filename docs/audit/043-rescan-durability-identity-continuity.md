# 043 — Rescan Durability & Identity Continuity

The first pass across TIME, after task 042 established single-scan semantic consistency at
`ee036b7`/`d157081`.

Central rule: **a rescan may update evidence. It must not rewrite history, identity, or operator
intent.**

Scope note: this audit reports what the paired-scan corpus in
`src/roadmap/fixtures/transitions.ts` and the suite in `src/rescanDurability.test.ts` actually
exercise, plus what reading the current authorities showed. It does not claim correctness beyond
those scenarios.

---

## 1. Authorities read (the authority gate)

Followed from current `main`, not from history. `history/` and `decisions/` modules do not exist
and were not assumed.

| Fact | Authority on `main` today |
|---|---|
| stable object identity (deployed policy) | `roadmap/observation.ts` `artifactIdOf` — two hashes of the tenant policy id, opaque, equality-only |
| stable member identity (which half of a pair) | `roadmap/observation.ts` `memberKeyOf` over `goalMap.ts` `policyKey` |
| stable person identity | `UserRow.id`, everywhere (task 042 §1 verified; re-verified here under a full relabelling) |
| scan/session evidence | `TenantSnapshot` + `graph/collect`; the plan is regenerated on every load (`ui/surfaces/planData.ts`) |
| previous/latest observations | `roadmap/observation.ts` `StepObservationRecord`, carried in `PlanDecisions.observations`; read through `progress.ts` `decisionsOf` → `observationsFrom`; written by `roadmap/tracking.ts` `observationsOf` |
| material change / fingerprint | `observation.ts` `semanticsOf` (whole policy) + `semanticFieldsOf` (per dimension) + `COSMETIC` + `intentOf` |
| lifecycle | `roadmap/lifecycle.ts` (Foundation B) — `Step.state.lifecycle`, projected to `status` |
| condition | `roadmap/lifecycle.ts` `conditionFor` — orthogonal to lifecycle |
| operator decisions | `mapping/emergencyChoice.ts` (emergency access), `mapping/safetyChoice.ts` (exclusions group, Foundation C) |
| MFA proof recency | `scoring/mfaViability.ts` (`INACTIVE_DAYS` 90, `RECENT_REGISTRATION_DAYS` 30, `WHFB_DEVICE_ACTIVE_DAYS` 30, `STALE_METHOD_DAYS` 180) → `derive/ladder.ts` `rungOf` → `derive/mfaReadiness.ts` `groupOf` |
| baseline identity/provenance | `baselines/*.pinned.json` + `src/baseline/pinned.ts` `PINNED.commit` + `*.index.json`; `baseline/interpretation.ts` for meaning |
| Plan Step Contract | `ui/surfaces/stepContract.ts` |
| Export current state | `ui/surfaces/stepExport.ts` `stepExportView` over the Step Contract |
| demo/session isolation | plan record keyed on `snapshot.tenantId` (`planData.ts` `savePlanRecord(snapshot.tenantId, …)`); `ui/demoMode.ts` |

No parallel rescan-only truth model was created. Every assertion below is a question put to one of
these.

---

## 2. The paired transition matrix

`src/roadmap/fixtures/transitions.ts`. Nineteen transitions, each a scan A, a tenant edit, and a
scan B carrying scan A's plan record through the production path (`observationsOf` → `applyProgress`).
Every subject is chosen by asking scan A's own derivation a question; no id, no display name, no
step id and no fixture name decides anything (test `043.15` asserts it from the files' bytes).

Two things make the matrix readable rather than noisy:

* **a control scan.** Each transition also derives the same second scan with the tenant untouched.
  Time is not inert — a plan's evidence gate is read over `reportOnlyAt → this scan`, so a later
  scan whose sign-in collection has not caught up finds the window uncovered and a step that was
  ready to enforce is not. "What the change moved" is B against the control; "what the clock moved"
  is the control against A.
* **injected time.** `advance(fixture, days)` moves `asOf`, every source's `asOf` and the sign-in
  window together. No sleep, no wall clock (asserted).

| Contract case | Key | What scan B finds | Result |
|---|---|---|---|
| A no material change | `unchanged` | the same tenant, same minute | identical plan, identical record |
| B display-name-only | `renamed` | every policy, person, UPN local part and group relabelled | `changed: none`, `continuity: continues`, window and evidence intact |
| C material change | `rewritten` | the watched policy narrowed to a block | `semantics` / `reset` / `reviewRequired`, condition `review-required`, one step moved |
| D object removed | `policyRemoved` | the watched policy gone | lifecycle back to `not-deployed`, step `ready`, window restarts |
| E recreated/replaced | `policyReplaced` | same name, same body, new id | `changed: artifact`, `continuity: reset`, `firstSeenAt` = this scan, `evidenceAt` dropped, not ready to enforce |
| F new candidate appears | `newCandidateGroup` | a second group that would serve the exclusions role | choice stays `confirmed` on the same object; no recommendation offered |
| G confirmed target disappears | `decisionTargetGone` | the confirmed exclusions group proved `absent` | `invalidated`, `actionableId` null, `awaitsOperator`, stored answer untouched |
| G/M safety-sensitive account gone | `emergencyTargetGone` | a confirmed emergency account gone from the directory | the confirmed set is unchanged and the emergency checks fail closed |
| H safety-relevant property changes | `safetyMembershipChanged` | the confirmed group no longer holds the emergency accounts | choice still `confirmed`, steps become `blocked` with a named cause |
| I proof ages | `proofAged` | clock past `INACTIVE_DAYS` for the person nearest the boundary | leaves the counted population; registration, method and rung badge unchanged |
| J stronger proof | `strongerProof` | a passkey and a record naming it | rung 5, `ready` count +1 |
| K weaker later evidence | `weakerLaterEvidence` | the newest record names no method | rung falls, `ready` count −1, registration untouched |
| L role/category changes | `roleGained`, `roleLost`, `accountDisabled` | GA gained, GA removed, account disabled | rows and counts move together; every account still counted once |
| N baseline provenance | `baselineProvenanceChanged` | new origins, author unavailable | nothing moves; pinned commit unchanged |
| O prerequisite satisfied | `prerequisiteCleared` | the tenant now has the custom strength | dependent step becomes offerable, `missing-object` clears, the Preparation step goes |
| P prerequisite blocked | `prerequisiteAppeared` | the strength is gone | the exact reverse |
| P′ known → unknown | `coverageUnreadable` | one group read fails, so seven goals cannot be assessed | **the defect in §3** |

Test `043.0` fails if any key builds nothing, so a fixture change is a corpus gap rather than a
silently skipped scenario.

---

## 3. What the audit found, and corrected

### 3.1 A scan that could see less of the tenant DELETED rollout history — `DIRECT_DEFECT`

**Authority bypassed.** `roadmap/observation.ts` is explicit that IAMAI's own sighting record is
"the only history IAMAI can honestly keep" and "the one thing a regeneration cannot work out
again". The persistence site treated it as a projection of the current plan instead.

**Evidence.** `ui/surfaces/planData.ts` wrote `observations: observationsOf(computed.steps)` —
the whole block, rebuilt from the steps this scan derived. But a scan does not derive a step for
every goal: `roadmap/generate.ts` skips a goal whose coverage `result.status === 'unknown'`, and a
goal is `unknown` whenever a policy delivering it names a group this scan could not read
(`coverage/coverage.ts` `anyUnresolved`). One failed group read is enough to do that to every goal
whose policies name that group.

On `demo-week2`, dropping the exclusions group from what the scan loaded takes the plan from 27
steps to 20 — and one of the seven that vanish is a policy that is **deployed, in report-only, and
being watched**. Reproduced end to end:

```
A  watched step, firstSeenAt 2026-08-28   record present
B  (one group read fails)                 step absent, record DELETED
C  (the read succeeds again, 6 days on)   changed=first-scan, firstSeenAt 2026-09-03
C* control, no failed scan in between     changed=none,       firstSeenAt 2026-08-28
```

**Failure scenario.** A tenant is three weeks into a report-only soak on a policy, one day from the
observation window closing. A Graph read of the exclusions group times out on a Tuesday scan. The
plan silently loses seven rows and, with them, three weeks of rollout evidence. On Wednesday the
rows come back reading "first seen by IAMAI today", the window restarts from zero, and the "in
report-only since" date has moved forward by a day. Nothing tells the operator that a transient
failure cost them three weeks; the plan simply says the soak has barely begun.

**Root cause.** The plan record's observation block was *rebuilt from the current plan* rather than
*updated by it*. Silence about a step was read as a statement that the step has no history.

**Correction.** `roadmap/tracking.ts` `observationsOf(steps, prior)` — the module that already owns
the record's shape now states the rule: a scan writes what it saw over what the record already
held. `planData.ts` passes `saved.observations`. One parameter, no new state, no new branch, and
the rule is written down where the record is written.

Carrying a record forward is safe in the direction that matters, and only because nothing reads it
as a conclusion: `priorFor` hands it to `observe`, which asks whether the object it names is the
object deployed now before any window carries. A record about an object that is no longer there
resets (`043.13b` proves exactly that across a blind scan). Dropping it was the unsafe direction,
because it fabricated a first sighting that never happened.

**Branches added.** None. **Branches removed.** None. One expression became one expression with a
starting value.
**Invariants.** `043.13` (the record survives a scan that could assess less, and the third scan's
history equals the control's, so a blind scan costs nothing at all), `043.13b` (a carried record
still has to prove itself against what is deployed), `043.1` (an unchanged rescan leaves the record
byte-identical).

### 3.2 A deleted policy was reported as a gap in IAMAI's own bookkeeping — `DIRECT_DEFECT` (wording)

**Evidence.** `observation.ts` `noteFor` put `continuity === 'unknown'` first, so a step whose
policy had been deleted read:

> this plan does not record which policy it watched before Aug 31, 2026, so the window starts again
> on the one deployed now

The plan *did* record which policy it watched. What could not be shown was that the object is still
there — there was no policy at all. The sentence blamed IAMAI's own record for the tenant's news
and buried the news.

**Correction.** `noteFor` takes whether the earlier record named an object. `continuityUnknown`
stays for the case it describes — a record that names none — and a record that names one against a
scan that found no policy falls through to the state it moved to: *"changed to not deployed by
Aug 31, 2026, and the plan did not ask for it."* The continuity value is untouched: `unknown`
either way, `historyReset` either way, window restarts either way. Only the sentence changed.

**Invariant.** `043.6` (every dated fact carries its provenance) and the `policyRemoved` transition.

---

## 4. What the audit checked and found sound

Reported so a later task does not re-derive them.

**No-change stability (`043.1`, `043.11`).** A repeat scan produces the same step ids in the same
order, the same phases, the same schedule waves, the same lifecycle/condition/status/satisfied/
inPlace/setAside per step, the same status word and action classification per step, the same
readiness row for every account, the same summary counts, the same decisions — and the same
observation record, byte for byte. Every observation reports `changed: 'none'` and asks for nobody.

**Rename vs replacement (`043.2`, `043.3`, `043.3b`).** Under a relabelling of every policy display
name, every person's display name, every UPN local part and every group name, with fresh
`modifiedDateTime` stamps: nothing moves. The watched policy's observation is `none`/`continues`,
its `firstSeenAt` and Microsoft's own `evidenceAt` are preserved, and both confirmed decisions still
point at the objects they pointed at. Conversely a policy deleted and recreated with the same name
and an identical body is `changed: 'artifact'`, `continuity: 'reset'`, `firstSeenAt` = the scan that
found it, `evidenceAt` dropped, `since: 'first-scan'`, and its member is not ready to enforce. A new
group that would serve the exclusions role does not become the answer, and no recommendation is
offered where the operator has already answered.

**Material-change scope (`043.4`).** A narrowed grant is `semantics`, not `expected`, and
`reviewRequired`; the step's condition is `review-required` and its member is not ready to enforce.
Measured against the control scan, exactly one step moved. `COSMETIC` covers display name,
description, template id and both timestamps and nothing else; the one nested `id` that is material
(`grantControls.authenticationStrength.id`) stays material — `repinSemanticRewrite.test.ts` (task
022) is the standing proof of that and was not duplicated here.

**Operator decision durability (`043.3b`, `043.5`, `043.5b`).** Foundation C's four states behave
across scans: `confirmed` under a rename, `confirmed` when a rival candidate appears, `invalidated`
(never replaced, never re-recommended, stored answer untouched, `awaitsOperator` true) when Graph
proves the object gone, and `unverified` when a read merely fails. The emergency-access decision is
never edited by a scan: when a confirmed account disappears from the directory the set is unchanged
and the emergency checks go from nothing-to-fix to something-to-fix, so the plan fails closed rather
than writing policies that exclude an account nobody has.

**Lifecycle history (`043.6`).** Across every transition and every member: a first sighting is never
later than the scan that made it; a later scan never finds an *earlier* first sighting than the
record held; an unbroken window never restarts; `since: 'observed-change'` occurs only where the
artifact identity is the same on both sides of the move; a first sighting is never recorded as a
change IAMAI watched; Microsoft's evidence from before a watched change is never admitted after it;
and every `reportOnlyAt` carries `reportOnlyAtSource`, with no source where there is no date. Two
scans both observing report-only produce `since: 'first-scan'`, not a claimed continuous state.

**Condition/blocker transitions (`043.7`).** Blocked→satisfied and satisfied→blocked both move, in
both directions, on the current scan's authority; no step anywhere in the corpus reads `Ready` under
a condition that is not `healthy` or with a blocker on it. Condition and lifecycle stay orthogonal:
a step already in report-only that becomes blocked stays in report-only and is held, which is
Foundation B's rule and not a bug. A missing prerequisite object moves availability
(`implementationOffered`, `unavailableReason: 'missing-object'`) and adds the Preparation step that
would make it, rather than moving the condition — and clearing it is the exact reverse.

**MFA proof aging (`043.8`).** Crossing `INACTIVE_DAYS` by injected time takes a person out of the
counted population and leaves their registered methods, method word and rung badge exactly as they
were; their readiness group becomes null because the ladder does not count them. Nobody else leaves
the population without crossing the same boundary. The three groups plus `unknown` still partition
the active people. No UI timer exists: readiness is a function of the snapshot and `now`.

**Stronger-proof precedence (`043.9`).** A qualifying phishing-resistant record raises the rung to
5 and the summary follows. A later record naming no method lowers the rung although the passkey is
still registered — proof is this scan's records, never a memory of last scan's — and the summary
follows down. Both directions are `derive/ladder.ts` `rungOf` read back, with the row's rung
asserted equal to the ladder's own answer.

**Role/account-category (`043.10`).** A gained role, a removed role and a disabled account each move
the person row and the count in the same direction at the same time, from the directory's own role
table (`roles.ts`). Every account is still listed exactly as many times as the ladder counts it.

**Export current state (`043.12`).** For every step of every scan B, the export view's status, stage
and condition are the Step Contract's. Wherever a step's lifecycle or condition moved between the
scans, the export moved with it: no stale action, no cached view. The corpus contains such a step
(asserted, so the check is not vacuous).

**Baseline continuity (`043.14`).** A change of origins and an unavailable author move nothing: not
the baseline policies, not a step, not an observation window. `PINNED.commit` and the fetch
allowlist's commit still agree, and nothing in a derivation reads or writes them. There is no
automatic re-pin path: `scripts/pin-baseline.ts` is the only writer and needs an explicit 40-char
SHA.

**Session/cache (`043.13c`, smoke).** The plan record is keyed on `snapshot.tenantId` at the
persistence boundary; there is no derived cache of the plan at all — `planData.ts` regenerates from
the snapshot on every load, rescan and edit, and persists decisions only. Presented (contrary to
that boundary) with another tenant's record, no member with a matched policy keeps its window.
`ui/demoMode.ts` writes to neither store, and the smoke run confirms a full demo walk touches no
real-tenant record, that sign-out deletes nothing and that forgetting one tenant leaves another's
records intact.

---

## 5. Architecture delta

Recorded per §14 of the contract.

| | 3.1 record update | 3.2 note selection |
|---|---|---|
| domain concept affected | the plan record's observation block | the sentence an observation states |
| existing authority reused | `tracking.ts` `observationsOf`, `observation.ts` `StepObservationRecord`, `priorFor`, `observe` | `observation.ts` `noteFor` and the existing `shared.engine.observation` keys |
| new state introduced | none | none |
| why necessary | a transient read failure destroyed rollout evidence and restarted a report-only window | a deleted policy was reported as a gap in IAMAI's bookkeeping |
| branches added | 0 (one starting value) | 0 (one existing condition narrowed by a parameter) |
| branches removed | 0 | 0 |
| reusable | yes — every future scan that cannot assess part of a tenant is covered by the same rule | yes — the two "cannot say" cases are now distinguished for any caller |

| Measure | Before 043 | After 043 |
|---|---|---|
| Semantic authorities | unchanged from 042 | **unchanged** — no authority added, none moved, none split |
| New domain-state fields | — | **none** |
| Special-case branches | — | **net zero**: one parameter added to each of two existing functions; no `if` per transition anywhere |
| Page/fixture-specific transition handlers | — | **none** (test `043.15` asserts the corpus imports no surface and reads no identifier) |
| Regression corpus | 14 tenants, 21 predicate-selected scenarios, 17 invariants (042) | + 19 paired transitions with a control scan each, 20 invariants (043) |
| Runtime complexity | — | unchanged; the record merge is one object spread at the persistence site |
| Test maintenance cost | — | one corpus module, one suite; every subject predicate-selected, so a fixture change surfaces as a corpus gap rather than a broken literal |

No content key was added. No `content.json` change was needed: 3.2 selects between sentences that
already existed.

---

## 6. Remaining concerns

| # | Item | Class |
|---|---|---|
| S1 | **A goal whose coverage cannot be settled produces no plan row and no statement anywhere.** `generate.ts` skips `result.status === 'unknown'`; `coverage.summary.unknown` counts them and no surface renders it. On the corpus this takes the plan from 27 rows to 20 with nothing said. Task 043 removed the durable harm (§3.1: the history now survives, and the row returns intact), and the operator is not left with no signal — the exclusions-group step reopens as `needs-decision`/`ready` and three remaining goal steps become `blocked`. What is missing is the plan stating that seven goals were not assessed this scan. Making an unassessed goal render a row is a change to the plan's main generation loop and a product decision about what such a row would say, which is beyond a rescan-durability task's remit. | `POST_043_STATE_CHECK` |
| S2 | The observation record now accumulates entries for step ids the plan no longer produces. Bounded by the goal catalogue and a few fields per entry, so it is small; whether to prune, and after how long, is a product decision with no correctness pressure behind it today. | `POST_043_STATE_CHECK` |
| S3 | `planIdFor(tenantId)` truncates the tenant id to 8 hex characters, so two tenants can share a plan *label*. Harmless today — the plan record's store key is the full `snapshot.tenantId`, and the label is only read inside one tenant's own snapshot when matching plan tags — but every fixture in the repo shares `plan-00000000`, which means the collision is not visible to any test. | `CLEANUP` |
| S4 | A confirmed emergency-access account that vanishes from the directory fails `bg.role.permanentGa` ("no Global Administrator role") rather than a check that says the account is not in the tenant. The plan fails closed, which is the load-bearing behaviour and is asserted (`043.5b`); the wording sends the operator to the wrong question. | `POST_043_STATE_CHECK` |
| R1–R5 | Task 042's remaining concerns are unchanged by this task and still stand. | as recorded in 042 |

No `NICHE_SCENARIO_DEFERRED` was needed: every case in the contract's matrix A–P was expressible
through the existing architecture without new machinery.

No `MANUAL_DECISION_REQUIRED`. No baseline change, no pin change, no write scope.

---

## 7. Questions for the post-043 state check

1. **S1.** Should a goal the scan could not assess appear on the Plan, and as what? It is not work
   the operator can do; it is a statement that a reading failed. The alternative is a header line
   ("7 goals could not be assessed this scan") rather than seven rows.
2. **Semantic authority count.** 042 and 043 both closed duplications and added none. Is the count
   now stable enough to freeze, and is there a cheap way to assert it — a list of authorities the
   suite checks the module graph against?
3. **Corpus growth.** There are now two corpora (`semantics.ts`, `transitions.ts`) over one fixture
   set, and `transitions.ts` derives a control scan per transition. Derivation count and suite
   memory should be looked at together: `npm test` peaks near the runner's ceiling already.
4. **Deferred wording items.** S4 here and R3 from 042 are both "the output is correct and the
   sentence points somewhere else". Is there a single pass that closes that class?
5. **Readiness to begin release/security hardening.** Nothing found in 042 or 043 blocks it. The
   open items are presentation and product decisions, not correctness or safety.
6. **Re-scoping.** 042 and 043 between them read every semantic authority in the product. Whether
   later tasks should be combined is a question the state check now has the evidence to answer.

---

`POST_043_STATE_CHECK_REQUIRED`
