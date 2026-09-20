# V1 audit — pass 4: claim integrity

Covered: Home, Connect (and the scan), the Plan (rows, tiles, step bodies, the
Direction steps), MFA Readiness, Export / ICS / prompt pack / grounding bundle,
the printed plan, the How page, and the per-step AI Info pack. Method: every
asserting sentence was traced back through `src/ui/surfaces/` → `src/derive/` →
`snapshot.sources.*` / `snapshot.config.*`, and then re-rendered. I dumped every
step body, tile, note, who-line and Done-when for all eight fixtures
(`stepBodyOf` under the same context `src/testing/stepSnapshots.ts` uses), and
built two degraded snapshots by hand: a 403 on the non-core sources, and the
production shape of a tenant with no Entra ID P1 (`worker.ts:332`). Every finding
below was reproduced; anything I could not reproduce is marked and argued down.

One thing shapes the whole pass. `coreGaps()` (`src/graph/collect/coreSections.ts`)
refuses to build a plan at all when CA policies, users or the sign-in log could
not be read — a strong guard, and it makes several obvious-looking findings
unreachable. But it exempts a licence gate, so **the one degraded state a public
beta meets on day one — no Entra ID P1 — builds a full plan**, and no fixture
covers it. `coreGaps(fixture('micro').snapshot)` returns a gap only because the
fixture writes `status: 'insufficient'` where the worker writes `'disabled'`.
When I corrected that, `coreGaps` returned `[]` and five separate overstatements
fired at once. That case is where the severity is.

## 1. Overstatement table

| # | surface | sentence | what read backs it | what the scan can know | sev | fix |
|---|---------|----------|--------------------|------------------------|-----|-----|
| 1 | MFA Readiness, second line | "Nobody can be seamless yet: everyone signs in from a device with no built-in option this tenant allows, such as a personal computer." | `readinessCells.ts:137 goalLine` over `r.readiness.devices` ← `snapshot.signInEvidence[id].devices`. **No status check of any kind.** | With no P1 there is no `signInEvidence` at all; `types.ts:143` says device facts absent "reads as device facts not read". Repro (micro, production free-tier shape): `counted = 0`, `active rows = 0`, and the line renders anyway — directly under `summaryNoP1`, "Readiness can't be measured for {cohort}…". The page denies and asserts the same fact in adjacent sentences. | **4** | `goalLine` takes the row set's device-read state; with none read it says so, as the Evidence panel below it already does. |
| 2 | Plan row + "Affected people" tile, `s-check-dormant-accounts` | "No user impact" — shown `[satisfied]`, over a step whose own body reads "731 enabled accounts with no successful sign-in for 90 days, or none on record." | `generate.ts:1121` deliberately sets `activeIds` to the dormant ids ("the one place never-signed-in accounts are a population… it names them, though none are active"); `generate.ts:2511` then overwrites it with `population(...)`, whose `activeIds = ids.filter(id => index.active.has(id))` (`:335-342`) is empty by definition for dormant accounts. `whoLine.ts:28` reads `activeIds ?? ids` → `[]`. | The step names N accounts to disable. Reproduced on **all eight fixtures**: `large` 731, `mid` 33, `messy` 14, `hostile` 6 — every one renders `{"known":true,"text":"No user impact"}`. | **4** | Delete the `generate.ts:2511` overwrite, or have it preserve the `activeIds` line 1121 set. |
| 3 | Plan, `s-prereq-trusted-location` Tasks Remaining | "Trusted Network — Everyone is remote", `outcome: 'pass'`, step **In place / No change needed** | `generate.ts:1042`: `mapping.trustedLocationIds.length === 0 ? 'Everyone is remote'`. That is a person's saved answer, in the same `configurationFindings` array that carries real scan checks. | The `notInEntra` answer ("we have an office network, it is not in Entra yet", `direction.ts:194`, `directionAnswers.ts:122`) also stores `trustedLocationIds = []` + `wizardAnswered.trustedLocations = true`, and the branch cannot tell it from `remote`. Reproduced with that answer *and* a filled draft: `{"value":"Everyone is remote","detail":"No office network is selected…","outcome":"pass"}`, `state.inPlace = true`, and the draft the person typed is never shown (its branch is gated on `!networkConfirmed`). Separately, on `hostile` the tile reads "Everyone is remote" while `config.namedLocations` holds a trusted `ipNamedLocation` named "Head office". | **4** | Read `questionAnswers['s-direction-locations:officeNetwork']` here; give `notInEntra` its own value and keep the step open with the draft. |
| 4 | Connect meta row; Plan header; MFA Readiness | "0 active people" / "No active people to count." | `population.ts:79 isActivePerson` → `mfaViability.ts:357 rolloutBucket` (`r.activity !== 'active'` → null). The layer above is correct — `mfaViability.ts:189-196` assigns `activity: 'unknown'` when the read is absent — and the counting layer discards it. | Graph withholds `signInActivity` without P1. Repro (micro, production shape): `facts: {accounts:10, active:0, notActive:8, states:{…all 0}}`. Every downstream denominator, the campaign population and the readiness gates inherit it. | **4** | `rolloutBucket` / `peopleCounts` distinguish `unknown`; surfaces render "not read", never 0. |
| 5 | Plan, `s-check-dormant-accounts` body + instruction | "{n} enabled accounts with no successful sign-in for 90 days, or none on record:" … "Disable it: Entra admin center → Entra ID → Users → the account → Edit properties → Account enabled: No." | `sets.ts:172-180 notActiveUsers`: `const at = last ? Date.parse(last) : Number.NaN; return !(Number.isFinite(at) && at >= cutoff)`. `UserRow.successfulSignInActivityRead` — "True only when signInActivity itself was returned for this user" (`types.ts:68`) — is never consulted, though `fromSnapshot.ts:109` consults it for the *other* activity reading. | Repro (micro, production shape): `notActiveUsers: 10 of 10 users`; the step's population is 8. Argued down from catastrophic only because the step's `why` and `licenceNote` do carry the caveat — and the row, the tile and the export all drop both (§5). | **4** | One `activityKnown()` helper, used by both readings. |
| 6 | Export / ICS / prompt pack / bundle, every step | the export's whole Who is one sentence | `stepExport.ts:231` `who: contract.who?.text ?? null`. `ExportStep` (`roadmap/types.ts:613`) has no field for evidence lines, names, groups or notes. `whoEvidenceLines`' only non-test caller is `whoBlocks.ts:78` (the screen); `stepExport.ts:541` sits inside `stepLines()`, documented at `:517-522` as "for the tests that read rendered text without a DOM". | The comment at `whoBlocks.ts:18-21` asserts the opposite and is false: "Nothing is dropped and nothing is re-decided. These are the same lines the export view reads (stepExport.ts whoEvidenceLines), filled the same way". Full list in §5. | **3** | Add a qualifiers field to `ExportStep`, emitted by `artifactLines.ts`. |
| 7 | `s-direction-use` → `deviceCode` | pre-selects **"Not used"** on a tenant where nothing was read | `direction.ts:103-104`: `const code = snapshot.evidenceUsage?.deviceCode ?? null` … `suggested: answer(code !== null && code.count > 0 ? 'used' : 'unused')`. | `content.json:2427`: "Answering Not used builds the policy that blocks it." So a no-evidence default proposes a blocking policy. Argued down from 4 because the evidence line beside it is honest — "A default, not something the scan saw." — which is exactly the mitigation the owner built for `officeNetwork` on 2026-09-20. | **3** | Same treatment as `officeNetwork` (`direction.ts:188-193`): unread → the conservative suggestion. |
| 8 | `s-direction-use` → service questions | "No {service} sign-ins in the last 30 days." / "{service} sign-ins were seen in the last 30 days." | `applicability.ts:34-46 seenInUsage` over `appSignInSummary` + `spActivity`. `ServiceSignal.complete` (`workflows.ts:57`) does check both statuses are `ok` before absence is asserted — good. | The collectors (`collectors.ts:348-354`) request `/reports/applicationSignInDetailedSummary` and `/reports/servicePrincipalSignInActivities` **with no period or date filter**, and nothing in the snapshot records either report's window. `servicePrincipalSignInActivities` carries an all-time `lastSignInActivity`, and `seenInUsage:45` accepts any parseable `lastSignInDateTime` however old. The sentence names a window IAMAI neither set nor read. | **3** | Drop "in the last 30 days", or record and quote the report's own window. |
| 9 | Connect, scan step | "complete · {age}" | `Connect.tsx:508-509` from `runner.gaps.length === 0`. `coreGaps` inspects three sections and treats `partial` as read (`coreSections.ts:12,22`). | Verified: `devices` 403 + `registrationDetails` 403 + `config.namedLocations` 403 → `coreGaps: []` → "complete". | **3** | "complete" only when `unreadSources()` is empty too; otherwise "complete, with gaps". |
| 10 | App shell, every route | "{tenant} · Last successful scan: {date}" | `AppShell.tsx:333`, `snapshot.asOf`, **no status check**. Its caveat sibling — "Some configuration reads were unavailable. Check the affected steps before making changes." — fires only on `config.*.status === 'error'`. | Verified: `config.namedLocations` set to `'partial'` → banner `false`; `sources.*` is never examined. | **3** | Widen the caveat to `partial`/`disabled` and to `sources.*`. |
| 11 | Connect, gaps list | per-section value "not read" | `connectView.ts:406` ← `unreadSources()` (`coreSections.ts:53-79`), which pushes any config status ≠ `ok` and any source outside `{ok, partial}`. | A `partial` section and an `insufficient` source are both printed as "not read", although the honest words already exist at `content.json:1503-1510` — "partly collected", "too few to use", "not available on this licence". Rounding in the *other* direction. | **2** | Use those words. |
| 12 | Plan, block-legacy-auth / block-device-code tiles | "A quiet sign-in history does not establish that every scheduled mail job has stopped using basic authentication." (`content.json:4545`); "The sign-in records cover observed use; they can miss infrequent CLI, shared-device and enrollment workflows." (`content.json:4643`) | Rendered on `hostile`, where `signInEvidence = {}`, `evidenceUsage = null`. Both imply a history that does not exist. | **Argued down**: `coreGaps(hostile.snapshot)` returns a gap, so the runner builds no plan in that state, and on a `partial` read the records are real. Reachable only as a fixture artefact — but see §7 pattern 8. | **2** | — |
| 13 | Plan, `s-check-dormant-accounts` / `s-check-separate-admin-accounts` | "Last sign-in dates need Entra ID P1; without it every account here reads no sign-in on record." (`content.json:2991`); "Mail and Teams activity needs Entra ID P1; without it IAMAI sees no everyday use here, and the review is yours." (`:6327`) | `who.licenceNote` has no placeholders, so `whole()` always passes and `whoEvidenceLines` always emits it. | Rendered on all eight fixtures, seven of which hold P1. The honest caveat is therefore unconditional and carries no information — and the export drops it entirely (§5). | **2** | Gate on `signInsNeedP1(snapshot)` (it already exists, `readinessContext.ts:114`). |
| 14 | Connect, account row | "{upn} holds none of the roles that read {sections}." | `tokenRoles.ts:29-42`, the token `wids` claim only — not `config.roleAssignments` / `pimEligibility`. | `wids` does not enumerate custom directory roles or AU-scoped roles, so it cannot establish absence. The null case *is* handled (`tokenRoles.ts:62`). | **2** | Word it as what the token says. |
| 15 | MFA Readiness, opening line | `lead.none`: "…a passkey on the phone, which also signs them in from a computer." | `readinessCells.ts:106-116 computersSeen` returns `'none'` for both "no computer seen" and "no computer read". | The `lead` variants are careful to name only the platforms seen; `seamlessNone` (`content.json:869`) names Windows Hello unconditionally regardless. | **1** | Give `computersSeen` a fourth value for "not read". |

## 2. Unknown rounded to known

The commonest and most damaging class here, in order:

1. **`sets.ts:172-180 notActiveUsers`** — `signInActivity` not returned → `NaN` → **dormant**. Drives the dormant step, its population, the ladder rung, `contentLists.accountsWithState` ("no sign-in on record"), and the disable instruction. Repro: 10 of 10 users.
2. **`mfaViability.ts:357 rolloutBucket`** — `activity: 'unknown'` → not in the rollout → **"0 active people"** on Connect, the Plan header, MFA Readiness, the campaign. The layer above models `unknown` correctly; the counting layer discards it.
3. **`readinessCells.ts:137 goalLine`** — no device records → **"Nobody can be seamless yet: everyone signs in from a device with no built-in option this tenant allows."**
4. **`generate.ts:1042`** — no saved trusted location → **"Everyone is remote"**, `outcome: 'pass'`, step In place.
5. **`direction.ts:96, 104, 113, 118, 140, 146, 151`** — unread → the concrete negative suggestion (`'none'` / `'no'` / `'unused'`) for `mailDevices`, `deviceCode`, `partner`, `externalMethods`, `serviceAccounts`, `sharedDevices`, `deviceExceptions`. `officeNetwork` (`:194`) and `service:*` (`:74`) are the two that got the conservative treatment.
6. **`coreSections.ts:53-79 unreadSources`** → `connectView.ts:406` — `partial` and `insufficient` both printed as **"not read"** (rounding the other way).
7. **`inventoryTables.ts:74-83`** — the Export page's people CSV writes an empty `Last sign-in` cell for both "never signed in" and "activity unavailable". The Inventory page's own CSV keeps the distinction (`InventoryPage.tsx:452` → `copy/definitions.ts:34-38`, "Activity unavailable").
8. **`Connect.tsx:508-509`** — any non-core read failure → **"complete"**.
9. **`AppShell.tsx:333`** — `config.*.status === 'partial'` or `'disabled'`, or any `sources.*` failure → **"Last successful scan"** with no caveat.
10. **`tokenRoles.ts`** — a `wids` claim that omits custom roles → **"holds none of the roles"**.
11. **`applicability.ts:34-46`** — no row in two reports whose window is unknown → **"No {service} sign-ins in the last 30 days."**

## 3. A person's answer drawn as a scan finding

1. **`generate.ts:1042` "Trusted Network: Everyone is remote"** — the clear case. It is a `configurationFindings` entry, i.e. the same array that carries real scan checks (`Legacy Per-User MFA`, `Administrator Account Evidence`, `Global Administrator Assignments`), with `outcome: 'pass'` and a green tile. Its value is read entirely from `mapping`. The sibling values "Create the saved network" and "Selected location needs correction" are from `mapping` too.
2. **`s-prereq-trusted-location` reaching In place** — the state is set from the wizard answer plus an empty selection (`generate.ts:1045`), not from anything in the tenant.

Checked and found correctly separated (this boundary is mostly well held):
- Direction `suggested` values are labelled "Suggested" and carry "A default, not something the scan saw." (`content.json:2365`) or the read they came from; `direction.ts:82` even records `basis: 'present' | 'absent' | 'unread'`.
- The exclusions-group suggestion: "This is not saved intent; nothing uses it until you choose it and select Save." (`content.json:2885`).
- `breakGlassUserIds` — only an operator-saved decision writes it.
- `manualReview.verification` keeps `'unread' | 'historical' | 'incomplete' | 'changed' | 'current'` apart (`manualWork.ts:314`).

## 4. Screen vs export vs print

The screen and the print agree throughout — the print forces tiles and More open
(`StepSections.tsx:318`, `ContentStep.tsx:565-573`), so no note and no held name
is lost on paper. **The divergence is entirely screen/print vs export**, and it
runs one way: the export keeps the numbers and drops the qualifiers.

Lost by the export (ICS, prompt pack, grounding bundle, plan file) because of
`stepExport.ts:231`:
- Every `who.none` line, including the model sentence `"No device-code sign-ins in the records since {from}; that does not prove nothing uses it."` (`content.json:4631`).
- Both `licenceNote`s (`content.json:2991`, `:6327`) — so the dormant export states the count with the caveat removed.
- `who.overlap`: `"Each person appears once, in one group; an admin with no sign-in method is in that list with the admin instructions."` (`content.json:3843`) — skipped at `stepExport.ts:423`.
- Every `{from}` clause, so **the covered sign-in window appears in no export artifact at all**.
- The guest inventory's `"At least "` prefix and `"Guest accounts returned by the incomplete directory read."` (`stepContract.ts:613-615, 1524`) — the count and its incomplete-read qualifier both go.

Lost by the export elsewhere:
- The people tile's note: `"This is the population IAMAI resolved for this policy. It is not a prediction that every account will be prompted."` (`content.json:1770`) and `"These are the accounts this step asks you to review…"` (`:1774`). The export keeps `who` and `covers N enabled`; the qualifier is not in `ExportStep`.
- `contract.found` — only the `in-place` entry is spliced in (`stepExport.ts:318`), so `"Enforcement waits for {measure} to reach {threshold}; it is {value} today."` (`stepContract.ts:535`) is screen/print only.
- `more.risks` / helpDesk / manager (`ContentStep.tsx:648-655`).
- `manualEvidence` reaches the ICS and the pack (`artifactLines.ts:67`) but not the bundle (`prompts.ts:231-268`).

Scan provenance:
- The print cover states the scan date (`PrintPlan.tsx:182-184`). The ICS, the prompt pack and the plan file do not; the bundle carries only the export day (`prompts.ts:276`). Only per-step AI Info states it (`aiGrounding.ts:159`).
- **No print artifact states a source failure.** The bundle carries one bare enum word for one source — `prompts.ts:213` `signInEvidence: snapshot.sources.signInEvidence?.status ?? 'unknown'` — with no reason and no window. Grep confirms neither `aiGrounding.ts` nor `stepExport.ts` reads `snapshot.sources.*.status` anywhere else.

Parity that holds: `"Directory read incomplete: <reason>"` (`stepContract.ts:596`) reaches all three because it rides inside `contract.who.text`; `covers N enabled`; the one next action and its gate; Done when; Dates; If wrong; the lane label; the rollback suppression rules; `population: null` on exactly the steps whose reach is unsettled.

## 5. FROZEN

Findings recorded, not applied.

**Establish Emergency Access**

- **F1 · severity 4.** The AI Info channel for `s-prereq-break-glass` on a tenant whose `registrationDetails` and `authMethods` could not be read says:
  > "- No account preparation action is currently projected. Rescan after any tenant change."
  The screen for the same step, same snapshot, says "Prepared passkeys = Could not verify" and, per account:
  > "IAMAI could not fully check this account. Open MFA Readiness and find it under Emergency access, where Evidence read says what could not be read. No account change is established."
  The briefing turns "could not read" into "nothing to do", on the step that decides whether a break-glass account can get in. An overstatement here matters more, not less.
- **F2 · sound.** The step's own tiles hold the line: "Passkey check incomplete", "Could not verify"; and the four facts it does keep — `Cloud-only account`, `Signs in with the tenant's onmicrosoft.com address`, `Account enabled`, `Permanent, active Global Administrator` — are all from `users` + `roles`, both `ok`.
- **F3 · sound.** `s-prereq-exclusion-group`: "Core - Exclusions · 2 members · excluded from 3 of 3 policies", with `content.json:2889` adding "The count shows policies this scan verified."

**Direction (`s-direction-*`)**

- **F4 · severity 4.** `s-direction-locations` is answered correctly; the *non-frozen* trusted-network step misquotes it as "Everyone is remote" (table #3). The fix is outside the freeze.
- **F5 · severity 3.** `s-direction-use` → `deviceCode` pre-selects "Not used" from no evidence, and "Not used" builds the block (table #7).
- **F6 · severity 3.** `s-direction-use` → the `service:*` evidence lines name a 30-day window the scan did not set (table #8).
- **F7 · sound.** `direction.ts:188-193`, the officeNetwork suggestion and its written reasoning, and `direction.ts:82`'s three-valued `basis` — this is the product's own best answer to this whole pass.

## 6. Patterns — one commit per class

1. **One flag, one consumer.** `UserRow.successfulSignInActivityRead` is honoured by `fromSnapshot.ts:109` and ignored by `sets.ts:172`. A single `activityKnown()` helper fixes the dormant step, the ladder rung, `contentLists.accountsWithState`, the export CSV and the Inventory column together.
2. **`unknown` collapses at the counting layer.** `mfaViability` models four activity states; `rolloutBucket` keeps one. Every headline count is downstream. Fix the predicate and give the unread case a word — not per-surface guards.
3. **Absence lines are gated on placeholder completeness, not source status.** `stepExport.ts:440` emits `who.none` whenever nothing else rendered; the only thing that ever suppresses it is a missing `{from}` via `whole()`. A line with no placeholders (both `licenceNote`s) is unconditional. `whoEvidenceLines` should take the source states.
4. **The export is a different object, not a projection.** `ExportStep` has no `found`, no `inventory`, no tile notes, no who-evidence lines — and every qualifier lives on the screen's side of that boundary. One added field closes most of §4. Delete the false comment at `whoBlocks.ts:18-21` in the same commit.
5. **No artifact states the scan's own health.** A single "what this scan could not read" block — source, status, reason, covered window — shared by the print cover, the bundle header and AI Info's Tenant-and-scope section.
6. **`coreGaps` is the only status gate and it guards three sources.** Everything else can fail silently behind "complete · 17h ago" and "Last successful scan".
7. **The owner's 2026-09-20 rule is applied twice out of nine.** `officeNetwork` and `service:*` round unread to the conservative answer; seven sibling questions round it to the concrete negative.
8. **Fixture coverage, not a product fault, but the reason the above went unseen.** `coreGaps(hostile.snapshot)` and `coreGaps(micro.snapshot)` both return a gap, so the runner would build no plan for either — yet both are in `docs/qa/tile-dump.txt` and `docs/qa/step-snapshots/`. `micro` is the near miss: it writes `signInEvidence.status: 'insufficient'` where `worker.ts:332` writes `'disabled'`, and `coreSections.ts:41` exempts only `'disabled'`. **The no-P1 tenant — the day-one public-beta case — is in no fixture.** A fixture with `{status:'disabled', reason:'not available on this licence (needs Entra ID P1)', coveredWindow:null}`, empty `signInEvidence`, and `signInActivity` withheld from every `UserRow` would have caught findings 1, 2, 4, 5 and 13 at once.

## 7. Claims I checked and found sound

The strongest, because the owner needs to know what holds:

- **`coreSections.ts` + `actions.ts:115`** — no plan is built and no record stored when CA policies, users or the sign-in log could not be read. The best guard in the product; it makes several plausible findings unreachable.
- **`mfaViability.ts:186-204`** — `activity: 'unknown'` when the read is absent; `evidenceUsable` checks the status; `observable` is bounded by the covered window at both ends. The modelling is right; only the consumers round it.
- **`MfaReadiness.tsx:668-700`, the Evidence read panel** — the covered window with its day count, `partial` worded apart from `full`, `0` plus the source's own reason when nothing was read, then the targeted-read count, `notCovered` and `unreadMethods`. This is the shape every other surface needs.
- `content.json:4631` — "No device-code sign-ins in the records since {from}; that does not prove nothing uses it." The model sentence for the whole class.
- `content.json:2980` — "A blank record is not proof of disuse: the directory keeps sign-ins only so far back, and never fills the gap in later."
- `content.json:208` — "no sign-in records read for this policy, {seen} of {people} active people seen in {n} days": unread state, count and denominator in one clause.
- `content.json:1145` — "Microsoft reports their passkey used {date}, but no sign-in with it shows in 30 days. A last-used date alone never makes someone Ready."
- `content.json:861` — "Readiness not measured for {cohort}: this scan holds no sign-in proof.", gated by `signInProofRead` (`fromSnapshot.ts:30-33`), which checks the status **and** that proofs were recorded.
- `contentLists.ts` risk lists — "That rating is read from the sign-in records; a record without one counts as unknown, never as no risk. Identity Protection's own risk reports are a separate surface this plan does not read."
- `stepContract.ts:588-604 whoOf` — returns `known: false` with the source's own reason rather than a number, and `stepExport.ts:236` writes `population: null` for exactly those steps. "An unknown reach is never written down as a number" is true.
- `stepContract.ts:607-616 inventoryOf` — "At least " and "Guest accounts returned by the incomplete directory read" when `sources.users.status !== 'ok'`.
- `manualWork.ts:244` — the per-user-MFA finding keeps "N accounts enabled" / "Not fully read" / "Disabled" apart with three matching outcomes, and only satisfies on `users.status === 'ok' && unknown.length === 0 && enabled.length === 0`.
- `generate.ts:1122` — the dormant step is satisfied only when `dormant.length === 0 && sources.users.status === 'ok'`.
- `stepContract.ts:1350` — the people note is suppressed over an empty reach, "because a sentence about a list that is not there".
- `aiGrounding.ts` boundary — "What follows is what IAMAI observed in this tenant's latest scan and what its plan proposes. It does not confirm that any change has been made."
- `types.ts:64, 109, 129` — the collector types already carry the right distinctions: `lastSignInAttempt` "must never be used as successful activity"; `RegistrationRow.complete` "True only when the report returned every field used to assert absence"; `UserEvidence.proofs` absent "reads as proof not read, never as none".
- `whoLine.ts:83` `covers N enabled` — the denominator travels to screen, print **and** export.
- Connect's `degraded` flag ("Sign-in proof not read · MFA readiness not measured") and the whole "finished with gaps · no plan built" state, both properly status-checked.
- `derive/facts.ts` — one denominator for every count on every surface. The architecture is right; the bug in #4 is inside it, not around it.

## Not traced

- The Home page: confirmed it is generated statically from `pages.home` before any sign-in and holds no snapshot, so it has no tenant assertion to audit. Not read further.
- The walk and smoke suites: out of scope for this pass.
- Whether Microsoft's `applicationSignInDetailedSummary` defaults to 7 or 30 days — I state only what the repo shows: no period filter is sent and no window is recorded.
