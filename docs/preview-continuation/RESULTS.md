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
| dedd58f | docs: cycle 3 RESULTS/BLOCKED checkpoint; keep-state scan counts "is currently On" as a default |
| dfb6274 | workload-identity-block corrections keep an enabled policy's state (the last staging package); `STILL_STAGING` empty |
| cfbee44, 1c7fccb | docs only: RESULTS/BLOCKED updated for dfb6274; BLOCKED evidence for the undisclosed exclusion removal (rv-edge rerun, Graph PATCH reference) |

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

### New finding: twelve packages returned an enabled policy to report-only on correction: FIXED (eleven at fadd5a7, workload-identity-block at dfb6274)
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
- **workload-identity-block (the twelfth): FIXED at dfb6274.**
  - **Before:** every Partial module ran `Correct` with `ReportOnly` and PATCHed `json.correct.report-only`. A lifecycle module and a sharedBefore block ("If it is On, return that same policy to Report-only first") rode along. AI Info asked for "Report-only during material correction", and `Correct` threw without ReportOnly.
  - **Fix:** a checked META text edit inside the Partial region (`../scratch/c3-workload-keep-state-2.mjs`; the first attempt's heredoc broke a backslash and changed nothing). It removes ReportOnly and the report-only JSON ref from the six modules, the lifecycle module and ensure-report-only, and removes the guard line.
  - **Effect statement,** in the save/verify block and AI Info, grounded in Microsoft Learn *Conditional Access for workload identities* ("The policy applies only when a service principal requests a token."; "Access is blocked when a token request is made from outside the allowed range."): if the policy is On, the correction applies to the sync service principal's token requests as soon as it is saved, so confirm the sync server's egress address is in the approved location first.
  - **Left unprojected:** the Location branch and its guard, the ip-ranges text, the lifecycle blocks and the ReportOnly mode (BLOCKED).
  - **Rendered for an enabled policy** (`workload-render.txt`): conditions, grant and both draw `Correct -Corrections 'PolicyConditions'` / `'PolicyGrant'` only. The request carries no state, and Entra has no Report-only instruction and does state the effect. The AI check printed "effect: false" only because the render script's regex was case-sensitive; the registry text was checked separately: effect present, no "return it to Report-only".
  - **PowerShell parse:** 3 files, 0 errors (`workload-ps-parse.txt`).
  - **Tests:** `STILL_STAGING` is now empty. Content suites 809 tests · 808 pass · 0 fail · 1 skipped (`impl-6.txt`); typecheck 0 (`tsc-7.txt`). LIBRARY.json `correctionModules` 7 → 6.

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
| Full suite | `npm test` | **dfb6274** (final code; later commits are docs only) | 0 | **2715 tests · 2713 pass · 0 fail · 0 cancelled · 2 skipped** (same two), 09:00–09:03 (`full-3.txt`) |
| Build | `npm run build` | **dfb6274** | 0 | pre-existing chunk-size warning (`build-3.txt`) |
| Typecheck | `npx tsc --noEmit` | dedd58f tree; dfb6274 tree | 0; 0 | `tsc-6.txt`, `tsc-7.txt` |
| Matrix | `s3-matrix.ts curated all` | **dfb6274** | 0 | 490 renders · 0 packageFault · 15 uncalled · 0 empty; **row-for-row identical to c0e91fe** (0 diff lines). No curated fixture renders a workload-identity-block correction (`matrix-2.txt`) |
| PowerShell parse | render + `Parser::ParseFile` (parse only) | dfb6274 tree | 0 | workload-identity-block Correct (conditions, grant, both): 3 files, 0 errors (`workload-ps-parse.txt`) |
| Acceptance | same harness, `<copy>` = `git archive dfb62744` into a new directory, harness identical by `cmp` | **dfb6274** | 0 | **28 PASS · 0 FAIL · 0 HARNESS_ERROR** (`acceptance-3.txt`) |
| Walk | same walk command and preload; report `docs/reports/walk-1c7fccb.md`, captures `walk/1c7fccb/` (gitignored) | **1c7fccb** (code = dfb6274; tree clean at start), 09:04–09:08 | 0 | "show-ready on this walk (no P0)": **0 P0, 494 P1, 50 P2**. Normalized findings **identical to the c0e91fe walk** (574 lines each, 0 differ) (`walk-2.txt`, `walk-norm-1c7fccb.txt`) |

### Not done in cycle 3 (actionable; see BLOCKED)
1. Board/export lane reads Ready while the next safe action is blocked (45 steps).
2. Remaining 15 uncalled scripts: guests-mfa, service-accounts-trusted-network, user-risk-medium.
3. Removed tenant exclusions not disclosed (evidence refreshed at dfb6274).
4. session-lifetime and register-info-protected bindings.
5. Low: unprojected lifecycle blocks, ReportOnly modes and workload-identity-block's Location guard; same-name create; passkey profiles; Lane B and P1 worker paths not probed.

**Working tree at the end of cycle 3.** This ledger is committed with the final docs commit below, and nothing else is uncommitted; stash empty. Gitignored outputs written this cycle: `docs/reports/walk-c0e91fe.md`, `walk-1c7fccb.md`, `walk/c0e91fe/`, `walk/1c7fccb/` and `dist/`. Outside the clone: `../logs/c3/`, `../scratch/c3-*`, and archive copies `../acc-src-c0e91fe-c3`, `../acc-src-6ed777e-c3`, `../acc-src-dfb6274-c3`. One command was declined: an acceptance copy step that began with `rm -rf` of a directory outside the clone. It was redone into a new directory with no deletion.

## Cycle 4 (2026-09-14, from 09:21 MDT)

**Start state**
- HEAD 3ca3fd1. Stash empty.
- Uncommitted: the cycle 3 fresh review (FINAL-REPORT.md, REVIEW-STATUS.json). Inspected (docs only, the reviewer's queue) and committed first (d62046d). No other unfinished work.
- Logs: `../logs/c4/`, outside the clone. Scratch, not in the clone: `../scratch/c4-lane-diag.ts`, `../scratch/c4-guests-bind.ts`.

### Commits
| Commit | Scope |
|---|---|
| d62046d | docs: cycle 3 fresh review, committed after inspection |
| d03337c | Queue 1: an unstarted policy waiting only on emergency access reads "create it in report-only now" (lifecycle.ts nextMilestone), two content strings, emergencyGateCreate.test.ts |
| ebb9633 | Queue 3: removed tenant exclusions named in the step's portal/export lines (generate.ts `PolicyOperation.removes`, stepPortal.ts), removedExclusions.test.ts. Queue 5: guests-mfa correction saves and AI Info state their effect. Queue 7: orGrantWidening asserts the drawn CorrectGrant call |
| 3e32075, 8b6815f | docs: cycle 4 RESULTS/BLOCKED checkpoints (verification at ebb9633; the export hand-over finding) |
| 2997bb3 | A correction held on emergency access exports its action alone, as the screen shows it (stepExport.ts), heldCorrectionExport.test.ts |

### Board/export Ready vs blocked (review 3 queue 1): 38 of 45 FIXED
- **Reproduced at 3ca3fd1:** `c2-export-lane.ts` → `{"steps":107,"boardReadyBlocked":45}`. `../scratch/c4-lane-diag.ts` classified the 45 (`lane-diag.txt`, `lane-diag-v.txt`):
  - **38**: `blockedBy=blocked`, condition blocked, lifecycle not-deployed, milestone `resolve`, implementation offered, nothing enforcing on run, `policyResult` implementable. Every one has exactly one blocker, the step wait on `s-prereq-break-glass`. Lane Ready · Create.
  - 3 (demo block-legacy-auth, block-device-code, mfa-all-users): enforced drifted policies, `missing-object` on an unmapped source reference (`decision: true`); lane Ready · Correct.
  - 4 report-only (demo-week2 intune-enrollment-reauth, large require-managed-device, messy and midflight admins-phishing-resistant): lane Observing/Correct beside a device-plan or exclusions-group wait, `missing-object` or `escape-hatch-unverified`.
- **Which reading was wrong (the 38):** the lane is right. docs/product/actionability/BLOCKED.md (A1a task 1): "a legacy step blocker to the emergency gate (break-glass / exclusions group) gates `enforce` on a policy (A3 B3; §18.3: exclusions gate enforced CA, never report-only)"; audit B3 asked to "State that the blocker holds enforcement, not report-only creation". nextMilestone mis-read it: holds.ts treats a wait on an unheld step as sequencing, not a hold (Step 4), so the Step 5 held-create branch (lifecycle.ts:314) never saw these steps and they fell to `condition === 'blocked'` → "Clear what this step is waiting on.", which made `implementationIsCurrent` false and the step hand over nothing. A step *held* on a Setup answer already got "Create the policy in report-only now"; the weaker wait got the stricter action.
- **Fix (no new readiness rule):** nextMilestone gives a step that is not held, not deployed, implementation offered, and whose every blocker is an emergency-access foundation (`GATING_SUBJECTS`) the deploy milestone "Create the policy in report-only now; it is not turned on until emergency access is sorted." (or "…on {date}; …" where the schedule places the create), gated by the reason the row shows. `implementationIsCurrent` then reads it current through its existing exception. Waits on anything else are unchanged.
- **After:** lane probe 45 → **7** (`export-lane-1.txt`, at HEAD `export-lane-2.txt`); review parity probe `../logs/review1/rv-parity.ts` 114 → **16** (11 `blocked`, 4 `escape-hatch-unverified`, 1 `readiness-unmet`; `rv-parity-1.txt`, `rv-parity-2.txt`).
- **Effect (disclosed):** 60 matrix rows move from `blocked · preview` to `missing · executable` with identical drawn channels and issues. Each hands over a report-only create; `nextSafeAction.enforceable` stays false. 17 rows move to `missing · preview` and now list the bindings they lack (`missing=`: session-lifetime names/excludeUsers, pim-activation-reauth authContext/strength). 4 rows changed channels, both from a package gap this state now reaches: getiamai guests-mfa (Entra withheld, see BLOCKED) and mid user-risk-medium (PowerShell withheld on `policy.current.id` instead of drawn as an uncalled template). Matrix totals 3ca3fd1 → ebb9633: executable 174 → 238, preview 187 → 123, uncalled-template 15 → 13, degraded 64 → 68, packageFault 0, empty 0 (`matrix-1.txt`, `matrix-classes-1.txt`, `matrix-2.txt`).
- **Tests** (`src/ui/surfaces/emergencyGateCreate.test.ts`): over nine fixtures, every such step has report-only operations, a `deploy` milestone with the new sentence, `create-report-only` executable and not enforceable, lane Ready · Create, a contract and export with no "Clear what this step is waiting on". The first run failed on the test's own bound (18 < 20 over three fixtures) and was widened to the nine fixtures the probe reads, not lowered (`gate-test-1.txt`). Controls: an added maker-step wait still resolves and is not executable; a held gate wait keeps `prepareHeldOther`; a deployed policy does not take the branch.
- **Existing invariant caught a mistake:** foundationB "every step ends in one next thing" failed on the first version's scheduled branch (`gatedBy: null`; `suites-1.txt`). The row still shows the emergency wait, so the milestone now carries it; no test was changed.

### Removed tenant exclusions (review 3 queue 3): FIXED in the step's portal/export lines; Entra/AI package tabs NOT
- **Cause:** the update sends its `users`/`applications` sections whole (the baseline's), so a tenant `excludeGuestsOrExternalUsers` or excluded application not in the baseline is removed on save. The request is the baseline's; nothing said so.
- **Fix:** generate.ts records `removes: { guestsOrExternalUsers, ids }` on the update (only sections the patch writes; request body unchanged). stepPortal.ts adds, above "Change only the settings listed above": "This change removes <names> from the policy's exclusions. If the policy is On, it applies to them as soon as you save." These lines are the screen's, print's and export's.
- **After** (`../logs/review1/rv-edge.ts`, `rv-edge-1.txt`): staffGuestExcl → "This change removes guest or external users from the policy's exclusions…"; staffExclOtherApp and the no-exclusions-group case → "…removes Office 365 Exchange Online…".
- **Tests** (`src/roadmap/removedExclusions.test.ts`, 3): guest exclusion (body still without it, `removes`, line text, above the untouched line); Exchange Online (body carries Intune Enrollment, `removes.ids == [EXO]`, named not an id); control keeping every exclusion removes nothing and draws no line.
- **Not changed:** the viewer's Entra and AI Info tabs are package-authored text with no binding for removed exclusions; the `changes` list is unchanged.
- **Found through the new line (pre-existing, not fixed; BLOCKED first entry):** on the curated demo, s-goal-block-legacy-auth and s-goal-block-device-code (enforced, held on emergency access, action "Clear what this step is waiting on.") export their correction lines anyway, now ending "This change removes Core - Break glass from the policy's exclusions…". At 3ca3fd1 the same lines were drawn without that sentence (`demo-action-curated-1.txt`, `demo-action-curated-3ca3fd1.txt`).
- **Content test (disclosed):** content.test.ts lists `.shared.changeRemoves` and `.shared.changeRemovesGuests` as example-suppressed strings (the review page's example corrects no policy with such an exclusion); the test failed until then (`suites-3.txt`).

### guests-mfa effect statement (review 3 queue 5): FIXED
- `entra.correct-pair` saves 5 and 9: "Save. Leave **Enable policy** as it is: if the policy is On, the exclusions group's members stop being asked for this policy's authentication strength / MFA as soon as you save." `ai.correct`: "Each policy keeps its current state: if it is On, adding the exclusions group exempts that group's members from the policy as soon as it is saved."
- Registry regenerated with `node scripts/compile-implementation-content.mjs --registry src/content/implementation/registry.generated.json`: 2 lines changed, the two block texts (`registry-1.txt`).
- Test: stateKeepingCorrection.test.ts reads the compiled blocks (the pair's script is not called, so no bound projection) and requires `EFFECT` on both saves and AI Info; 89/89 (`statekeep-1.txt`).
- **Pin changed (disclosed):** mfaAuthContentSpecs.test.ts guests list items 5 and 9 asserted "Save." and now assert the effect lines, with a comment.

### Test gaps (review 3 queue 7): CorrectGrant FIXED; pim-activation-reauth edge NOT DONE
- orGrantWidening.test.ts now requires exactly the calls `CorrectConditions` and `CorrectGrant`, each ending `-PolicyId '<id>'`, and parses the CorrectGrant call's target grant against the body; 11/11 (`or-test-1.txt`).

### Verification (exact code states)
| Check | Command | Code state | Exit | Result |
|---|---|---|---|---|
| Typecheck | `npx tsc --noEmit` | d03337c tree before the gatedBy fix; batch 2 tree; ebb9633 tree less the generate.ts comment restore | 0; 0; 0 | `tsc-1.txt`, `tsc-2.txt`, `tsc-3.txt` |
| Targeted | planTruth, planLanesHolds, policyStep, packageState, correctionProjection, holds, nextSafeAction | first d03337c draft | 0 | 63/63 (`targeted-1.txt`) |
| Suites | `node --test --test-isolation=none "src/ui/surfaces/*.test.ts" "src/testing/*.test.ts" "src/content/*.test.ts" "src/roadmap/*.test.ts"` | first draft; **d03337c** | 1; 0 | 1342 · 1338 pass · 2 fail (foundationB gatedBy, new test's bound) · 2 skipped (`suites-1.txt`); 1342 · 1340 pass · 0 fail · 2 skipped (`suites-2.txt`) |
| Suites | same plus `src/content/implementation/*.test.ts` | batch 2 before the two test updates | 1 | 1544 · 1540 pass · 2 fail (orphan content strings; guests pin) · 2 skipped (`suites-3.txt`) |
| Full suite | `npm test` | ebb9633 less a comment-only restore in generate.ts | 0 | 2721 · 2719 pass · 0 fail · 0 cancelled · 2 skipped (`full-1.txt`) |
| Full suite | `npm test` | **ebb9633** (clean tree) | 0 | **2721 tests · 2719 pass · 0 fail · 0 cancelled · 2 skipped** (Learn-link external health; HUGE=1) (`full-2.txt`) |
| Build | `npm run build` | batch 2 tree before the comment restore; **ebb9633** | 0; see walk row | chunk-size warning only (`build-1.txt`; `build-2.txt`) |
| Matrix | `node docs/preview-corrections/probes/s3-matrix.ts curated all` | batch 2 tree; **ebb9633** | 0; 0 | 490 rows, identical to each other (0 diff lines); against cycle 3's `c3/matrix-2.txt` 81 rows changed, all classified above (`matrix-1.txt`, `matrix-classes-1.txt`, `matrix-2.txt`) |
| Lane / parity probes | `c2-export-lane.ts`; `../logs/review1/rv-parity.ts` | d03337c; **ebb9633** | 0 | 45 → 7; 114 → 16 (`export-lane-1/2.txt`, `rv-parity-1/2.txt`) |
| PowerShell parse | not rerun | | | no script body changed in cycle 4 (guests-mfa Entra/AI Markdown only) |
| Acceptance | `node <copy>/docs/preview-continuation/acceptance/run-acceptance.mjs <copy> ../logs/c4/acceptance-ebb9633`, `<copy>` = `../acc-src-ebb9633-c4` (`git archive ebb9633c` into a new directory, harness identical by `cmp`) | **ebb9633** | 0 | **28 PASS · 0 FAIL · 0 HARNESS_ERROR** (`acceptance-1.txt`) |
| Walk | `TEMP=../cache/tmp node --import ../logs/c1/netblock.mjs scripts/walk.mjs` after `npm run build` (build exit 0), 09:54–09:58; report `docs/reports/walk-ebb9633.md`, captures `walk/ebb9633/` (gitignored) | **ebb9633** | 0 | "show-ready on this walk (no P0)": **0 P0, 495 P1, 50 P2** (review 3ca3fd1: 0/494/50); throttled first load 4.6 s (P1, as before). Against the review's report, finding for finding: none removed, **one added**: mock-operator "Require Token Protection on Windows" `button "Troubleshooting" is not in the plan.step contract's allow list`. That step now hands over its report-only create (queue 1), which draws its existing Troubleshooting control; no contract was changed. Normalized stdout: 544 → 545 lines (`walk-1.txt`, `walk-norm-*.txt`, `walk-norm-diff.txt`) |

### Export hand-over under an emergency-access hold (found in cycle 4, pre-existing): FIXED at 2997bb3
- **Found** through the removed-exclusion line (queue 3) on the curated demo, the fixture rv-parity reads (`../scratch/c4-demo-action-curated.ts`, `demo-action-curated-1.txt`):
  - s-goal-block-legacy-auth and s-goal-block-device-code are enforced, lane Ready · Correct, milestone `resolve` gated by "after: Create or Correct Emergency Access Accounts", `implementationOffered` true, `implementationIsCurrent` false, `instructionsHeld` false (`held-lines-1.txt`).
  - Their export drew `open "Core - Block - Legacy authentication"`, the users line and "This change removes Core - Break glass from the policy's exclusions…" under "Clear what this step is waiting on.".
  - At 3ca3fd1 the same lines were drawn without the removal sentence (`demo-action-curated-3ca3fd1.txt`).
  - The screen already drew none of it: stepBody.ts draws channels only while `deployNow = implementationIsCurrent(step)`, and a step with portal lines draws no authored steps. Only the export skipped that gate.
- **First attempt, discarded:** making the shared `instructionsHeld` (stepInstructions.ts) also hold an offered-but-not-current step failed stepFamilies.test.ts's channel-count invariant for large s-goal-require-managed-device (`suites-4.txt`: 2 fail; the test counts portal presence against `implementation.offered`). The change was wider than the defect, so this session's three stepInstructions.ts edits were restored to HEAD (diff shown before restoring) and no test was edited.
- **Fix:** stepExport.ts pushes the portal lines only while the implementation is the step's current action; a held step with portal lines draws nothing else in their place, as on screen.
- **After:** the two steps export only "Clear what this step is waiting on." (`demo-action-curated-3.txt`). Every curated policy step's export (no lane) compared with a copy of ebb9633 (`../exp-src-ebb9633-c4`, `git archive` + node_modules junction; `../scratch/c4-export-diff-2.ts`): **4 of 140 changed**: demo block-legacy-auth 5 → 1 line, demo block-device-code 5 → 1, large intune-enrollment-reauth 9 → 1, large require-managed-device 5 → 2 (its action and a "Before this policy: Intune → … compliance" line, see BLOCKED) (`export-diff-2.txt`).
- **Test** `src/ui/surfaces/heldCorrectionExport.test.ts` (2): both curated demo steps are enforced, offered and not current, and their export equals `["Clear what this step is waiting on."]`. The pre-fix export drew five lines for each (`demo-action-curated-1.txt`), so the assertion is not vacuous. Control: getiamai's due gate-only creates keep an "Entra admin center → …" line.

| Check | Command | Code state | Exit | Result |
|---|---|---|---|---|
| Typecheck | `npx tsc --noEmit` | first attempt; tree identical to **2997bb3** | 0; 0 | `tsc-4.txt`; `tsc-5.txt` |
| Suites | surfaces, testing, content, implementation, roadmap | first attempt; tree identical to **2997bb3** | 1; 0 | 1545 · 1541 pass · 2 fail (stepFamilies channel count ×2) (`suites-4.txt`); **1547 · 1545 pass · 0 fail · 2 skipped** (`suites-5.txt`) |
| Targeted | heldCorrectionExport, emergencyGateCreate, removedExclusions | tree identical to 2997bb3 | 0 | 7/7 (`held-test-1.txt`) |
| Full suite | `npm test`, 10:13–10:16 | tree identical to **2997bb3** (staged, committed unchanged) | 0 | **2723 tests · 2721 pass · 0 fail · 0 cancelled · 2 skipped** (Learn-link external health; HUGE=1) (`full-3.txt`) |
| Matrix | `s3-matrix.ts curated all` | **2997bb3** | 0 | identical to ebb9633 (0 diff lines) (`matrix-3.txt`) |
| Parity | `../logs/review1/rv-parity.ts` | tree identical to 2997bb3 | 0 | unchanged: 11 `blocked`, 4 `escape-hatch-unverified`, 1 `readiness-unmet` (`rv-parity-3.txt`) |
| Acceptance | same harness, `<copy>` = `../acc-src-2997bb3-c4` (`git archive 2997bb3b` into a new directory, harness identical by `cmp`) | **2997bb3** | 0 | **28 PASS · 0 FAIL · 0 HARNESS_ERROR** (`acceptance-2.txt`) |

### Not done in cycle 4 (actionable; see BLOCKED)
0. Residual of the 2997bb3 fix: a held step's export still carries its content "before" lines (large require-managed-device: the Intune compliance setting), which the screen draws only inside the channel strip.
1. Board/export Ready vs blocked: 7 board-lane steps remain (three classes above).
2. Uncalled/withheld scripts: guests-mfa 5, service-accounts-trusted-network 8; user-risk-medium's create now withheld on `policy.current.id`.
3. guests-mfa on getiamai: a single-policy resolution the pair package cannot bind (Entra withheld).
4. Removed exclusions in the viewer's Entra and AI Info tabs.
5. shared-devices people-policy exclusions and the dangling readyToEnforce Enforce reference (queue 4).
6. session-lifetime and register-info-protected bindings; pim-activation-reauth grant+session floor edge.

**Working tree at the end of cycle 4.**
- Commits: d62046d, d03337c, ebb9633, 3e32075, 8b6815f, 2997bb3, and the docs commit carrying this final ledger. Nothing else is uncommitted; stash empty.
- Gitignored outputs written this cycle: `docs/reports/walk-ebb9633.md`, `docs/reports/walk-2997bb3.md`, `walk/ebb9633/`, `walk/2997bb3/`, `dist/`.
- Outside the clone: `../logs/c4/`; `../scratch/c4-lane-diag.ts`, `c4-guests-bind.ts`, `c4-demo-missing.ts`, `c4-demo-action.ts`, `c4-demo-action-curated.ts`, `c4-demo-action-curated-3ca3fd1.ts`, `c4-held-lines.ts`, `c4-export-diff.ts`, `c4-export-diff-2.ts`; archive copies `../acc-src-ebb9633-c4`, `../acc-src-2997bb3-c4` and `../exp-src-ebb9633-c4`.
- `../exp-src-ebb9633-c4/node_modules` is a directory junction to the clone's `node_modules`. Anyone removing that copy must remove the junction itself and not follow it.
- No remote, tenant or external write was made, and no generated script was executed.
## Cycle 5 (2026-09-14, from 10:31 MDT)

**Start state**
- HEAD 2997bb3. Stash empty.
- Uncommitted: the cycle 4 fixer's final ledger (RESULTS.md, BLOCKED.md) and the cycle 4 fresh review (FINAL-REPORT.md, REVIEW-STATUS.json). All four are docs only; inspected and committed first (e0163b0).
- **Correction (review 4 queue 2):** the cycle 4 ledger said "the docs commit carrying this final ledger". No such commit existed at the end of cycle 4; the ledger was uncommitted until e0163b0.
- Logs: `../logs/c5/`, outside the clone. Scratch, not in the clone: `../scratch/c5-n1-diag.ts`, `c5-invocation.mjs`, `c5-ps-render.ts`, `c5-guests-members.ts`, `c5-guests-invocation.mjs`. Archive copies: `../c5-src-e0163b0` (node_modules is a **directory junction** to the clone's; remove the junction itself, never follow it) and `../acc-src-311b8a9-c5`.

### Commits
| Commit | Scope |
|---|---|
| e0163b0 | docs: cycle 4 final ledger and cycle 4 fresh review, committed after inspection |
| 8332f82 | Review 4 N1: a correction held on emergency access is planned on screen, not handed over (stepPackage.ts), three tests |
| 311b8a9 | Review 4 queue 3: user-risk-medium and service-accounts-trusted-network scripts called with IAMAI's values; riskNetworkInvocation.test.ts |
| c4cb5a6 | Review 4 queue 3: the guests pair script called with both targets and both ids (stepPackage.ts `memberBindings` pair JSON, guests META/CONTENT, content.json value label); guestsPairInvocation.test.ts, guestsPairBinding.test.ts |
| d6d1e30 | Review 4 queue 6: the shared-devices JSON is no longer withheld by the requestless people-policy patches block (META); sharedDevicesPeopleJson.test.ts |

### N1 (high): screen handed over a held correction the export withheld: FIXED at 8332f82
- **Reproduced before editing** (`../scratch/c5-n1-diag.ts`, `n1-diag-1.txt`): across the curated and plain fixtures, exactly two steps reach `partial` through stepPackage.ts's "correction owed" branch while their implementation is not current. Both are curated demo, s-goal-block-legacy-auth and s-goal-block-device-code: enforced, `condition` blocked, `nextSafeAction` `{correct, executable:false, blockedBy:"blocked"}`, one step blocker `s-prereq-break-glass`, `removes.ids` = `000f4434…` (Core - Break glass).
- **Cause:** `packageStateOf` returned `partial` for any owed correction "whatever holds the step" (A1a task 6), so the viewer drew an executable CorrectConditions call and PATCH with Copy enabled. `nextSafeAction` and the export (2997bb3) held the same correction.
- **Fix:** while the step waits on an emergency-access foundation (a step blocker on a `GATING_SUBJECTS` step, or `action.escapeHatch`), that branch does not apply. Only the U19 add-only correction (the branch above it) is still handed over. Any other correction falls through to `blocked`, and `plannedPackageStateOf` still plans it as `partial`, so the step shows a non-copyable planning preview. Readiness holds are unchanged (the A3 B3 test still passes).
- **Option chosen:** review 4's option (a), narrowing. docs/product/actionability/BLOCKED.md A1a task 6 had left "owner confirms the reversal or narrows 'safe'" open. RUN-CONTEXT (preserve safety exclusions, align channels) and correction batch 2's own reading ("the Plan releases it only once emergency access is sorted") settle it without a new rule.
- **Matrix:** exactly two rows change, `demo+curated … adjust · partial · executable` → `blocked · preview`, same channels (`matrix-1.diff`).
- **Tests:**
  - heldCorrectionExport.test.ts: screen side on both steps. The correction removes an exclusion, it is not U19, the package state is `blocked`, it is planned as `partial`, `previewNote` is set and channels are still drawn.
  - packageState.test.ts: a removing correction under a gate step blocker, and under the escape hatch, reads `blocked`. Controls: the same correction with nothing holding it is `partial`; an add-only correction under the same wait is `partial`.
  - correctionProjection.test.ts (**pin changed, disclosed**): the A1a task 6 assertion `partial` now reads `blocked`, plus a premise that the step waits on emergency access and that it is still planned. The in-place comment says why.
  - Non-vacuity: the three edited files run against `git archive e0163b0` fail exactly those 3 of 17 tests (`n1-nonvacuity.txt`).
- **Browser (what the walk does and does not show):**
  - The legacy-auth and device-code captures (`demo/1280/step-08…`, `step-09…`, text and PNG) are byte-identical between review 4's 2997bb3 walk and the c4cb5a6 walk.
  - That is expected. The browser demo builds on `fixture('demo')` (src/ui/demoFacts.ts:19), the plain pinned baseline. fixtures/index.ts:791–799 says the curated fixture is "never what the demo gets": the shipped interpretation settles six author groups as unknown, and every policy excluding one is held. On the plain demo both steps were already non-copyable previews (`missing-object`) before and after this fix. The walk's `innerText` capture also records neither Copy's `aria-disabled` nor its tooltip.
  - So the walk does not exercise N1. Review 4's reading of `step-09` (tabs and a Copy control) as the executable hand-over was inaccurate for the browser; a preview draws the same tabs and a disabled Copy. The defect was real on the curated fixture and on any plan whose baseline mappings are answered. On a real tenant that is after the operator answers them in Plan settings, the shape correctionProjection.test.ts builds from the plain demo, now pinned to `blocked`.

### Uncalled scripts (review 4 queue 3): user-risk-medium and service-accounts-trusted-network FIXED at 311b8a9; guests-mfa see below
- **Cause:** both `powershell.run` blocks were `template`s with a mandatory `-Mode` nothing called, and every other parameter defaulted to a `'{{binding}}'` literal. user-risk-medium's create was withheld on `policy.current.id` (a value no create has). `-ExcludeGroupsJson`/`-TrustedLocationsJson` read JSON text while IAMAI holds arrays.
- **Fix** (checked text transform `../scratch/c5-invocation.mjs`; every replacement matched exactly once):
  - `deployableAfterBinding` with a declared invocation.
  - user-risk-medium: Create ← DisplayName, ExcludeGroups; CorrectConditions ← PolicyId, ExcludeGroups; CorrectGrant/CorrectSession/Verify ← PolicyId.
  - service-accounts-trusted-network: the same, plus ServiceAccountsGroupId and TrustedLocations wherever `Conditions`/`AssertCanonical` read them.
  - `[string[]]$ExcludeGroups=@()` and `[string[]]$TrustedLocations=@()` replace the JSON-text parameters; the unused ParseArray is removed.
  - `withheldModes.Enforce` with the reason: `-MfaRegistrationValidated`/hybrid writeback, `-IdentityTypesValidated`/`-WorkflowSourcesValidated`, which no declared prerequisite attests.
  - What Create and the corrections write is unchanged.
- Registry regenerated (`registry-1.txt`); `--library-index`: `strictValidationErrors` 12 → 13 for each package, the withheld Enforce reference, as shared-devices in cycle 3 (`library-1.txt`).
- **Matrix** (`matrix-2.diff`, 10 rows): `uncalled-template` 13 → **5** (guests-mfa only). The 8 service-accounts previews no longer flag uncalled and no longer need ‹policy ID› to create. mid and mid+curated user-risk-medium create now draw PowerShell (`degraded powershell(policy.current.id)` gone). No other row changed.
- **PowerShell parse** (`c5-ps-render.ts`, `Parser::ParseFile`, parse only, nothing executed): 6 files (both packages × Create/CorrectConditions/Verify), 0 errors (`ps-parse.txt`).
- **Tests:** `riskNetworkInvocation.test.ts` (8): no JSON-text parameter or binding default; Create call after the whole body with no policy id, creating in report-only; CorrectConditions and CorrectGrant calls, no state; Verify call; Enforce withheld with its reason and not drawn. The first run failed 2 on the test's own regex (it matched the body's `ConvertTo-Json` and the `-like '{{*'` guard; `impl-1.txt`), narrowed to `$…Json`/ParseArray/`='{{`; 208/208 (`impl-2.txt`). Non-vacuity: 8/8 fail against `git archive e0163b0` (`invocation-nonvacuity.txt`).
- **Comment corrected (disclosed):** highRiskChannels.test.ts said the Medium user-risk script "is an undeclared template"; no assertion changed.

### getiamai guests-mfa single-policy resolution (review 4 queue 4): NOT a product defect on the pinned baseline
- `../scratch/c5-guests-members.ts` (`guests-members-1.txt`): no curated or plain fixture resolves both guests members. Most are In place; demo is blocked with no operations; getiamai (plain and curated) has one create with member key `27a0c25c`, source "IAC - GLOBAL - GRANT - MFA - AllUsers".
- The pinned goal map (`PINNED_GOAL_MAP`, from the Jon Hope pin) maps guests-mfa to exactly `e0fabad3…` and `f25f94e0…`, the package's two members.
- getiamai is a non-demo fixture, and fixtures/index.ts:722–725 builds it on `syntheticBaseline(seed)`, a stand-in with one policy per family and no pinned ids. The single AllUsers-sourced resolution is that stand-in's, so withholding the pair's Entra there (nothing to bind) is the honest reading. No member is invented.

### Guests pair script (review 4 queue 3): FIXED at c4cb5a6
- **Cause:** `powershell.run` was a `template` with mandatory `-Mode` and `-TargetPoliciesJson` (both members' whole targets, each with `role`), and no binding held the pair. The matrix drew it uncalled on 5 rows.
- **Fix:**
  - stepPackage.ts `memberBindings` binds `policies.<family>.targets.json` = `[{role, displayName, conditions, grantControls, sessionControls}]`, the same fields `policy.target.json` carries for a single policy. It is bound only when every declared member resolved whole: no member missing, and no reference still waiting on it (`incompleteFieldsOf` empty).
  - guests META declares it (optional).
  - The block is `deployableAfterBinding`. TargetPoliciesJson is passed in CreateMissing, CorrectPair, Observe, EnforcePair and Verify; StrongPolicyId and MixedPolicyId in all of those but CreateMissing.
  - `withheldModes.ApplyPartnerTrust`: it reads the partner trust patches as JSON text, and IAMAI holds them as objects. The runtime never reaches `partnerTrustRequired` anyway (not a `PackageState`).
  - The script body is unchanged. CorrectPair PATCHes name, conditions, grant and session, never state.
  - content.json value label "both guest policy targets" for the preview stand-in.
- **Effect (disclosed):**
  - No curated or plain fixture resolves both members, so the matrix shows the script withheld or planned, never executable.
  - getiamai and getiamai+curated: PowerShell is now withheld (`degraded powershell(policies.guests.targets.json)`), as Entra and JSON already were there.
  - demo, demo+curated and demo-week2+curated+unanswered (blocked previews): the call is drawn with the ‹both guest policy targets› stand-in.
  - Found while testing: a report-only watch without the pair value draws only an Entra note carrying none of IAMAI's values. project.ts:477–482 does not offer such a note alone, so the projection holds on the pair value, and the planning preview draws Entra, PowerShell and AI Info with Copy withheld and the value named (`../scratch/c5-guests-short-2.ts`, `c5-guests-preview.ts`). Before this change, the uncalled template was not "degraded", so the note was offered as copyable. This is the product's existing rule, now reached; no fixture renders it.
- **Matrix** (`matrix-3.diff`, `matrix-4.diff`): `uncalled-template` 5 → **0**. Only the 5 guests rows changed.
- **PowerShell parse** (`../scratch/c5-guests-ps-render.ts`, `Parser::ParseFile`, parse only): CreateMissing, CorrectPair, Observe and EnforcePair, 4 files, 0 errors (`guests-ps-parse.txt`).
- **Registry/LIBRARY:** regenerated (`registry-2.txt`, `library-2.txt`). Guests `strictValidationErrors` 9 → 10 (the withheld ApplyPartnerTrust reference); the new optional binding is indexed.
- **Tests:**
  - `guestsPairInvocation.test.ts` (4): the CreateMissing call after the whole body, with no ids, creating in report-only; the CorrectPair call with both ids, its branch writing no `state=`; the Observe and EnforcePair calls; the ApplyPartnerTrust reason; without the pair value a create keeps Entra and withholds only the script, and a report-only watch holds on exactly that value and previews all three channels with the stand-in in the call.
  - `guestsPairBinding.test.ts` (3): on getiamai's real guests step, with its create keyed to each pinned member, both members give a two-role JSON equal to the resolved body. Controls: one member, getiamai's own single create, and a waiting reference each bind nothing.
  - First runs: one assertion expected `degraded` for the report-only watch and got a hold (the finding above; the test now asserts the hold and the preview). tsc refused a `partnerTrustRequired` projection call (removed; the reason is asserted instead).
  - Non-vacuity against `git archive e0163b0`: invocation 4/4 fail; binding: the positive case fails, the controls pass (`guests-invocation-nonvacuity.txt`, `guests-binding-nonvacuity.txt`).

### Verification (exact code states)
| Check | Command | Code state | Exit | Result |
|---|---|---|---|---|
| Typecheck | `npx tsc --noEmit` | N1 tree; N1 tree after the test cast fix (= 8332f82) | 1; 0 | TS2352 in the new packageState test (cast via `unknown`) (`tsc-1.txt`); clean (`tsc-2.txt`) |
| Targeted | heldCorrectionExport, packageState, correctionProjection, implementationRegion, stepFamilies, stepSnapshots | tree = 8332f82 | 0 | 46/46 (`n1-targeted-1.txt`) |
| Non-vacuity | the three N1 test files in `git archive e0163b0` (node_modules junction) | e0163b0 source | 1 | 3 of 17 fail, exactly the N1 assertions (`n1-nonvacuity.txt`) |
| Matrix | `node docs/preview-corrections/probes/s3-matrix.ts curated all` | 8332f82 | 0 | vs cycle 4 `c4/matrix-3.txt`: 2 rows (N1) (`matrix-1.txt`, `matrix-1.diff`) |
| Full suite | `npm test`, 10:34–10:40 | **8332f82** | 0 | **2725 tests · 2723 pass · 0 fail · 0 cancelled · 2 skipped** (Learn-link external health; HUGE=1) (`full-1.txt`) |
| Implementation suites | `node --test --test-isolation=none "src/content/implementation/*.test.ts"` | invocation tree, first test regex; fixed regex (= 311b8a9) | 1; 0 | 208 · 206 pass · 2 fail (the test's own regex) (`impl-1.txt`); 208/208 (`impl-2.txt`) |
| Typecheck | same | tree = 311b8a9 | 0 | `tsc-3.txt` |
| Matrix | same | 311b8a9 | 0 | vs 8332f82: 10 rows; `uncalled-template` 13 → 5 (`matrix-2.txt`, `matrix-2.diff`) |
| PowerShell parse | `../scratch/c5-ps-render.ts` + `Parser::ParseFile` (parse only) | 311b8a9 | 0 | 6 files, 0 errors (`ps-render.txt`, `ps-parse.txt`) |
| Non-vacuity | riskNetworkInvocation.test.ts in the e0163b0 archive | e0163b0 source | 1 | 8/8 fail (`invocation-nonvacuity.txt`) |
| Full suite | `npm test`, 10:42–10:47 | **311b8a9** | 0 | **2733 tests · 2731 pass · 0 fail · 0 cancelled · 2 skipped** (same two) (`full-2.txt`) |
| Acceptance | `node <copy>/docs/preview-continuation/acceptance/run-acceptance.mjs <copy> ../logs/c5/acceptance-311b8a9`, `<copy>` = `../acc-src-311b8a9-c5` (`git archive 311b8a9d` into a new directory, harness identical by `cmp`) | **311b8a9** | 0 | **28 PASS · 0 FAIL · 0 HARNESS_ERROR** (`acceptance-1.txt`) |
| Typecheck | same | guests tree with the test's `partnerTrustRequired` call; after its removal (= c4cb5a6) | 1; 0 | TS2345 (`tsc-4.txt`); clean (`tsc-5.txt`) |
| Implementation suites | same glob | guests tree, first test; rewritten test (= c4cb5a6) | 1; 0 | 212 · 211 pass · 1 fail (report-only hold, see finding) (`impl-3.txt`); 212/212 (`impl-4.txt`) |
| Surfaces + testing | `node --test --test-isolation=none "src/ui/surfaces/*.test.ts" "src/testing/*.test.ts"` | guests tree before the content.json value label (not exactly c4cb5a6; the full suite below is) | 0 | 603/603, guestsPairBinding 3/3 included (`surfaces-1.txt`) |
| Content | content.test.ts, contentChecks.test.ts | after the value label (= c4cb5a6 content) | 0 | 12/12 (`content-1.txt`) |
| PowerShell parse | `../scratch/c5-guests-ps-render.ts` + `Parser::ParseFile` | c4cb5a6 registry | 0 | 4 files, 0 errors (`guests-ps-render.txt`, `guests-ps-parse.txt`) |
| Non-vacuity | guestsPairInvocation, guestsPairBinding in the e0163b0 archive | e0163b0 source | 1; 1 | 4/4 fail; 1 of 3 fail (the positive case; the controls pass) |
| Matrix | same | **c4cb5a6** | 0 | vs cycle 4: **17 rows** (2 N1, 10 invocation, 5 guests); `uncalled-template` 0, `packageFault` 0 (`matrix-4.txt`, `matrix-3.diff`, `matrix-4.diff`) |
| Lane / parity | `c2-export-lane.ts`; `../logs/review1/rv-parity.ts` | c4cb5a6 | 0; 0 | `{"steps":107,"boardReadyBlocked":7,"noLaneReadyBlocked":7}` (review 4: same); parity 0 diff lines against `c4/rv-parity-3.txt` (`export-lane-1.txt`, `rv-parity-1.txt`) |
| Full suite | `npm test`, 10:55–10:58 | **c4cb5a6** (clean tree) | 0 | **2740 tests · 2738 pass · 0 fail · 0 cancelled · 2 skipped** (Learn-link external health; HUGE=1) (`full-3.txt`) |
| Build | `npm run build` | **c4cb5a6** | 0 | chunk-size warning only (`build-1.txt`) |
| Acceptance | same harness, `<copy>` = `../acc-src-c4cb5a6-c5` (`git archive c4cb5a6a`, harness identical by `cmp`) | **c4cb5a6** | 0 | **28 PASS · 0 FAIL · 0 HARNESS_ERROR** (`acceptance-2.txt`) |
| Walk | `TEMP=../cache/tmp node --import ../logs/c1/netblock.mjs scripts/walk.mjs` after the build row above, 10:58–11:02 (same chain as the full suite); report `docs/reports/walk-c4cb5a6.md`, captures `walk/c4cb5a6/` (gitignored) | **c4cb5a6** | 0 | "Verdict: show-ready on this walk (no P0). **495 P1, 50 P2**." First load 4719 ms throttled (P1, as before). Against review 4's 2997bb3 walk (`../scratch/c5-walk-compare.sh`): report body below the header identical after stripping digits (0 diff lines); normalized stdout 544 → 545 lines, the one added line being "wrote docs\reports\walk-….md", no finding added or removed (`walk-1.txt`, `walk-norm-diff.txt`, `walk-report-diff.txt`) |

### shared-devices people-policy exclusions (review 4 queue 6): JSON FIXED at d6d1e30; script note and Enforce reference NOT DONE
- **Reproduced by direct projection** (`../scratch/c5-shared-people.ts`); no fixture binds a single trusted location, so the matrix could not show it. With every value bound:
  - `missing` without patches: JSON degraded on `peoplePolicies.resolvedPatches`.
  - `missing` with patches, and a users correction with patches: JSON invalid ("json.people-patches: a JSON body with no request (method and endpoint)").
  - The valid create POST and the conditions PATCH were therefore never offered.
- **Cause:** `json.people-patches` is a `referenceOnly` json-template with no request (the patches target several people policies; no single Graph request carries them). It was composed into `missing` beside `json.create` and was the only JSON of the partial `people-policy-exclusions` module.
- **Fix:** both references removed from META.json by checked text removal; the result parses to the original minus exactly those two members. `entra.people-exclusions` stays in both projections, so the people-policy exclusions remain the Entra step that says to make them. Registry regenerated; LIBRARY.json unchanged; withheld count unchanged (5).
- **Matrix** (`matrix-5.diff`): the 8 shared-devices rows drop `peoplePolicies.resolvedPatches` from their JSON degraded list (they stay degraded on the trusted location); no other row changed.
- **Tests:** `sharedDevicesPeopleJson.test.ts` (4): before and after the patches resolve, the create's JSON is `json.create` alone, one POST, no JSON degradation, and Entra keeps `entra.people-exclusions`; a users correction with patches offers exactly the conditions PATCH to the policy id; no projection composes the block. Implementation suite 216/216 (`impl-5.txt`); tsc 0 (`tsc-6.txt`). Non-vacuity: 4/4 fail against `git archive e0163b0` (`shared-people-nonvacuity.txt`).
- **Not done:** the called PowerShell Create does not apply the people-policy exclusions and does not say they are a separate step (the Entra tab does). `readyToEnforce` still names the withheld Enforce run (the lint error disclosed in cycle 3).

| Check | Command | Code state | Exit | Result |
|---|---|---|---|---|
| Matrix | `s3-matrix.ts curated all` | tree = d6d1e30 | 0 | vs c4cb5a6: 8 rows (shared-devices degraded lists only) (`matrix-5.txt`, `matrix-5.diff`) |
| Acceptance | same harness, `<copy>` = `../acc-src-d6d1e30-c5` (`git archive d6d1e309`, harness identical by `cmp`) | **d6d1e30** | 0 | **28 PASS · 0 FAIL · 0 HARNESS_ERROR** (`acceptance-3.txt`) |
| Lane / parity | `c2-export-lane.ts`; `../logs/review1/rv-parity.ts` | d6d1e30 | 0; 0 | `{"steps":107,"boardReadyBlocked":7,"noLaneReadyBlocked":7}`; parity 0 diff lines against `c4/rv-parity-3.txt` (`export-lane-2.txt`, `rv-parity-2.txt`) |
| Full suite | `npm test`, 11:05–11:09 | **d6d1e30** (clean tree) | 0 | **2744 tests · 2742 pass · 0 fail · 0 cancelled · 2 skipped** (same two) (`full-4.txt`) |
| Build | `npm run build` | **d6d1e30** | 0 | chunk-size warning only (`build-2.txt`) |
| Walk | same walk command and preload, after that build, 11:10–11:14; report `docs/reports/walk-d6d1e30.md`, captures `walk/d6d1e30/` (gitignored) | **d6d1e30** (final code) | 0 | "Verdict: show-ready on this walk (no P0). **495 P1, 50 P2**." First load 4614 ms throttled (P1, as before). Against the c4cb5a6 walk (`../scratch/c5-walk-compare-2.sh`): report body identical below the header after stripping digits (0 diff lines); normalized stdout 545 lines each, the only differing line being the report's file name (`walk-2.txt`, `walk-norm-diff-2.txt`, `walk-report-diff-2.txt`) |

### Test edits and scope (this cycle)
- `git diff e0163b0 HEAD -- '*.test.ts'`: no `.skip`, `.only` or todo added. One assert line removed: correctionProjection.test.ts' `packageStateOf … 'partial'` (A1a task 6 pin), replaced by `'blocked'` plus two premise/planned assertions, with an in-place comment. highRiskChannels.test.ts: comment only.
- Files changed since e0163b0: stepPackage.ts; three packages' CONTENT.md (guests also META.json); shared-devices META.json; registry.generated.json; LIBRARY.json; content.json (one value label); eight test files (five new). package.json, lockfile, baselines, .github, vite/tsconfig, data/goals.json, walk.mjs, page-contracts.json and src/feedback.ts are untouched this cycle (walk.mjs last changed in cycle 1, disclosed then).

### Not done in cycle 5 (actionable; see BLOCKED)
1. Removed exclusions in the viewer's Entra and AI Info tabs and in the script/JSON disclosure (review 4 queue 5): needs a binding from `PolicyOperation.removes` and an authored line in each correction package; not started.
2. shared-devices: the JSON is fixed (d6d1e30). Still open: the PowerShell Create path saying the people-policy exclusions are a separate Entra step, and the dangling readyToEnforce Enforce reference (queue 6).
3. Board Ready vs blocked: 7 remain (queue 7), unchanged.
4. Package gaps: session-lifetime, register-info-protected, pim-activation-reauth; the pim grant+session floor test (queue 8).
5. Low: the export "before" line under a hold; unprojected lifecycle/ReportOnly/Location leftovers; same-name create; passkey profiles; worker Lane B/P1 and scoring of a missing methods entry.
6. The guests pair is not rendered end to end by any fixture (no fixture resolves both pinned members); proven by unit and keyed-step tests only.

**Working tree at the end of cycle 5.**
- Commits: e0163b0, 8332f82, 311b8a9, c4cb5a6, d6d1e30 (code; d6d1e30 is the final verified state), f1e121f, 4e4eb8d and the docs commit carrying the d6d1e30 rows (docs only). Nothing else is uncommitted; stash empty.
- Gitignored outputs written this cycle: `dist/`, `docs/reports/walk-c4cb5a6.md`, `docs/reports/walk-d6d1e30.md`, `walk/c4cb5a6/`, `walk/d6d1e30/`.
- Outside the clone: `../logs/c5/` (including `ps/`, the rendered scripts, parsed only); `../scratch/c5-*` and `../scratch/guestsPairInvocation.test.ts` (the draft copied into the clone); archive copies `../c5-src-e0163b0`, `../acc-src-311b8a9-c5`, `../acc-src-c4cb5a6-c5`, `../acc-src-d6d1e30-c5`.
- `../c5-src-e0163b0/node_modules` is a **directory junction** to the clone's `node_modules`, and that copy also holds this cycle's test files for the non-vacuity runs. Anyone removing it must remove the junction itself and not follow it.
- No remote, tenant or external write was made, and no generated script was executed.

## Cycle 6 (2026-09-14, from 11:26 MDT)

**Start state**
- HEAD c3b3f41 (code d6d1e30). Stash empty.
- Uncommitted: the cycle 5 fresh review (FINAL-REPORT.md, REVIEW-STATUS.json), docs only. Inspected and committed first (a6c157a). No other unfinished work.
- Logs: `../logs/c6/`, outside the clone. Scratch, not in the clone: `../scratch/c6-removed-lines.mjs` (the checked transform), `c6-removed-render.ts`, `c6-ps-blocks.mjs`.
- Archive copies:
  - `../c6-src-6d96531`, the pre-batch-2 source. Its `node_modules` is a **directory junction** to the clone's: remove the junction itself, never follow it. It also holds this cycle's two new test files for the non-vacuity runs.
  - `../acc-src-2f8a008-c6` and `../acc-src-ec7bfed-c6`, plain archives for acceptance.

### Commits
| Commit | Scope |
|---|---|
| a6c157a | docs: cycle 5 fresh review, committed after inspection |
| 6d96531 | Review 5 queue 3 (R5-1): guests pair JSON with no request no longer projected. Queue 2: shared-devices Create AI note. Queue 6: N1 comment, report-only pin, partly deployed pair pin |
| 2f8a008 | Review 5 queue 1: removed exclusions named in 25 correction packages' Entra, AI Info and script (stepPackage.ts bindings, checked transform); removedExclusionChannels.test.ts; disclosed pins. New: unmanaged-browser's authored correction keeps state, and its script's unclosed brace is closed; authored-package keep-state scan |
| ec7bfed | AuthoredText: a space before each `<br />` in a list item, so the new line under a Save item is its own sentence in the item's text (the walk had counted 3 long sentences) |

### Queue 1: removed exclusions in the viewer's Entra, AI Info and scripts: FIXED (2f8a008)
- **Reproduced before editing:** the new test run on the tree with only the bindings added failed 3 of 4 (`removed-test-before.txt`). On rv-edge's staff-guest shape, the Entra tab drew "…Save. Leave **Enable policy** as it is…" and "Rescan", with no removal line. The registry check stopped at s-goal-admin-session.
- **Binding** (stepPackage.ts):
  - `removedExclusionNames(op, nameOf)` gives the names from `PolicyOperation.removes`. Guest exclusions use the portal line's own words ("guest or external users"); objects use the plan's name, never an id.
  - It is bound as `policy.current.removedExclusions` when the step has exactly one planned operation.
  - memberBindings binds `policies.<family>.<role>.current.removedExclusions` for each member's own update.
- **Content**, via a checked transform (`../scratch/c6-removed-lines.mjs`):
  - Every insertion had to match exactly once, and every META had to parse; otherwise nothing was written. The first run stopped on s-goal-azure-management-mfa, whose verify block is prose, and wrote nothing (`transform-1.txt`). The rerun covered 25 packages (`transform-2.txt`).
  - Entra: the six packages whose save is a numbered Save item get "This change removes {{…}} from the policy's exclusions. If the policy is On, it applies to them as soon as you save. [omit this line when unavailable]" indented under that item. The guests pair gets it under items 5 and 9, naming each member. The other 18 packages get it as the save block's closing paragraph.
  - AI Info gets the same line as a closing paragraph.
  - Each `powershell.run` gets it as its first comment line.
  - META declares the optional bindings. The registry and LIBRARY.json were regenerated (`registry-4.txt`, `library-1.txt`: 270 → 277 bindings).
- **After** (`removed-render-2.txt`), the rv-edge shapes opened in the viewer:
  - staffGuestExcl: "This change removes guest or external users from the policy's exclusions…" in Entra (inside the Save item), AI Info and the CorrectConditions script.
  - staffExclOtherApp: "…removes Office 365 Exchange Online…" in the same three tabs, named and never an id.
  - JSON is unchanged: a request body carries no prose.
- **Plain demo:** step-07 (MFA for everyone) and step-08 (block device code) now draw "This change removes Break-glass 1 / Core - Break glass from the policy's exclusions…" in their planning previews (`walk/2f8a008/demo/1280/step-07…txt`:61, `step-08…txt`:61). Those corrections do remove that exclusion; before this cycle only the export line said so.
- **PowerShell parse** (`c6-ps-blocks.mjs` + `Parser::ParseFile`, parse only): all 39 registered `powershell.run` blocks were written with the line unbound and bound (a sample name with a quote), for 2f8a008 and for 6d96531. Result: 156 files, 0 errors in each set (`psall-parse.txt`). The two rendered rv-edge scripts also parse with 0 errors (`ps-parse-2.txt`).
- **Tests:** `src/ui/surfaces/removedExclusionChannels.test.ts` (4):
  - the guest shape's line appears in Entra (under the Save item and before Rescan), AI Info and the called CorrectConditions script, and matches the export line;
  - the Exchange Online shape is named, never an id;
  - control: a correction keeping every exclusion draws no line and no `{{` or marker;
  - every registered CA correction package (≥ 24) carries and declares the binding in a drawn Entra, AI Info and PowerShell block of its correction.
  - Non-vacuity: 3 of 4 fail against `../c6-src-6d96531` (the control passes; `nonvacuity-2.txt`).
- **Pins changed (disclosed):**
  - mfaAuthContentSpecs (mfa-all-users, admins, block-auth-transfer and block-device-code Save items; guests items 5 and 9) and sessionAdminContentSpecs (admin-session and block-legacy-auth Save items) now include the optional line in the item.
  - block-device-code's script is asserted to start with the line, then `param(`. It had asserted `^param\(`.
  - block-legacy-auth's exact AI text gains the paragraph.
  - pilot.test.ts and conditionsInvocation.test.ts compare the authored script with its unbound optional line removed, as the projection draws it. pilot adds a premise that the line exists and a check that it is not drawn when nothing is removed.
  - The first full suite after the transform had exactly these 9 failures (`full-1.txt`).

### New finding: s-goal-unmanaged-browser's authored correction staged an enabled policy: FIXED as authored content (2f8a008); never drawn
- **Found** while mapping correction blocks for queue 1. The authored Partial projection:
  - ran `StageA`/`StageB` (PATCH `state` to report-only when enabled) before `CorrectA`/`CorrectB`;
  - `Correct` threw "Refusing correction while policy is On. Stage first.";
  - Entra said "Stage any enabled policy to Report-only before access-affecting correction."
- **Not drawn:** the compiled registry has no `partial` projection for this package, before and after (checked in both registries). The goal is also absent from the pinned baseline (baselineScope.test.ts). cycle 3's keepStateOnCorrection scan read only the registry, and its verb list lacked "stage", so it passed. Its widened form still passed against 6d96531 (`nonvacuity-1.txt`) because the projection is withheld.
- **Fix:**
  - removed the stage runs from META;
  - removed the `Stage` function, its ValidateSet entries and switch arms, and the refusal guard (Correct PATCHes name, conditions, grant and session, never state);
  - Entra: "Keep each policy's current state: if it is On, the corrected restrictions apply to browser sessions as soon as you save.";
  - AI Info states the same.
- **Pre-existing parse error fixed:** the script's final `foreach` never closed its `{` ("Missing closing '}'", in HEAD's copy too; `ub-ps-parse-2.txt`). One brace added; it now parses with 0 errors (`ps-parse-2.txt`).
- **Test** (keepStateOnCorrection.test.ts):
  - It scans every authored package (META plus parsed CONTENT, withheld parts included) for staging runs, state-only report-only PATCHes, staging prose and the refusal guard.
  - The verb list gains "stage", and a prose control is added for this sentence.
  - Against 6d96531 the new test fails on exactly this package: Entra, StageA, StageB and the guard (`nonvacuity-3.txt`). In the tree it passes 4/4 (`keepstate-2.txt`).

### Queue 3 (R5-1): guests pair JSON with no request: FIXED (6d96531)
- `json.target-pair` (missing, partial) and `json.enforce-pair` (readyToEnforce) are removed from the projections; the blocks stay unprojected. Entra, the called script and AI Info carry the pair.
- Test (guestsPairInvocation.test.ts): with every pair value bound, none of the three states has a hold, a JSON degraded entry or a JSON channel, and Entra, PowerShell and AI Info are drawn.
- Matrix at 2f8a008 against cycle 5: exactly 2 rows change, getiamai and getiamai+curated guests, whose degraded list drops the JSON entry (`matrix-1.diff`).

### Queue 2: shared-devices: Create note FIXED (6d96531); Enforce reference kept
- ai.create: "The PowerShell Create writes this one policy only. Excluding these accounts from the person-interactive policies is a separate step, made in Entra for each policy IAMAI identifies."
- `readyToEnforce` still names the withheld Enforce run, as user-risk-medium and service-accounts do (cycle 5): the reason is declared in `withheldModes`. Not changed (BLOCKED).

### Queue 6: N1 follow-ups: FIXED (6d96531)
- stepPackage.ts comment: the lock-out reading applies to an enforced policy. A report-only policy's correction is held because nextSafeAction holds every correction under the wait (review 5 R5-2).
- packageState.test.ts: a report-only policy owing a correction under a break-glass wait reads `blocked`, with nextSafeAction not executable as the premise and an ungated control reading `partial`.
- guestsPairInvocation.test.ts: a partly deployed pair (strong id unbound) withholds only the script, on exactly `policies.guests.strong.current.id`, and Entra is still drawn.
- Not changed: whether nextSafeAction should release a report-only policy's correction under the wait (§18.3; BLOCKED).

### Walk finding from this cycle's change: FIXED (ec7bfed)
- The walk at 2f8a008 had 3 more P1s than cycle 5 (498 against 495): "sentence over 25 words: 'Leave Enable policy as it is: if the policy is On, these changes apply to sign-ins as soon…'" on demo MFA for everyone, demo block device code and mock-operator MFA for everyone (`walk-report-diff.txt`).
- The captures show two lines (step-07 lines 60–61). walk.mjs measures each block's `textContent`, and AuthoredText joined an item's lines with a bare `<br />`, so the item read "…as soon as you save.This change removes…".
- ec7bfed adds a space before each `<br />` in list items. The walk rule is unchanged, and nothing changes on screen.
- Walk at ec7bfed: 495 P1, report identical to cycle 5's after stripping digits, removal line still drawn (`walk-report-diff-2.txt`).

### Verification (exact code states)
| Check | Command | Code state | Exit | Result |
|---|---|---|---|---|
| Targeted | guestsPairInvocation, packageState, sharedDevicesPeopleJson, sharedDevicesInvocation, library | tree = 6d96531 | 0 | 30/30 (`small-tests-1.txt`) |
| Typecheck | `npx tsc --noEmit` | batch 2 tree before the transform; after the transform; 2f8a008 tree; ec7bfed tree | 0 ×4 | `tsc-1.txt` … `tsc-4.txt` |
| Full suite | `npm test` | after the transform, before the pin updates | 1 | 2751 · 2740 pass · **9 fail** (the pins above) · 2 skipped (`full-1.txt`) |
| Full suite | `npm test`, 11:46–11:49 | 2f8a008 less the authored-package keep-state test | 0 | 2751 · 2749 pass · 0 fail · 2 skipped (`full-2.txt`) |
| Full suite | `npm test`, 11:52–11:55 | **2f8a008** (clean tree) | 0 | **2752 tests · 2750 pass · 0 fail · 0 cancelled · 2 skipped** (Learn-link external health; HUGE=1) (`full-3.txt`) |
| Full suite | `npm test`, 12:02–12:05 | **ec7bfed** (final code) | 0 | **2752 tests · 2750 pass · 0 fail · 0 cancelled · 2 skipped** (same two) (`full-4.txt`) |
| Build | `npm run build` | 2f8a008; **ec7bfed** | 0; 0 | chunk-size warning only (`build-1.txt`, `build-2.txt`) |
| Matrix | `node docs/preview-corrections/probes/s3-matrix.ts curated all` | 2f8a008 product code (ec7bfed changes a React component the matrix does not read) | 0 | vs cycle 5 `c5/matrix-5.txt`: 2 rows (getiamai guests JSON degraded entry gone); uncalled-template 0, packageFault 0 (`matrix-1.txt`, `matrix-1.diff`) |
| Lane / parity | `c2-export-lane.ts`; `../logs/review1/rv-parity.ts` | 2f8a008 tree | 0; 0 | `{"steps":107,"boardReadyBlocked":7,"noLaneReadyBlocked":7}` (cycle 5: same); parity 0 diff lines against `c5/rv-parity-2.txt` (`export-lane-1.txt`, `rv-parity-1.diff`) |
| PowerShell parse | `../scratch/c6-ps-blocks.mjs` + `Parser::ParseFile` (parse only) | 2f8a008 and 6d96531 registries | 0 | 39 scripts × unbound/bound × 2 registries = 156 files, 0 errors; unmanaged-browser composite 0 (HEAD's copy 1); rv-edge renders 0 (`psall-parse.txt`, `ps-parse-2.txt`, `ub-ps-parse-2.txt`) |
| Non-vacuity | new tests in `../c6-src-6d96531` (junction) | 6d96531 source | 1; 1 | removedExclusionChannels 3 of 4 fail (`nonvacuity-2.txt`); authored keep-state scan fails on unmanaged-browser only (`nonvacuity-3.txt`). The registry-only keep-state test passes there (`nonvacuity-1.txt`): see the finding |
| Acceptance | `node <copy>/docs/preview-continuation/acceptance/run-acceptance.mjs <copy> ../logs/c6/acceptance-<sha>`, `<copy>` = `git archive` into a new directory, harness identical by `cmp` | 2f8a008; **ec7bfed** | 0; 0 | **28 PASS · 0 FAIL · 0 HARNESS_ERROR** each (`acceptance-1.txt`, `acceptance-2.txt`) |
| Walk | `TEMP=../cache/tmp node --import ../logs/c1/netblock.mjs scripts/walk.mjs` after that commit's build (preload re-read: localhost only); reports `docs/reports/walk-2f8a008.md`, `walk-ec7bfed.md`, captures `walk/<sha>/` (gitignored) | 2f8a008, 11:55–11:59 | 0 | 0 P0, **498 P1**, 50 P2; 3 added long-sentence P1s (above) (`walk-1.txt`, `walk-report-diff.txt`) |
| Walk | same | **ec7bfed**, 12:05–12:09 | 0 | "0 P0, **495 P1**, 50 P2"; report identical to cycle 5's d6d1e30 walk after stripping digits (0 diff lines) (`walk-2.txt`, `walk-report-diff-2.txt`) |

### Test edits and scope (this cycle)
- `git diff a6c157a HEAD -- '*.test.ts'`: no `.skip`, `.only` or todo added. Three assert lines were replaced, each disclosed above: pilot's "carried whole", block-device-code's `^param\(`, and block-legacy-auth's exact AI text.
- Files changed outside package content: stepPackage.ts, StepSections.tsx, registry.generated.json, and nine test files (one new).
- Package content: 25 correction packages (CONTENT/META), unmanaged-browser, guests META, shared-devices CONTENT, and LIBRARY.json.
- Untouched: package.json, lockfile, baselines, .github, vite/tsconfig, data, scripts (walk.mjs included), page-contracts.json, src/feedback.ts and content.json (the Connect notice's `mailto:feedback@getiamai.com` is present).

### Not done in cycle 6 (actionable; see BLOCKED)
1. Board Ready vs blocked: 7 remain; not started.
2. Package gaps: session-lifetime unmanaged displayName and `excludeUsers`, register-info-protected `policy.target.mode`, pim-activation-reauth authContext/strength, and the pim grant+session floor test.
3. Whether a report-only policy's correction should be released under an emergency-access wait (nextSafeAction and screen together).
4. Low: unprojected lifecycle/ReportOnly leftovers (shared-devices' `entra.correct.lifecycle` and `json.report-only` included); same-name create; passkey profiles; worker Lane B/P1; the guests pair not rendered end to end by any fixture.

**Working tree at the end of cycle 6.**
- Commits: a6c157a, 6d96531, 2f8a008, ec7bfed (code; ec7bfed is the final verified state), and the docs commit carrying this ledger and BLOCKED. Nothing else is uncommitted; stash empty.
- Gitignored outputs written this cycle: `dist/`, `docs/reports/walk-2f8a008.md`, `docs/reports/walk-ec7bfed.md`, `walk/2f8a008/`, `walk/ec7bfed/`.
- Outside the clone: `../logs/c6/` (including `ps/` and `psall/`, rendered scripts, parsed only); `../scratch/c6-*`; `../c6-src-6d96531` (node_modules **junction**: remove the junction itself), `../acc-src-2f8a008-c6`, `../acc-src-ec7bfed-c6`.
- No remote, tenant or external write was made, and no generated script was executed.
