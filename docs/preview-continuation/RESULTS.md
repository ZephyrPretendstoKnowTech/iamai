# Continuation results

Starting candidate: adae27dfa3f2168a7ab3b7d8a7cd4462a04fbc13. Record each cycle's commits, changes, commands, outcomes and preserved unfinished work here. Prior results remain in ../preview-corrections.

Launcher source SHA: adae27dfa3f2168a7ab3b7d8a7cd4462a04fbc13

## Cycle 1 (2026-09-14, from 06:12 MDT)

Start: HEAD 37d32f5 (launcher docs on adae27d), clean tree, `git stash list` empty, no unfinished work to preserve. Dependencies: `npm ci --ignore-scripts --no-audit --no-fund --cache ../cache/npm` (exit 0). All logs are in `../logs/c1/` (outside the clone). Probes: `docs/preview-corrections/probes/*` reused; one new probe `docs/preview-continuation/probes/c1-a1-tagged.ts`.

### Commits
| Commit | Scope |
|---|---|
| 6f41c3a | C01 lone/strength target selection (coverage.ts, strength.ts); R2-N1 held-step preview (stepPackage.ts); policyIdentity tests |
| ed76b36 | A1 tagged/named drift duplicate (generate.ts), A1 test; correct-step lead (lifecycle.ts, content.json `milestone.correct`); R1-F5 Connect intro; walk feedback rule, page-contract forbid lists, walk empty-value `@()` rule with control |
| d15428e | R1-F3 Intune Enrollment exclusion on the correct path (generate.ts) and in the export's resources line (portalLines.ts); feedback link in the two Connect contracts' `links` allow lists; R1-F3 test; readGroup verification probe |

### C01 critical: lone group-assigned admins policy (FINDINGS 1)
- **Reproduced at 37d32f5** before any edit: `node docs/preview-corrections/probes/s5-lone-group-admins.ts` → step `correct`, `executable: true`, update of `c0100000-…0001` with `includeUsers:["All"], includeGroups:[]` (`repro-lone.txt`); `SHAPE=lone REV=0|1 r2-hold-export.ts` → PowerShell carries the admins id, export "Ready · Correct" opening "Create the policy in report-only." then `open "Policy A"` (`repro-hold-export-lone-rev0.txt`, `-rev1.txt`).
- **Cause:** coverage.ts `ownScope` for an all-users goal admitted every policy not assigned to roles or guests, whatever its grant asked, so a lone admins-group policy requiring the built-in phishing-resistant strength was the goal's own and generate.ts corrected it to All users.
- **Fix (no name or order rule):** a part-population policy whose grant asks more than the goal's floor is not the all-users goal's own. `strength.ts grantExceedsFloor`: a stronger method than the floor in the floor's dimension, or under AND a control of another kind (e.g. MFA AND compliant device); under OR only if every control is stronger. All users policies are unaffected (widening changes nobody).
- **After:** lone → `create-report-only` of the goal's own "Core - Require - MFA for all users" in report-only, no update, tracking null; viewer portal/PS/JSON/AI and export carry no admins id; export "Ready · Create" (`lone-after.txt`, `hold-export-lone-rev0.txt`, `-rev1.txt`). Strength policy beside a staff-group MFA policy → the staff policy "Policy B" is the update target in both orders, the admins id appears in no channel (`hold-export-tie-rev0.txt`, `-rev1.txt`).
- **Tests** (`src/roadmap/policyIdentity.test.ts`, `node --test --test-isolation=none src/roadmap/policyIdentity.test.ts` exit 0, 17/17, `identity-2.txt`): lone strength (group; group+user), lone MFA AND compliant device, lone MFA group+role — each reversed and with two name sets: no update, a report-only All users create, not tracked; rendered viewer artifacts and export text contain neither the admins id nor `"<its name>"`, next action `create-report-only`. Strength beside staff: own = [staff], update body `includeUsers:["All"]`, `includeGroups:[]`, no `grantControls`, tracking staff. Lone staff-group MFA: one update of the staff policy, `correct`, `executable: true`, PowerShell names its id. Existing role-assigned and All users shape tests unchanged and passing.
- **Changed assertion (disclosed):** the R1-F2 tie test's premise used "admins strength + staff MFA" as two policies nothing tells apart. Under this fix their grants tell them apart, so the tie test now uses two group-assigned MFA policies (still held: no update, no create, `ambiguousTarget`, not executable, untracked); the strength+staff shape has its own test expecting the staff target.

### C01/C05 R2-N1: held step's Implementation region (FINDINGS 2)
- stepPackage.ts `plannedPackageStateOf` returns null for `action.ambiguousTarget`, so the held step plans no create/correct preview that blames prerequisites. Test `C01 R2-N1` (both orders, every person Ready): `previewNote` null; no "New policy"/"create it" text in any drawn artifact or the export; neither tied id named. Contract and export already carried the hold copy (stepContract.ts:437, stepExport.ts:214; unchanged).

### C01 A1 drift (FINDINGS 2)
- **Untracked drift** (no tag, no record, demo name ≠ plan name): the report-only create beside the All users compliant-device policy is kept as legitimate coexistence (an All users compliant-device policy is also require-managed-device's shape; no name inference).
- **New defect found and fixed:** with the plan's own tag on the drifted policy, or the plan's exact proposed name, the step still proposed a duplicate create ("Core - Require - MFA for all users") while tracking followed the drifted policy by tag (`a1-tagged.txt`). generate.ts claimed only when coverage was `absent`; a drifted policy leaves coverage `partial` (other candidates) and is no candidate. Now the claim applies whenever the claimed policy is not among the goal's candidates → update of the drifted policy, tracked, held `manual-correction`, not executable (`a1-tagged-after.txt`).
- **Vacuous assertion fixed:** tracking.drift.test.ts A1's hold loop never ran. A1 now asserts directly: no update of another goal's policy, the ops are exactly one report-only create, the drifted policy is not tracked. New test: tagged and named drift → no create, update targets the drifted policy, tracking follows it, not executable, `manual-correction`. `node --test --test-isolation=none src/roadmap/tracking.drift.test.ts` exit 0, 21/21 (`drift-3.txt`).
- **Below-floor report-only own policy (gap 4):** re-probed, still a create beside it (`gap4.txt`); not fixed, see BLOCKED.

### C02 channel contradiction on correct steps
- The export (and Step Contract action) led every correct step with "Create the policy in report-only." above "open "Policy B" … Change only the settings listed above" (lifecycle.ts `deploy` milestone). lifecycle.ts now uses content.json `engine…milestone.correct` "Correct the existing policy with the changes listed." when every operation updates an existing policy (new content key). Verified: tie export leads with the correct sentence, lone create still "Create the policy in report-only." (`hold-export-tie-after.txt`, `hold-export-lone-after.txt`). No claim about state is made in the sentence.

### C02/C06 R1-F3: Intune Enrollment exclusion (FINDINGS 3)
- **Reproduced at ed76b36:** `SHAPE=tie FULL=1 r2-hold-export.ts` (staff policy corrected) → Entra step 4 "Under Exclude, Microsoft Intune Enrollment should be excluded" and AI "Microsoft Intune Enrollment is excluded", but JSON `applications:{"includeApplications":["All"]}`, PowerShell target without `d4ebce55…`, export silent (`tie-full.txt`).
- **Baseline target:** the pinned `IAC - GLOBAL - GRANT - MFA - AllUsers` excludes `d4ebce55-015a-49b5-a083-c84d1797ae8c`; the create body already carried it. The correction kept the tenant's resources (generate.ts `withPatch` over a users-only patch), so the target was wrong, not the prose.
- **Fix:** generate.ts adds the `applications` section to a single-policy correction when the baseline member excludes an application the tenant policy does not; the change is listed ("Target resources"). portalLines.ts names an all-resources policy's excluded applications ("Target resources → Resources → All resources; Exclude: Microsoft Intune Enrollment"), so the export states the same target on create and correct. Only two pinned policies exclude applications (AllUsers MFA; the Admin Portal block).
- **After:** changes `["Users","Target resources"]`, update body and target carry the exclusion; viewer portal/PS/JSON/AI and export all carry it, tie and lone, both orders (`r1f3-debug.ts` output, `r1f3-tie-after.txt`, `final-tie-rev0/1.txt`, `final-lone-rev0/1.txt`).
- **Test** `C02 R1-F3` (policyIdentity.test.ts, both orders): update `applications.excludeApplications == [d4ebce55…]`, `Target resources` listed, portal/AI name Intune Enrollment, JSON/PS carry the id, export line; control: a tenant policy already excluding it lists no resources change. 18/18 (`identity-5.txt`).
- **Effect on an enabled policy (disclosed):** the correction now also excludes Microsoft Intune Enrollment from that policy's MFA requirement, as the baseline does; it is listed as a change.

### Required walk / notice (FINDINGS 5)
- walk.mjs Connect rule: the feedback address is allowed only as the beta notice's one `mailto:feedback@getiamai.com` link inside `.callout`; the address anywhere else on Connect is still a P0, and a missing/duplicated link is a P0. The address removed from the `connect.signedOut` and `connect.signedIn` forbid lists only; `forbidEverywhere`, the error page's and How's rules unchanged.
- walk.mjs `EMPTY_VALUE`: `(?<!@)\(\s*\)` — PowerShell `@()` is a value; `()`, `( )`, `@ ( )` still flagged. Negative/positive control executes at walk start (throws if `$changed=@()` is flagged or `Grant: ()` / `Exclude @ ( )` are not). Checked: `node --check scripts/walk.mjs` ok; regex run on six strings.
- R1-F5: Connect intro "…close the gaps without locking anyone out." → "…close the gaps and see who each change affects." (content.json, connectSignedOut.test.ts pin, walk.mjs pin).

### FINDINGS 6: readGroup verification (no source change)
- `node --experimental-test-module-mocks docs/preview-continuation/probes/c1-readgroup.ts` (exit 0, `readgroup.txt`): msal.ts and cache.ts replaced with module mocks (they need `window`/IndexedDB at load), fetch synthetic. 8 PASS, 0 FAIL:
  - Complete read: present, complete, 2 ids, cache saved once.
  - Object body not JSON: `unknown`, not `absent`. Object 403: `unknown`. Object 404: `absent`.
  - Count body without a number: present, members `unknown`, count null.
  - Member page without a value array: members `unknown`.
  - Malformed later member page: members `unknown`, no partial ids, no cache write.
  - Slow answers (250 ms × 3 sequential requests): complete in 773 ms.
- The slow case shows each group read is three sequential requests. It does not measure or fix real login latency (C08 remains unverified against a real session).
- Worker end-to-end propagation and export parity beyond all-users: not done in cycle 1.

### Verification (exact code states)
| Check | Command | Code state | Exit | Result |
|---|---|---|---|---|
| Typecheck | `npx tsc --noEmit` | 6f41c3a tree; ed76b36 tree; d15428e tree | 0; 0; 0 | no errors (`tsc-1.txt`, `tsc-3.txt`, `tsc-6.txt`) |
| Full suite | `npm test` | 6f41c3a tree (walk.mjs/page-contracts.json edited during the run) | 0 | 2600 tests · 2598 pass · 0 fail · 0 cancelled · 2 skipped (Learn-link external health; HUGE=1) (`full-1.txt`) |
| Full suite | `npm test` | 6f41c3a + the 7-file batch-2 diff = ed76b36 (a whitespace-only lifecycle.ts fix landed during the run) | 0 | 2601 tests · 2599 pass · 0 fail · 0 cancelled · 2 skipped, same two (`full-2.txt`) |
| Full suite | `npm test` | ed76b36 + the batch-3 source/test diff = d15428e | 0 | 2602 tests · 2600 pass · 0 fail · 0 cancelled · 2 skipped, same two (`full-3.txt`) |
| Targeted | policyIdentity, tracking.drift, connectSignedOut, planTruth, readyToEnforce, content, contentChecks, exportsClean, fingerprint | ed76b36 tree before the drift test rewrite | 0 | 99/99 (`targeted-2.txt`); later policyIdentity 18/18 at d15428e (`identity-5.txt`), tracking.drift 21/21 (`drift-3.txt`) |
| Build | `npm run build` | ed76b36 tree; d15428e | 0; 0 | pre-existing chunk-size warning; `dist/` ignored (`build-1.txt`, `build-2.txt`) |
| Matrix | `node docs/preview-corrections/probes/s3-matrix.ts curated all` | ed76b36 tree; d15428e tree | 0; 0 | 490 renders · 0 mistyped · 0 empty tabs · 143 uncalled script templates · 20 passkey packageFault; the two runs' per-step rows are identical (0 diff lines). Unchanged from R2 because C02/C06/C05 were not addressed (`matrix.txt`, `matrix-2.txt`) |
| PowerShell parse | not re-run in cycle 1 | | | R2 parsed the 8 all-users/admins scripts. Cycle 1 changed no authored script body, but the R1-F3 target JSON bound into them now carries `excludeApplications` |
| Walk | `TEMP=../cache/tmp node --import ../logs/c1/netblock.mjs scripts/walk.mjs` (system Chrome over CDP; the preload lets only localhost through for Node fetch and Chrome host resolution); report `docs/reports/walk-ed76b36.md` and captures `walk/ed76b36/` (both gitignored) | ed76b36 | 0 | "show-ready on this walk (no P0)": **0 P0** (R2: 23), 506 P1, 50 P2. P1s from this cycle's changes: the notice link "feedback@getiamai.com" was not in the `connect.signedOut` allow list (11×), now added for signedOut/signedIn in batch 3; the Connect intro is over 25 words (as before, the old sentence was longer). Throttled first load 4.6 s (P1, as R2). Learn links not checkable offline (P2) (`walk.txt`) |
| Acceptance harness | `node <copy>/docs/preview-continuation/acceptance/run-acceptance.mjs <copy> ../logs/c1/acceptance`, where `<copy>` = `../acc-src-ed76b36` (`git archive ed76b364`, harness identical by `cmp`) | ed76b36 | 0 | 28 PASS · 0 FAIL · 0 HARNESS_ERROR (`acceptance/results.json`, `results.md`) |
| Acceptance harness | same, `<copy>` = `../acc-src-d15428e` (`git archive d15428ea`, harness identical by `cmp`), output `../logs/c1/acceptance-d15428e` | d15428e | 0 | 28 PASS · 0 FAIL · 0 HARNESS_ERROR (`acceptance-2.txt`) |
| Walk | same command as above; report `docs/reports/walk-d15428e.md` (gitignored) | d15428e | _pending at time of writing_ | `walk-2.txt` |
| readGroup probe | `node --experimental-test-module-mocks docs/preview-continuation/probes/c1-readgroup.ts` | d15428e tree | 0 | 8 PASS · 0 FAIL (`readgroup.txt`) |

### Not done in cycle 1 (actionable; see BLOCKED for evidence and next steps)
In risk order:
1. C02/C06: script invocation and in-place correction (143 uncalled templates).
2. C05: passkey projection (20 packageFault).
3. Below-floor report-only own policy (gap 4).
4. Export state "Ready · Correct" next to the action "Clear what this step is waiting on." on a blocked step.
5. Guest-exclusion `changedFields`; session-lifetime unmanaged member; register-info-protected mode.
6. "Prerequisite · In progress" for unstarted work, and the STEP.md references.
7. FINDINGS 6 verification: worker end-to-end propagation, and export parity beyond all-users.

The PowerShell parse was not re-run. No unfinished work is left uncommitted apart from these docs.

**Correction (cycle 2):** that last sentence was inaccurate. `src/ui/surfaces/contentReview.test.ts` and `riskDeviceCampaignContentSpecs.test.ts` were also uncommitted (the unfinished "Prerequisite · To do" rename; 3 tests failed against the unchanged planBoard.ts). The "pending" walk at d15428e never wrote a report; the cycle 1 reviewer's walk at d15428e did (0 P0).

## Cycle 2 (2026-09-14, 07:03–08:05 MDT)

Start: HEAD d15428e. Uncommitted: the cycle 1 ledger (RESULTS, BLOCKED), the cycle 1 review's FINAL-REPORT.md and REVIEW-STATUS.json, and the two unfinished test edits above. Stash empty. All were inspected and kept; the review artifacts and ledger were committed first (081da09). Logs: `../logs/c2/` (outside the clone). New probes: `docs/preview-continuation/probes/c2-ps-render.ts`, `c2-export-lane.ts`. Scratch transform (not in the clone): `../scratch/c2-unstage.mjs`.

### Commits
| Commit | Scope |
|---|---|
| 081da09 | docs: cycle 1 ledger and cycle 1 fresh review, committed after inspection |
| e208d3d | Walk R3: a Ready prerequisite reads "Prerequisite · To do" (planBoard.ts); the two cycle 1 test edits; 98 step snapshots regenerated, 110 label lines and nothing else `[snapshots]` |
| 7ed4caf | C02/C06: ten policy packages keep the policy's state on correction; their scripts are called |
| 74ad604 | C05: passkey settings project instead of a package fault |
| 58915aa | C05: passkey Entra lead line no longer names a JSON tab the settings step never draws |
| 3211c4b | Gap 4: a report-only own policy below the floor is corrected, not duplicated |
| 7898cb4 | C02 immediate effect: correction lead, mfa-all-users/admins verify line, mfa-all-users AI Info |
| a409b3c | FINDINGS 5: 18 STEP.md references removed from drawn package text (0 remain); passkey existing-key sentence moved to step 3 after the 7898cb4 walk flagged the AAGUID step as one sentence over 25 words |

### Unfinished prerequisite label (review queue 1): FIXED
- planBoard.ts `PREREQUISITE_STATE.Ready` "In progress" → "To do" (doc comment too). `node scripts/step-snapshots.mjs` rewrote 98 files; `git diff` showed exactly 110 `-"In progress"`/`+"To do"` label lines. contentReview, riskDeviceCampaignContentSpecs, stepSnapshots: 21/21 (`label-tests.txt`).

### C02/C06: staging scripts and state-keeping corrections (review queue 2, 3): FIXED for ten packages
- **Cause:** admin-session, azure-management-mfa, block-auth-transfer, block-device-code, block-legacy-auth, block-unsupported-platforms, geo-restriction, mobile-app-protection, register-info-protected and require-managed-device ran `StageForCorrection` (PATCH an enabled policy to report-only) before `Correct*`, threw "Refusing access-affecting correction while policy is On", and drew the script as a `template` with mandatory `-Mode/-TargetPolicyJson` and no call. Their Entra/AI text said "move it to Report-only first", and three also said "leave it On".
- **Fix (the mfa-all-users/admins precedent, 6e3682f):** `powershell.run` is `deployableAfterBinding` with a declared invocation (`-TargetPolicyJson` ← `policy.target.json` in every mode; `-PolicyId` ← `policy.current.id` in every mode but Create). The staging mode, its ValidateSet entry and the refusal guard are removed; META projections drop the staging runs; `policy.target.json` declared. The three scripts whose Enforce needs `-ReadinessApproved` (azure-management-mfa, block-unsupported-platforms, mobile-app-protection) declare `withheldModes.Enforce` with the reason (no package prerequisite attests it), so no throwing Enforce call is drawn. Entra and AI Info keep the state and say what saving does, worded per block/grant/session/conditions ("Keep its current state: if it is On, the block applies to the corrected users and conditions as soon as you save."). correctionModules `safety` says the same. "when STEP.md says this is a session-only policy" replaced in the grant blocks.
- **Immediate effect (7898cb4):** content.json `engine.milestone.correct` (export/Contract lead on an all-update step) adds "If it is On, they apply to sign-ins as soon as you save."; mfa-all-users and admins verify line "Save. Leave **Enable policy** as it is: if the policy is On, these changes apply to sign-ins as soon as you save." (mfa-all-users said "leave it On"); mfa-all-users AI Info adds that everyone the corrected policy now includes is asked for MFA at their next sign-in.
- **Evidence:** matrix `uncalled-template` 143 → 23 (`matrix-1.txt`; remaining: guests-mfa 5, service-accounts-trusted-network 8, user-risk-medium 2, shared-devices 8). The plan/step/kind/state/drawn/channels/hold columns were identical before and after on all 490 rows. The only new issue text is 45 preview rows showing the `‹complete target policy›` stand-in in a called script. `c2-ps-render.ts` renders 37 scripts (10 packages × missing/partial/reportOnly/readyToEnforce, less the 3 withheld Enforce): every call carries the target and, outside Create, the policy id; no staging text; `Parser::ParseFile` 0 errors in 37 files (`ps-render.txt`, `ps-parse.txt`; rerun on 7898cb4: `ps-render-2.txt`, `ps-parse-2.txt`). Nothing was executed.
- **Tests:** new `src/content/implementation/stateKeepingCorrection.test.ts` (51): the script body has no staging and writes state only in Create (report-only) and Enforce (enabled); for each correction mode, exactly one call line bound to the target literal and policy id, and the call follows the whole function body; Entra/AI carry no staging wording and do carry the save effect; Create/Observe calls; Enforce drawn only where no readiness switch is needed; a target short of the whole policy withholds only the script.
- **Changed pins (disclosed):** mfaAuthContentSpecs (auth-transfer, device-code verify lines; then mfa-all-users and admins verify lines) and sessionAdminContentSpecs (admin-session verify line; legacy-auth step 2, verify lines and AI text). Each asserted the removed "report-only first"/"leave it On" wording and now asserts the replacement, with a comment.

### C05 passkey (review queue 4): FIXED (projection); Authenticator/TAP stay unresolved
- **Cause:** 20/20 renders `held:packageFault`. `json.fido2` had no method/endpoint; `json.authenticator`/`json.tap` bind values no source holds. project.ts refuses a PATCH whose endpoint carries no `{binding}`. With JSON the only value-bearing channel withheld, project.ts withheld Entra and AI too.
- **Fix:** `json.fido2` is `PATCH https://graph.microsoft.com/v1.0/policies/authenticationMethodsPolicy/authenticationMethodConfigurations/fido2` (Microsoft Learn, fido2authenticationmethodconfiguration-update: that request line; `@odata.type` required; the pinned passkeyTarget already carries it). project.ts `FIXED_IDENTITY` accepts a change request only under `…/policies/authenticationMethodsPolicy/authenticationMethodConfigurations/<id>`, Microsoft's fixed method id; every other PATCH/PUT/DELETE still has to name its target. The JSON projection is FIDO2 alone. No Authenticator or TAP body was invented, and those blocks stay unprojected. `Apply` (writes all three, throws without the two missing bodies) is declared withheld with that reason; `Verify` is called. The AAGUID allow list and attestation are unchanged.
- **Existing keys (Microsoft Learn, how-to-enable-passkey-fido2):** "Key restrictions set the usability of specific models or providers for both registration and authentication. If you change key restrictions and remove an AAGUID that you previously allowed, users who previously registered an allowed method can no longer use it for sign-in." and "Users who register a passkey (FIDO2) without attestation aren't blocked from sign-in if Enforce attestation is set to Yes later." Entra step 4/5 and AI Info now say this.
- **Drawn channels:** the step draws Entra and AI Info. PowerShell/JSON are drawn on Conditional Access policy steps only (stepBody.ts `machine = cs.kind === 'policy'`, RUN-CONTEXT-B decision 12 / U15, unchanged), so the FIDO2 request is projected and tested but not drawn as a tab. 74ad604 added an Entra line naming "the JSON tab"; 58915aa removed it.
- **Evidence:** matrix packageFault 20 → 0; the only changed rows are the 20 passkey renders, now `executable portal:+ ai:+` (`matrix-2.txt`).
- **Tests:** new `passkeyProjection.test.ts`: request and body equal to the pin (restriction included), no invented bodies, no degraded channel, the existing-key sentences present, Apply withheld and Verify called. Negative control: a Conditional Access PATCH with the id removed, and a look-alike authenticationMethodConfigurations path under another root, are still refused, beside a positive twin that projects. prereqContentSpecs passkey pin updated for the two added sentences.

### Gap 4: below-floor report-only own policy (review queue 5): FIXED
- **Cause:** coverage.ts counted a report-only candidate's people only at the floor (`strongPop`), so below the floor nothing was recorded, status read `absent`, and generate created a duplicate.
- **Fix:** such a candidate now gives the same `weaker-control`/`session-weaker` reason an enforced weak policy gives, and that reason makes the goal `partial`. Its people are not added to report-only coverage, which would add a `state` section and switch the policy on with an untested grant.
- **After** (`gap4-after.txt`): coverage partial, reasons [weaker-control], step adjust, one update of Policy W with body keys [grantControls], changes [Grant controls], next action `correct` (blocked by that fixture's prerequisites).
- **Tests:** `src/roadmap/reportOnlyBelowFloor.test.ts` (3): the grant-only update equals the grant written for the enforced weak policy; control: a report-only policy at the floor gets no grant correction and no create; control: the enforced weak policy is still corrected by grant with no state change. The first run of this file failed because the test assumed Microsoft's built-in strength id, while the product writes the baseline-resolved strength (`004c4b41…`). The assertion was corrected to compare with the enforced correction's grant (`gap4-test-1.txt` fail, `gap4-test-2.txt` 3/3). Matrix: 0 rows changed (`matrix-3.txt`).

### Export state vs blocked action (review queue 7): REPRODUCED, NOT FIXED
- The cycle 1 review counted 114 using `stepExportView(step, ctx)` with no lane. The Export page passes the board's lane (Export.tsx `laneOf`). `c2-export-lane.ts` reads it the Export page's way over 9 curated fixtures: of 107 policy steps with operations, **45** export a "Ready · …" state while `nextSafeAction` is not executable with a `blockedBy` (e.g. demo s-goal-block-legacy-auth "Ready · Correct", blockedBy `missing-object`; getiamai s-goal-admin-session "Ready · Create", blockedBy `blocked`). With no lane the count is also 45, so the board lane itself reads Ready. The state comes from the lane engine (planLanes.ts), the one state authority for every surface; see BLOCKED.

### Verification (exact code states)
| Check | Command | Code state | Exit | Result |
|---|---|---|---|---|
| Label tests | `node --test --test-isolation=none` contentReview, riskDeviceCampaignContentSpecs, stepSnapshots | e208d3d tree | 0 | 21/21 (`label-tests.txt`) |
| Implementation + surfaces | `node --test --test-isolation=none src/content/implementation/*.test.ts src/testing/stepSnapshots.test.ts src/ui/surfaces/*.test.ts` | 7ed4caf tree before the pin edits | 1 | 680 tests, 676 pass, 4 fail: the four staging-text pins (`impl-1.txt`); then the two spec files 10/10 (`specs-2.txt`) |
| New C02 test | stateKeepingCorrection.test.ts | 7ed4caf tree | 0 | 51/51 (`statekeep-1.txt`) |
| Typecheck | `npx tsc --noEmit` | 7ed4caf; 74ad604 tree (after one fix); 3211c4b tree | 0; 1 then 0; 0 | `tsc-1.txt`; `tsc-2.txt` (state-name types in the new test) → `tsc-3.txt`; `tsc-4.txt`, `tsc-5.txt` |
| Full suite | `npm test` | 7ed4caf tree | 0 | 2653 tests · 2651 pass · 0 fail · 2 skipped (`full-1.txt`) |
| Full suite | `npm test` | 74ad604 tree | 0 | 2656 · 2654 pass · 0 fail · 2 skipped (`full-2.txt`) |
| Full suite | `npm test` | 3211c4b source with the first gap-4 test assertion | 1 | 2659 · 2656 pass · **1 fail** (the wrong strength-id assertion) · 2 skipped (`full-3.txt`) |
| Full suite | `npm test` | **7898cb4** | 0 | **2659 tests · 2657 pass · 0 fail · 0 cancelled · 2 skipped** (Learn-link external health; HUGE=1) (`full-4.txt`) |
| Coverage + roadmap | `node --test --test-isolation=none "src/coverage/**/*.test.ts" "src/roadmap/**/*.test.ts"` | 3211c4b source before its test | 0 | 884 · 883 pass · 0 fail · 1 skipped (`cov-roadmap-1.txt`) |
| Build | `npm run build` | 3211c4b source; 7898cb4 | 0; 0 | pre-existing chunk-size warning (`build-1.txt`, `build-2.txt`) |
| Matrix | `node docs/preview-corrections/probes/s3-matrix.ts curated all` | 7ed4caf; 74ad604; 3211c4b; 7898cb4 | 0 ×4 | 490 renders; uncalled 143→23; packageFault 20→0; 0 empty tabs; 7898cb4 identical to 3211c4b (`matrix-1..4.txt`) |
| PowerShell parse | `c2-ps-render.ts` + `Parser::ParseFile` (parse only) | 7ed4caf; 7898cb4 | 0; 0 | 37 files, 0 errors, no staging (`ps-parse.txt`, `ps-parse-2.txt`) |
| Acceptance | `node <copy>/docs/preview-continuation/acceptance/run-acceptance.mjs <copy> ../logs/c2/acceptance-<sha>`, `<copy>` = `git archive` of the commit, harness identical by `cmp` | 7ed4caf; **7898cb4** | 0; 0 | 28 PASS · 0 FAIL · 0 HARNESS_ERROR each (`acceptance-1.txt`, `acceptance-2.txt`) |
| Walk | `TEMP=../cache/tmp node --import ../logs/c1/netblock.mjs scripts/walk.mjs` (preload re-read: localhost only); report `docs/reports/walk-7898cb4.md`, captures `walk/7898cb4/` (gitignored) | 7898cb4 | 0 | 0 P0, 501 P1, 50 P2 (d15428e: 0 P0, 495 P1, 50 P2). Numbered findings compared after stripping numbers, times and dates: the "Prerequisite · In progress" allow-list lines became "Prerequisite · To do" one for one; 6 new P1s, all on the passkey step now that it renders (demo, demo-week2, mock-operator): the AAGUID step as one sentence over 25 words (fixed in a409b3c), and "the lead "Then configure the supporting methods:" has nothing listed under it" (open, BLOCKED) (`walk.txt`) |
| Walk | same | **a409b3c** | 0 | **0 P0, 498 P1, 50 P2**; first load 4.6 s throttled (P1, as before); against 7898cb4 exactly 3 lines differ, all removed (the three long-sentence passkey P1s) (`walk-2.txt`, `docs/reports/walk-a409b3c.md`) |
| Full suite | `npm test` | **a409b3c** | 0 | **2659 tests · 2657 pass · 0 fail · 0 cancelled · 2 skipped** (same two) (`full-5.txt`) |
| Implementation + surfaces + snapshots | `node --test --test-isolation=none src/content/implementation/*.test.ts src/ui/surfaces/*.test.ts src/testing/*.test.ts` | a409b3c tree | 0 | 749/749 (`stepmd-tests-1.txt`) |
| Matrix | `s3-matrix.ts curated all` | **a409b3c** | 0 | 490 renders, packageFault 0, uncalled 23, 0 empty tabs, identical to 7898cb4 (`matrix-5.txt`) |
| Build | `npm run build` | **a409b3c** | 0 | chunk-size warning only (`build-3.txt`) |
| Acceptance | same harness, `<copy>` = `git archive a409b3c9` | **a409b3c** | 0 | **28 PASS · 0 FAIL · 0 HARNESS_ERROR** (`acceptance-3.txt`) |
| PowerShell parse | not rerun after 7898cb4 | | | a409b3c changed no script body (Entra/AI/troubleshooting text and one passkey Entra line only) |

### Not done in cycle 2 (actionable; see BLOCKED)
1. Export/board lane reads Ready while the next safe action is blocked (45 policy steps).
2. The remaining 23 uncalled scripts: guests-mfa (`-TargetPoliciesJson`), service-accounts-trusted-network, user-risk-medium, shared-devices.
3. Undisclosed removal of a tenant guest exclusion and replacement of a tenant application exclusion on all-users corrections; `conditions.users` PATCH semantics not settled from Microsoft documentation.
4. session-lifetime unmanaged member and `excludeUsers` binding; register-info-protected `policy.target.mode`.
5. Verification: worker end-to-end uncertainty propagation (mocked fetch).
6. Missing tests named by the review: `grantExceedsFloor` OR multi-control; a lone policy that carries the plan's display name (duplicate name).
7. Passkey Entra lead "Then configure the supporting methods:" reported by the walk as having nothing listed under it (P1; the drawn DOM was not inspected).

STEP.md references in drawn package text: 18 removed in a409b3c (plus the grant-block ones in 7ed4caf); 0 remain.

Working tree at the end of cycle 2: these two docs and the two new probes, committed together below. Nothing else is uncommitted; stash empty.

## Cycle 3 (2026-09-14, from 08:12 MDT)

**Start state**
- HEAD a3d22f3. Stash empty.
- Uncommitted: the cycle 2 fresh review, FINAL-REPORT.md and REVIEW-STATUS.json. They were inspected (docs only, the reviewer's queue) and committed first (7bcf4d3).
- Logs: `../logs/c3/`, outside the clone.
- New probes: `docs/preview-continuation/probes/c3-or-widening.ts` (the review's `rv2-or.ts`, run for both the admins and staff group) and `c3-worker.ts`.
- Scratch, not in the clone: `../scratch/c3-keep-state.mjs`, `c3-keep-state-text.mjs`, `c3-shared-debug.ts`, `c3-shared-ps-render.ts`, `c3-walk-norm.mjs` (the last one unused: wrong report format).

### Commits
| Commit | Scope |
|---|---|
| 7bcf4d3 | docs: cycle 2 fresh review, committed after inspection |
| ffd4787 | R1: a group policy whose OR grant falls short of the floor is widened with the floor grant (generate.ts), orGrantWidening.test.ts, c3-or-widening.ts |
| 9da0ec6 | Immediate effect in every correction channel (4 CONTENT.md), stateKeepingCorrection.test.ts tightened, 3 verify-line pins |
| 6318b9d | walk.mjs: the dangling-lead rule skips the `.authored-break` span |
| fadd5a7 | New finding: eleven more packages' corrections kept an enabled policy's state only after moving it to report-only; now they keep it. keepStateOnCorrection.test.ts; pilot/correctionProjection pins |
| c0e91fe | shared-devices script called with bound values; Enforce withheld |
| 6ed777e | Worker: a config section's reason is redacted in the snapshot; workerReasons.test.ts; c3-worker.ts |

### R1 OR-alternative widening (review 2 queue 1): FIXED
- **Reproduced at a3d22f3** (`r1-repro.txt`, `r1-both.txt`). Grants: "phishing-resistant strength OR compliant device" and "MFA OR compliant device", on the admins group and on the staff group, all enabled.
  - Every case is a `correct`, executable update of `c0100000-…0001` with body keys `[conditions]` only (`includeUsers:["All"]`).
  - Changes `[Users, Target resources]`; the PowerShell target keeps the OR grant.
- **Cause.** Under OR the grant asks no more than the floor, so the policy is correctly the goal's own (C01). Every member of its group is excluded in these fixtures, though, so coverage recorded no `weaker-control` reason (no counted people). `changedSections` derives sections only from reasons, so the widening wrote users only.
- **Fix** (generate.ts, the converse of the existing rule that drops grant/session for a policy that meets the floor):
  - When the chosen own policy does not meet the floor, the update also writes the goal's grant, or its session for a session goal.
  - This follows gap 4's reading (correct the grant in place), not C01's (these grants ask no more than the floor).
- **After** (`r1-after.txt`), all four shapes:
  - body keys `[grantControls, conditions]`, changes `[Grant controls, Users, Target resources]`;
  - PowerShell target grant `{"builtInControls":["mfa"],"operator":"OR",…}`;
  - export line "Grant → Require multifactor authentication".
- **Effect on an enabled policy (disclosed):** the correction replaces the compliant-device alternative with the goal's MFA grant for everyone the widened policy includes. It is listed as "Grant controls", and the lead says the changes apply as soon as the policy is saved.
- **Tests** (`orGrantWidening.test.ts`, 11/11, `r1-test-3.txt`):
  - Both OR shapes × admins/staff × both orders: update body, grant equal to the goal's create grant, listed change, the PowerShell `-TargetPolicyJson` grant equal to the body, `-PolicyId`, and the export line.
  - Controls: a plain MFA staff policy gets no grant change; strength AND compliant device is still not own (C01).
  - `grantExceedsFloor` OR unit cases (the review's missing test).
  - The first two runs failed on the test's own mistakes (`r1-test-1.txt`, `r1-test-2.txt`): it used a plain MFA policy's update, which has no grant, as the grant reference, and it ran without Ready readiness, so the export was withheld.
- Roadmap + coverage suites: 898 tests · 897 pass · 0 fail · 1 skipped (`cov-roadmap-1.txt`). Targeted policyIdentity, reportOnlyBelowFloor, tracking.drift: 42/42 (`r1-targeted-1.txt`).

### Immediate effect in every correction channel (queue 4): FIXED
- The Entra `entra.correct-verify` line of admin-session, block-auth-transfer and block-device-code now reads "Save. Leave **Enable policy** as it is: if the policy is On, these changes apply to sign-ins as soon as you save." This is the admins-phishing-resistant precedent.
- AI Info `ai.correct` of admin-session, block-auth-transfer and admins-phishing-resistant gains a paragraph that the policy keeps its state and what saving does. Examples: exclusions-group members leave the session limit, or can use authentication transfer again; a newly included admin must use a method the strength accepts.
- **Test tightened** (`stateKeepingCorrection.test.ts`):
  - The old check accepted "Leave **Enable policy** as it is" alone and never read AI Info.
  - Both Entra and AI Info must now match `if (it|the policy) is On, … as soon as (you save|it is saved)|saving applies it at once`.
  - It covers the ten cycle 2 packages plus mfa-all-users and admins-phishing-resistant, × CorrectConditions/Grant/Session, with a negative control.
  - The first run had 15 failures (`impl-1.txt`). 12 were the regex's own case sensitivity and mfa-all-users' "saving applies it at once"; 3 were the verify-line pins below.
- **Pins changed (disclosed):** mfaAuthContentSpecs (block-auth-transfer and block-device-code verify lists) and sessionAdminContentSpecs (admin-session verify list). Each asserted the effect-less line and now asserts the new one, with a comment.
- Not changed: the export/Contract lead stays generic on a group → All users widening. The changes list now names the grant, and mfa-all-users AI Info names who is asked.

### New finding: eleven packages returned an enabled policy to report-only on correction: FIXED (one package remains)
- **Found:** a scan of every META Partial projection for report-only modules.
- **Affected:** device-registration-mfa, intune-enrollment-reauth, pim-activation-reauth, service-accounts-trusted-network, session-lifetime (browser and unmanaged members), sign-in-risk, sign-in-risk-medium, token-protection, user-risk, user-risk-medium and shared-devices.
- **What they did:** each projected a module selected whenever `policy.current.state` was `enabled` (`alongside: true`). Beside every correction it drew:
  - "Set Enable policy to Report-only while correcting" (or similar);
  - a `{"state":"enabledForReportingButNotEnforced"}` PATCH;
  - a `ReportOnly` script run.
- **Why nothing showed it:** no curated fixture renders a correction of these packages (matrix rows are missing/blocked/readyToEnforce). `pilot.test.ts` pinned the behaviour ("A live policy being corrected goes back to report-only alongside the correction").
- **Fix:**
  - The module is removed from each Partial projection by text removal. Each META keeps its bytes and formatting, and is checked to parse to the original minus that member.
  - A first JSON re-serialisation reformatted token-protection (+414 lines). Those 11 META files, touched only by that transform, were restored from HEAD and redone by text.
  - The shared save/verify Entra block states the effect ("Keep the policy's current state: if it is On, the correction applies to sign-ins as soon as you save."), and AI Info says the same.
- **Three more texts the new test found** (`keepstate-test-1.txt`) and corrected:
  - device-registration-mfa AI Info goal "Move the existing resolved policy to the canonical Report-only target" and its target state;
  - pim-activation-reauth open line "keep/return it to Report-only while material mismatches remain";
  - session-lifetime open line "Keep or return a materially incorrect policy to **Report-only** while correcting it".
  - The conditional recovery "If a correction creates unexpected risk, return the same policy to Report-only before further changes" is kept.
- **Left in place, unprojected:** the lifecycle blocks and the scripts' ReportOnly modes (BLOCKED, cleanup).
- **LIBRARY.json** regenerated: `correctionModules` counts only; the library test had failed on the drift (`impl-3.txt`).
- **Test** `keepStateOnCorrection.test.ts` (3/3, `keepstate-test-2.txt`):
  - It reads every registered package's Partial projection for a ReportOnly run, a state-only report-only PATCH, or report-only-while-correcting prose.
  - workload-identity-block is the one named exception, with its reason (its `Correct` throws without ReportOnly). The test fails once that package no longer stages.
  - Controls: a synthetic lifecycle module is caught on all three counts. The recovery sentences are not flagged; "If it is On, return … first" is.
  - Gap found after fadd5a7: the exemption for conditional "If …" sentences treated only "is On" as a default. workload-identity-block's "If the workload policy is currently On … return … to Report-only before changing the allowed address" was therefore not counted; the package was already listed for its other staging.
  - The exemption now also treats "is currently/still On" as a default, with that sentence as a control. Rerun: 3/3, and no other package is flagged (`keepstate-test-3.txt`).
- **Pins changed (disclosed):** `pilot.test.ts` and `correctionProjection.test.ts` asserted the live report-only module. They now assert no lifecycle block, no state in the request, corrections `['Grant']`, and the effect sentence.
- Content suites after the batch: 804 tests · 803 pass · 0 fail · 1 skipped (`impl-4.txt`).

### Uncalled scripts (queue 2): shared-devices FIXED; guests-mfa, service-accounts-trusted-network, user-risk-medium NOT DONE
- **shared-devices:** `powershell.run` is `deployableAfterBinding` with a declared invocation.
  - Create: DisplayName, IncludeUsers, ExcludeGroups, TrustedLocationId.
  - CorrectConditions: those plus PolicyId. CorrectGrant and Verify: PolicyId.
  - `withheldModes.Enforce`: it needs `-TrustedLocationReconfirmed` and `-ReportOnlyEvidenceReviewed`, which no prerequisite attests.
  - `withheldModes.PeopleExclusions`: it reads JSON text IAMAI holds as objects.
  - The script body is unchanged.
- **First attempt failed** (`shared-test-1.txt`). Referencing the withheld PeopleExclusions mode from one Partial module made the compiler withhold the whole Partial PowerShell channel, CorrectConditions included (lint: `shared-lint.txt`). That one module's run was removed instead (META, text removal).
- Lint now lists the 4 pre-existing errors plus the withheld Enforce reference; LIBRARY.json `strictValidationErrors` 4 → 5.
- **Tests:** `sharedDevicesInvocation.test.ts` 4/4 (Create, CorrectConditions and Verify call lines after the whole body; a missing trusted location withholds only the script; Enforce not drawn).
- **PowerShell parse:** Create, CorrectConditions and Verify renders, `Parser::ParseFile` → 0 errors in 3 files. Parse only, nothing executed (`shared-ps-render.txt`, `shared-ps-parse.txt`).
- **Matrix:** `uncalled-template` 23 → 15. The 8 shared-devices rows changed from `ps:+ uncalled-template(mandatory:Mode)` to `ps:-` with `degraded … powershell(policy.target.trustedLocationId)`: those fixtures bind no single trusted location, and Entra/JSON were already degraded for the same value. No other row changed.

### Walk rule vs `.authored-break` (queue 7): FIXED
- walk.mjs skips `.authored-break` spans when looking for what follows a lead ending in ":"; the colon and the list are untouched.
- The walk at c0e91fe removed exactly 4 findings against the review's a3d22f3 walk: the three passkey "Then configure the supporting methods:" P1s, and guests-mfa "Create the two IAMAI-resolved guest policies separately, both Report-o…".
- The guests capture (`walk/c0e91fe/demo/1280/step-31-Require-MFA-for-Guests.txt`, lines 59–62) shows its two list items right after the break, so no real dangling lead is hidden. No finding was added.

### FINDINGS 6 worker end-to-end: VERIFIED; one defect FIXED
- **Probe** `c3-worker.ts` imports the real worker.ts with a synthetic `self` and a per-URL synthetic fetch. No network, no token.
- **First run:** 4 PASS, 3 FAIL (`worker.txt`, `worker-2.txt` with diagnostics).
  - Two failures were wrong probe assumptions. Without P1, users is correctly `partial` ("signInActivity not available on this licence (needs Entra ID P1)"), and a failed methods batch is correctly `partial`.
  - One was a defect: a denied CA policies read naming an address posted that address in `snapshot.config.caPolicies.reason`. The section event was redacted; the snapshot was not. worker.ts's own rule says every reason is redacted before leaving the worker.
- **Fix:** `runConfigTask` stores the redacted reason.
- **After** (`worker-4.txt`, 7 PASS · 0 FAIL, at 6ed777e's tree):
  - every read empty → users partial with the licence reason, devices/authMethods ok;
  - 403 → section `disabled`, reason "Insufficient privileges for upn-1@redacted", config source partial, no posted message carries the address;
  - users page not JSON → users `error`; users page without `value` → `error`;
  - malformed nextLink → caPolicies `error`, rows `[]`;
  - methods batch 500 → authMethods `partial`, no user recorded with a methods entry (asserted non-vacuously);
  - devices 429 × 2 with Retry-After 1 → ok after 3 requests, ≥ 2 s.
- **Regression test:** `src/graph/collect/workerReasons.test.ts`, the real worker, globals restored. Graph suites 54/54 (`graph-1.txt`).
- **Not exercised:** Lane B and the P1-gated sections (the synthetic licence has no P1). Real-login latency is not claimed.

### Verification (exact code states)
| Check | Command | Code state | Exit | Result |
|---|---|---|---|---|
| Typecheck | `npx tsc --noEmit` | ffd4787+9da0ec6 tree; fadd5a7 tree (twice); c0e91fe tree; 6ed777e tree | 0 each | `tsc-1.txt` … `tsc-5.txt` |
| Content suites | `node --test --test-isolation=none src/content/implementation/*.test.ts src/ui/surfaces/*.test.ts src/testing/*.test.ts [src/content/*.test.ts]` | 9da0ec6 tree; fadd5a7 tree; c0e91fe tree | 1 then 0; 1 then 0; 0 | 786/786 (`impl-2.txt`); 803 pass · 1 skipped (`impl-4.txt`, after the LIBRARY drift fail in `impl-3.txt`); 808 pass · 0 fail · 1 skipped (`impl-5.txt`) |
| Full suite | `npm test` | **c0e91fe** | 0 | **2714 tests · 2712 pass · 0 fail · 0 cancelled · 2 skipped** (Learn-link external health; HUGE=1) (`full-1.txt`) |
| Full suite | `npm test` | **6ed777e** | 0 | **2715 tests · 2713 pass · 0 fail · 0 cancelled · 2 skipped** (same two), 08:49–08:52 (`full-2.txt`) |
| Build | `npm run build` | c0e91fe; **6ed777e** | 0; 0 | pre-existing chunk-size warning (`build-1.txt`; `build-2.txt`) |
| Matrix | `node docs/preview-corrections/probes/s3-matrix.ts curated all` | **c0e91fe** (6ed777e changes worker.ts and a test only) | 0 | 490 renders · 0 packageFault · 15 uncalled-template (guests-mfa 5, service-accounts-trusted-network 8, user-risk-medium 2) · 0 empty · 187 preview · 174 executable; against the review's a3d22f3 matrix only the 8 shared-devices rows differ (`matrix-1.txt`) |
| PowerShell parse | render + `Parser::ParseFile` (parse only) | c0e91fe tree | 0 | shared-devices 3 files, 0 errors. No other script body changed in cycle 3; R1 changes target JSON values only, and the eleven keep-state packages' scripts are unchanged |
| Acceptance | `node <copy>/docs/preview-continuation/acceptance/run-acceptance.mjs <copy> ../logs/c3/acceptance-<sha>`, `<copy>` = `git archive` into a new directory, harness identical by `cmp` | c0e91fe; **6ed777e** | 0; 0 | 28 PASS · 0 FAIL · 0 HARNESS_ERROR each (`acceptance-1.txt`, `acceptance-2.txt`) |
| Walk | `TEMP=../cache/tmp node --import ../logs/c1/netblock.mjs scripts/walk.mjs` (preload re-read: localhost only); report `docs/reports/walk-c0e91fe.md`, captures `walk/c0e91fe/` (gitignored) | **c0e91fe** (bundle built before the 6ed777e worker edit; the demo walk does not run the collection worker) | 0 | "show-ready on this walk (no P0)": **0 P0, 494 P1, 50 P2** (review a3d22f3: 0/498/50). Normalized against the review's walk: 4 findings removed (above), none added; first load 4.7 s throttled (P1, as before) (`walk-1.txt`, `walk-norm-*.txt`) |
| Worker probe | `node docs/preview-continuation/probes/c3-worker.ts` | 6ed777e tree | 0 | 7 PASS · 0 FAIL (`worker-4.txt`) |

### Not done in cycle 3 (actionable; see BLOCKED)
1. workload-identity-block still returns an enabled policy to report-only on every material correction (script guard).
2. Board/export lane reads Ready while the next safe action is blocked (45 steps).
3. Remaining 15 uncalled scripts: guests-mfa, service-accounts-trusted-network, user-risk-medium.
4. Removed tenant exclusions not disclosed.
5. session-lifetime and register-info-protected bindings.
6. Low: unprojected lifecycle blocks; same-name create; passkey profiles; Lane B and P1 worker paths not probed.
