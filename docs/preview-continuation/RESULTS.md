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
