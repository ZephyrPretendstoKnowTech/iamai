# Audit: Establish Emergency Access (Steps 1–4) after prompt 60

Read-only audit at HEAD (main, prompt 60 = 11d3650..3fff75d, plus later 716a3d42 and 6ab27e76, which touch these steps).
Standard: `docs/EMERGENCY-ACCESS-HANDOFF.md` and `docs/prompts/60-passkey-comparison-and-tile-standard.md`.
Step ids: `s-prereq-break-glass` (1), `s-prereq-exclusion-group` (2), `s-prereq-passkey-settings` (3), `cleanup-drill` (4).

## Test run

Command: `node --test --test-isolation=none` over the handoff's 8 files, plus emergencySubjectTiles, emergencyAccountTasks, passkeyProfiles, passkeySettings, emergencyGroupTasks, emergencyInstructions, emergencyAccounts, emergencyGateCreate, passkeyPresentation and emergencyImplementationPowerShell.

Result: 4 failures, in 2 files that are **not** in the handoff's gauntlet. Every other test passed.
- `src/ui/surfaces/emergencyGroupTasks.test.ts:73` "new-group procedure discovers the group before selection and save". The test expects "Select the exact group", but 716a3d42 changed that step to "Select the new group under **Exclusions group**".
- `src/ui/surfaces/emergencyGroupTasks.test.ts:82` "a saved group with unread evidence…". The test expects `steps[0]` to name the object ID and Add/Remove lines while membership is unread. 716a3d42 made "Keep your working administrator session open." the first step and emits Add/Remove only for known members.
- `src/ui/surfaces/emergencyGateCreate.test.ts:39` and `:68`. The fixtures now yield 10 gated creates (the test needs 20 or more). The `getiamai` fixture has none, so `gatedCreates(...)[0]` is undefined.

The stale tests came from 716a3d42, which asserted its changes in `emergencyInstructions.test.ts` only. The code looks right in both cases. The tests need updating (see POLISH P1).

## Rule → code → test

| # | Handoff / prompt 60 rule | Code | Test | Gap |
|---|---|---|---|---|
| 1 | Step 1: five checks (cloud-only, initial domain, enabled, permanent active GA, approved passkey vs current and intended settings) | `roadmap/emergencyAccountPreparation.ts:25-47` | `emergencyAccountTasks.test.ts` (44, 56, 67, 83, 94) | No direct unit test of `emergencyAccountPreparationOf` |
| 2 | Step 1 needs at least 2 accounts to complete | `emergencyAccountPreparation.ts:50`, `generate.ts:1319-1324` | none | **Gap**: no test that one fully prepared account leaves Step 1 not Completed |
| 3 | No recent-sign-in completion check in Step 1 | `EMERGENCY_ACCOUNT_RULES` (`validation/emergencyTiers.ts:31`) | `emergencyAccountTasks.test.ts:140` | – |
| 4 | Suggested account names only in the create SOP | `emergencyAccountTasks.ts:99` | `emergencyAccountTasks.test.ts:21` (partial) | – |
| 5 | Dedicated-account signal: a note on Step 1 that gates nothing, still shown in Step 4 | `emergencyAccountTasks.ts:151-159, 215` | `emergencyAccountTasks.test.ts:218, 235` | – |
| 6 | Step 1 passkey task names only failing accounts, with no AAGUID line | `emergencyAccountTasks.ts:232-243` | `emergencyAccountTasks.test.ts:188, 198` | The approved-hardware variant still puts the AAGUID inline (`:260`), see PLAN L9 |
| 7 | Step 2: assigned security group; not dynamic, mail-enabled or licensed | `emergencyJourney.ts:329-336`; `cleanupDone.ts:302-304` | `emergencyGroupTasks.test.ts` (dynamic, licences); rules.test (mail) | **Gap**: no journey or task test for the mail-enabled item |
| 8 | Direct membership matches the selection; missing and unexpected accounts named | `emergencyGroupTasks.ts:37-40`; `cleanupDone.ts:232,304` | `emergencyGroupTasks.test.ts:1`, `emergencyNextSteps.test.ts:16` | – |
| 9 | Policies requiring the group listed with mode and identity | `emergencyJourney.ts:354-373` | `emergencyJourney.test.ts:210` | Completion semantics disagree, see **B3** |
| 10 | A detected group is not saved intent | `emergencyJourney.ts:317`, `emergencyGroupTasks.ts:12-19` | `emergencyJourney.test.ts:96` | – |
| 11 | Step 3: four persistent tasks built from the same target builder | `emergencyPasskeyTasks.ts:139-231` | `emergencyPasskeyTasks.test.ts:55` | – |
| 12 | Set-valued passkey fields compared as sets | `passkeySettings.ts:316-348` | `emergencyPasskeyTasks.test.ts:106-149` | – |
| 13 | Storage judged by outcome | `passkeySettings.ts:103-104, 119-128` | `emergencyPasskeyTasks.test.ts:189`, `passkeyProfiles.test.ts` | – |
| 14 | Protections SOP: navigate first, provider entry, one Save per Add AAGUID, only differing values | `emergencyPasskeyTasks.ts:84-136` | `emergencyPasskeyTasks.test.ts:151-187` | – |
| 15 | Extra tenant models produce no row | `passkeySettings.ts:289-308` | `emergencyPasskeyTasks.test.ts:143` | MFA Readiness disagrees, see **B2** |
| 16 | Step 4: no manual verification controls | `CleanupStep.tsx:154` (excludes the drill) | `emergencyNextSteps.test.ts:81` | – |
| 17 | Baseline recorded on the first all-correct scan, after group acquisition completes | `cleanupDone.ts:318-345`, `planData.ts:401-418` | `cleanupDone.test.ts:35, 249, 317` | – |
| 18 | Start = last relevant audit change (or window start); late entries move it forward; a legacy baseline moves back | `cleanupDone.ts:252-277, 346-361` | `cleanupDone.test.ts:451, 464, 485` | **Violated** on the account/group-audit reset path, see **B4** |
| 19 | Pass = successful, interactive, fresh passkey sign-in after the start, with a complete candidate set; location not checked | `cleanupDone.ts:201-218, 142-159` | `cleanupDone.test.ts:174`, `emergencyJourney.test.ts:116` | – |
| 20 | Tile states the start time and why the last sign-in did not count | `emergencyJourney.ts:30-34` | `emergencyJourney.test.ts:230, 244` | – |
| 21 | Proof expires 90 days after the event | `cleanupDone.ts:180` (also `emergencyJourney.ts:408`, `cleanupPhase.ts:163`) | `cleanupDone.test.ts:290` | Checked in three places (PLAN L6) |
| 22 | Unread evidence suspends success but keeps history | `cleanupDone.ts:130-134, 335-339` | `cleanupDone.test.ts:21, 337` | – |
| 23 | An account change invalidates that account; a shared (group) change invalidates both | `cleanupDone.ts:234-246, 362-367` | `cleanupDone.test.ts:363, 411` | – |
| 24 | Schema-1 manual records are history only | `cleanupDone.ts:143, 179` | `cleanupDone.test.ts:65`, `manualEvidence.test.ts` | – |
| 25 | One account disabled does not destroy the other's generation | `cleanupDone.ts:307-313` | `cleanupDone.test.ts:317, 337` | – |
| 26 | Proof resets only when the recovery outcome changes; CA rollout does not reset it | `cleanupDone.ts:397-457` | `cleanupDone.test.ts:382, 399, 411` | – |
| 27 | Verify and Troubleshoot SOPs plus the recovery procedure | `emergencyVerificationTasks.ts`, `cleanupExport.ts:18` | `emergencyNextSteps.test.ts:57` | – |
| 28 | Completed accounts appear under Satisfied / Completed checks | `emergencyReadiness.ts:50-98` | `emergencySubjectTiles.test.ts:77` | Only 2-account fixtures (PLAN L10) |
| 29 | Only the Entra channel has a task selector; one Copy task; no Copy-all | `ContentStep.tsx:749-777` | `emergencyInstructions.test.ts` (partial) | – |
| 30 | Whole-step exports match the screen | Step 1 `stepExport.ts:343`; Step 4 `cleanupExport.ts:92-98` | `cleanupExports.test.ts` | **Steps 2 and 3 do not match**, see **B5** |

## Findings

### POLISH (tiny; no behaviour or design change)

- **P1 (tests left red):** update the two stale `emergencyGroupTasks.test.ts` tests to the 716a3d42 wording.
  - Line 76: change `'Select the exact group'` to `'Select the new group'`.
  - Line 89: change `steps[0]` to `steps[1]`.
  - Lines 90-92: assert only what unread membership emits (the object-ID line and "Confirm … appear as direct members"). Drop the Add/Remove regexes.
  - `emergencyGateCreate.test.ts:41, 70` pick fixtures that still have gated creates, or lower `checked >= 20` to the real count, and choose `base` from a fixture that has one. This is test-only; confirm with the owner that the getiamai fixture losing its gated creates is intended.
  - Then add both files, plus `emergencySubjectTiles`, `emergencyAccountTasks`, `passkeyProfiles`, `passkeySettings` and `emergencyInstructions`, to the handoff command at `EMERGENCY-ACCESS-HANDOFF.md:157-158`.
- **P2 (dead duplicate):** in `src/roadmap/emergencyJourney.ts`, `:425` `signInsPassed` is identical to `:424` `confirmationPassed`. Lines `:461-462` are also dead: when `verified` is true, `confirmation.value` is already `'Passed'`. Delete `:425` and `:461-462`, and use `confirmationPassed` at `:459`.
- **P3 (dead branch):** delete `src/ui/surfaces/passkeyPresentation.ts:16`. No finding has key `recovery-ready`.
- **P4 (dead branch):** delete `src/ui/surfaces/emergencyGroupTasks.ts:28`. No finding emits `group:isAssignableToRole`.
- **P5 (dead helper):** delete `src/ui/surfaces/emergencyAccountTasks.ts:225` `fixSet`, which is never called.
- **P6 (dead export and literal ids):**
  - `emergencyJourney.ts:35` `RECOVERY_DRILL` is unused. Either use it at `ContentStep.tsx:267` and `CleanupStep.tsx:113`, or delete it.
  - Replace the literal list at `ContentStep.tsx:405` with `!isEmergencyTaskStep`; it is the same set as `:266`.
- **P7 (hardcoded copy where a key exists):**
  - `ContentStep.tsx:377-379`: replace the ternary with `{contract.why}`. The literal is byte-identical to `steps[s-prereq-break-glass].why` (content.json:2442), and `stepContract.ts:881` already renders it.
  - `ContentStep.tsx:176`: change `Why IAMAI says this →` to `{CONTRACT.readiness.why}`.
  - `ContentStep.tsx:175` and `CleanupStep.tsx:177`: change `Scan to update the plan` to `content.shared.scanControl` (`SHARED.scanControl` in ContentStep).
- **P8 (stale words):**
  - `ContentStep.tsx:503`: change "Test Emergency Access and Record the Result →" to "Verify Emergency Access →". Step 4 has that title, and nothing is recorded manually.
  - Content keys in the adjacent ladder step (not one of the four steps; owner may leave them): content.json:6102 "Open Test Emergency Access in this plan to record the account-specific result and date." and :6107 "…recovery drill recorded in Test Emergency Access." should use "Verify Emergency Access".
- **P9 (wording):** in `emergencyVerificationTasks.ts:14`, change `'Both emergency accounts are verified.'` to `'Every selected emergency account is verified.'`. That matches the rail at `CleanupStep.tsx:188` and is true with 1 or 3 accounts. The string is currently not rendered anywhere, so the change has no visible effect.
- **P10 (wording):** content.json:2494 (Step 1 doneWhen) says "on the tenant's onmicrosoft.com domain". Insert "initial": "on the tenant's initial onmicrosoft.com domain". That matches the handoff check 2 and the tile "Initial onmicrosoft.com sign-in address". This needs a `[snapshots]` regeneration.
- **P11 (wording):** `emergencyJourney.ts:64` `excluded`. The second sentence is confusing. Change it to "The account is excluded from the Passkey (FIDO2) method. Remove it from the method's exclusions; the Conditional Access exclusions group is separate."
- **P12 (stale comments):**
  - `generate.ts:1326-1329`: "Step 3 waits on Step 2" should say "Configure Emergency Exclusions waits on Prepare Emergency Access Accounts". The code holds the group step on `bgStep`.
  - `passkeySettings.ts:210`: "The approved Microsoft Authenticator AAGUIDs" should say "The approved default model AAGUIDs (Microsoft Authenticator and YubiKey)".
  - `cleanupDone.ts:1-8`: the header still describes a Done control that records drill dates. Replace it with: automatic baseline and observed-sign-in proof (reconcileAutomaticRecovery); legacy dates are history.
  - `generate.ts:989-993`: "In place when every bg.* check passes" should also say "and all five preparation checks pass for two or more accounts".
- **P13 (hooks order):** `CleanupStep.tsx:83` returns early before the `useMemo` calls at `:88, :99, :100`, which breaks the Rules of Hooks. Move `if (!entry) return null` below `:105`. None of those hooks read `entry`.
- **P14 (handoff doc facts):**
  - `EMERGENCY-ACCESS-HANDOFF.md:8-11`: the local working copy path, reviewed base `ecc18030` and branch `feat/emergency-access-journey` are stale. The checkout is `C:\Dev\IAMAI` on `main`.
  - `:156`: "83 passed" belongs to the old file list.
- **P15 (casing; owner to confirm, tests assert these labels):** tile labels mix Title Case and sentence case.
  - Step 2: "Exclusions group", "Emergency account membership", "Policy exclusions".
  - Step 3: "Existing passkeys affected".
  - Step 4: "Sign-in evidence".
  - Title Case elsewhere: "Passkey Registration", "Passkey Protections", "Verification Results", and Step 4's own "Policy Exclusions".
  - The prompt and tests already call them "Sign-in Evidence tile" and "Exclusions Group tile". The change is at `emergencyJourney.ts:317, 320, 345, 352, 219, 459`, and the matching test strings need updating.
- **P16 (content keys; CLAUDE.md "missing key → add it"):**
  - The headings "About this Step", "Tasks Remaining", "Implementation Tasks" and "Completion Criteria" are literals in `ContentStep.tsx:375, 404, 493, 506` and `CleanupStep.tsx:121, 132, 136, 151`.
  - Also literal: "No tasks remaining" (`ContentStep.tsx:170`), "Completed checks · N" and "N checks remaining" (`:148, :155`), the Step 2 rail sub (`:289`), and the Step 1 bar lines (`:396`).
  - Add keys and reuse them. There is no visible change.
- **P17 (missing tests for existing behaviour):**
  - (a) One fully prepared account: Step 1 is not Completed (`emergencyAccountPreparationComplete`).
  - (b) Three accounts: three Step 1 tiles, and Step 4 Completed only with all three proofs.
  - (c) A mail-enabled saved group yields a failing "Mail enabled" item and `automaticRecoveryPreparationStates` returns `incorrect`.

### BUG

- **B1 — Step 4 "Recorded Test" section and export evidence misreport automatic verification.** `CleanupStep.tsx:153`; `cleanupPhase.ts:167-169`; `cleanupExport.ts:57-88`.
  - `row.record` is the single latest drill record, and automatic proofs are per-account. `verification` compares `latest.basis`, which automatic records never carry.
  - Scenario 1, reproduced with a scratch run of `cleanupPhaseFor`: account A verified, B pending. The page shows "Recorded Test · 2026-09-18 · Passed · Tested accounts: Breakglass · The recorded check does not cover the current accounts or configuration." (`verification: 'changed'`).
  - Scenario 2: both accounts verified in one scan, as in the live acceptance. It shows "Tested accounts:" with only the last account.
  - Scenario 3: a baseline with no proof yet. The export's "Workflow Check" prints "Evidence status: historical · The earlier date is retained; it does not record a successful scoped test · Test date …" for a preparation record.
  - Fix (needs owner): for `row.kind === 'drill'`, render and export this section only for legacy records (`workflow !== RECOVERY_AUTOMATIC_WORKFLOW && workflow !== RECOVERY_PREPARATION_WORKFLOW && workflow !== RECOVERY_INVALIDATION_WORKFLOW`). The Sign-in Evidence tile already states per-account results.
- **B2 — MFA Readiness reads Step 3 as not applied when Step 3 is Completed with a retained extra model.** `derive/readinessContext.ts:87-89` vs `passkeySettings.ts:289-308`.
  - Step 3 keeps every model already on the allow list: target = current plus the missing required models, so In place allows extras (rule 15). `applied` demands the tenant list equal `requiredModels()` exactly.
  - Scenario: the allow list has the 4 defaults plus one existing hardware model. Step 3 reads Completed. MFA Readiness shows `checks.step3.note`: "Configure your passkey settings in Establish Emergency Access Step 3…". Keys of the retained model read "Blocked by Step 3’s approved list" (`scoring/phishingResistant.ts:551`), though Step 3 keeps that model allowed.
  - Fix (needs owner, MFA Readiness surface): `applied = passkeyReadingOf(...).state === 'inPlace'`, and take the after-Step-3 set from the resolved target's allowed AAGUIDs (`passkeyBindings` `passkey.target.allowedAaguids`), not from `requiredModels`.
- **B3 — Report-only policies: Step 2 completion, Step 2 tile and the Step 4 gate disagree.**
  - Step 2 In place uses `xg.usedConsistently`, which checks enabled policies only (`validation/rules.ts:817`).
  - The Step 2 tile and task list flag every enabled and report-only policy (`emergencyJourney.ts:356`, `emergencyGroupTasks.ts:43-52`).
  - The Step 4 baseline requires every *applicable*, non-disabled policy to exclude the group (`cleanupDone.ts:287, 303`).
  - Scenario: an existing Report-only policy targets All users without the group. Step 2 reads Completed, yet its tile shows "Group exclusion: Missing" and a required task. Step 4 can never record a baseline, and its Configuration tile sends the user back to the "Completed" Step 2.
  - Fix (needs owner): choose one rule and one derivation.
- **B4 — After an account or group audit event, the new Step 4 start is scan time, not the change time.** `cleanupDone.ts:362-366` sets `configurationObservedAt: at`.
  - The handoff (line 109) says the start is the last relevant audit change.
  - Scenario, reproduced with a scratch run: "Update user" on account A at 10:30, A's passkey sign-in at 10:40, scan at 11:00. The new start is 11:00, the 10:40 sign-in is rejected ("predates the current recovery configuration"), and 0 proofs are recorded. The admin must sign in again.
  - Fix (needs owner, lifecycle): `configurationObservedAt: recoveryConfigurationStableSince(input.snapshot, input.mapping, id, at) ?? at`. Add an assertion to `cleanupDone.test.ts:411`.
- **B5 — Step 2 and Step 3 exports do not match the screen.** `stepExport.ts:343` swaps in the task text for Step 1 only.
  - Verified on the `small` and `demo` fixtures: the Step 3 export `whatToDo` starts "Make the object this step names." (Step 3 makes no object). It then prints the old content.json SOP; the `{aaguidAndroid}` line silently drops and "keep the tenant's key restriction… without key restrictions, leave them off" is included, which contradicts the allow-list target.
  - The Step 2 export reads "Fix each failing check. 1 of 6 checks fail today." instead of the four tasks.
  - Fix (small, needs owner): follow the Step 1 precedent with `emergencyAccountTasksText(emergencyGroupTasksOf(...))` / `emergencyPasskeyTasksOf(...)` for those two ids.
- **B6 — The `bg.drilled` and `bg.lastSignIn` rules can never see Step 4 proof.** `validation/rules.ts:606, 675` pass no `signInSource` or `candidateSetBasis`, so `evidenceMatchesCurrentCandidate` (`cleanupDone.ts:143`) always returns false.
  - After Step 4 is Completed, `bg.drilled` still returns "no recovery test recorded…", and `bg.lastSignIn` returns "signed in …, not a recorded drill: confirm who signed in and why" for the verification sign-in.
  - I found no rendering of either result in the four steps or their exports. They are outside `EMERGENCY_ACCOUNT_RULES`, the IDENTITY/EXCLUSIONS/AUTH sets and gating, so this is latent.
  - Fix (needs owner): pass `recoveryEvidenceSource(snapshot)` and the candidate-set basis, or retire both rules (see L2).
- **B7 (latent, low) — case-sensitive id lookups.** `emergencyJourney.ts:39` (`accountLabel`) and `cleanupDone.ts:414` (`recoveryAccountBasis`) use `u.id === id`, while every other lookup lower-cases. If a saved id's case differs from Graph's, that account gets no basis and Step 4 never verifies. The fix is trivial (compare lower-case); the owner can treat it as polish.

### PLAN (owner decides)

- **L1:** remove the Step 2 and Step 3 branches of `emergencyImplementation` (`emergencyImplementation.ts:153-210`), which are dead text. When tasks exist, the portal artifact text is never rendered, copied or exported (`ContentStep.tsx:724-748`). That text is also stale: "Check Recovery Compatibility", "Additional Authenticators", "values in Readiness". Keep the portal tab itself.
- **L2:** remove the remnants of the manual-drill and pre-change iterations:
  - `RecoveryPurpose 'pre-change'`, `preChange*` phase fields (always `{}` at `generate.ts:2523, 2526`) and `latestFailedAtByAccount`;
  - the unused `isRecordedDrill` param `_legacyDates`, the unused `cleanupComplete` param `answers`, and `tapAvailable` (always null);
  - the `emptyTaskText` for Step 4, which is unreachable because there are always two tasks;
  - the `bg.drilled` and `bg.lastSignIn` rules, if B6 is not fixed.
- **L3:** keep one source for the emergency step ids. Today there are `stepIds.ts`, `emergencyJourney.ts:19-35`, `planBoard.ts:391`, `blockerSteps.ts:55` and the literals in ContentStep and CleanupStep. Also note that `EMERGENCY_ACCESS_STEP_IDS` (no skip, never "doesn't apply") omits `s-prereq-passkey-settings` and `cleanup-drill`.
- **L4:** keep one Microsoft Authenticator AAGUID pair (`emergencyJourney.ts:43` `MOBILE_MODELS` duplicates `emergencyPasskeyTasks.ts:85`). Keep one model-name table: MFA Readiness names Windows Hello `08987058…`, while the handoff and Step 3 talk about `9ddd1817…`.
- **L5:** make Step 4 completion also require the Configuration outcome to not be `fail`.
  - Since prompt 60 narrowed the basis, a Step 3 regression such as attestation turned off leaves the proof valid until `reconcileAutomaticRecovery` runs after group acquisition.
  - Until then, or in any `readOnly` view, Step 4 shows Completed and "Verification Results: Passed" beside "Configuration: Correction required".
- **L6:** keep one expiry check. The 90-day test lives in `cleanupDone.ts:180`, `emergencyJourney.ts:408` and `cleanupPhase.ts:163`.
- **L7:** free-tier (ladder) tenants cannot complete Step 4. The `micro` fixture has the ladder step and the drill row, but with no exclusions group (and Security Defaults on), `automaticRecoveryPreparationStates` never reaches `ready`. Decide what Step 4 means there.
- **L8:** `passkeyTypes` as an array. `samePasskeyValue` accepts it, but `findingsFor` and `targetPasskeyTypes` (`passkeySettings.ts:104, 119`) treat an array as unread. Use one normaliser if Graph ever returns an array.
- **L9:** the Step 1 approved-hardware variant still puts `AAGUID …` inline (`emergencyAccountTasks.ts:260`). The prompt removed only the header line; confirm whether this inline mention should stay.
- **L10:** add fixtures with one and three emergency accounts across all four steps, and a Step 3 profile tenant with a retained extra model. That last fixture would cover B2.
- **L11:** show Step 4's "Emergency recovery procedure" scan time (`CleanupStep.tsx:152`, `toLocaleString`) with `recoveryTime` and the display zone, like the tiles.
- **L12:** the late-audit path (`cleanupDone.ts:352`) uses the broad change set (any `Policy`-category audit). A late-arriving, unrelated policy audit can still retire proof. It is documented, but it is at odds with "routine CA rollout does not reset proof".
- **L13 (tenant data):** nothing tenant-derived is in the current fixtures or docs for these steps. The AAGUIDs are public vendor ids, and `fixtures/private/` is gitignored. However:
  - git history of the prompt 60 file (11d3650) contains a live UPN; 37e5bf52 replaced it, but it is still in history;
  - the tracked `docs/preview-corrections/references/claude-summary-audit.md:5, 73` contains the live tenant's admin UPN (outside these steps).

## Prioritised list

**POLISH (ready to apply):**
1. P1: fix the red tests and extend the handoff gauntlet.
2. P2–P6: dead code, branches and duplicates.
3. P7: literals replaced by existing keys.
4. P12: stale comments.
5. P13: hooks order.
6. P8–P11: wording.
7. P14: handoff doc facts.
8. P17: missing tests.
9. P15: casing (owner to confirm; tests to update).
10. P16: new content keys.

**BUG:**
1. B1: Recorded Test and export evidence misreport automatic verification (visible on the live tenant).
2. B3: report-only rule split across Step 2 and Step 4.
3. B4: new start is scan time after an account or group event.
4. B5: Step 2 and Step 3 exports differ from the screen.
5. B2: MFA Readiness vs Step 3 with a retained extra model.
6. B6: `bg.drilled` / `bg.lastSignIn` blind to proof (latent).
7. B7: case-sensitive id lookups (latent).

All fixes except B7 need the owner.

**PLAN:**
1. L5: completion gated on Configuration.
2. L1, L2: dead-code removal.
3. L3, L4, L6: single sources.
4. L7: free-tier Step 4.
5. L10: fixtures.
6. L9, L11, L12, L8.
7. L13: history and tracked audit doc.
