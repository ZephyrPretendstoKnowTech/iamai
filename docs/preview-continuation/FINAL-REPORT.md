# Final report: continuation cycle 4, fresh review

**Status: CONTINUE.** Not ready for owner review. This does not authorize publication, merge or deployment. No push, deploy, tenant action, script execution or external write was made.

## Identity
| Item | Value |
|---|---|
| Reviewed HEAD | `2997bb3bca87e81ad35578f5d50d9d183e5ecf2e` (branch preview-continuation) |
| Cycle 4 commits | d62046d (cycle 3 review docs), d03337c, ebb9633, 3e32075 and 8b6815f (docs), 2997bb3 |
| Code state | HEAD's code is 2997bb3. Source/test diff `d62046d..2997bb3`: 17 files, +431/−12 |
| Dirty tree at review start | ` M docs/preview-continuation/BLOCKED.md`, ` M docs/preview-continuation/RESULTS.md`. These are the fixer's final cycle 4 ledger (docs only), inspected and left untouched. RESULTS.md says "the docs commit carrying this final ledger", but **no such commit exists**; the ledger is uncommitted. Stash empty |
| Dirty source/test entries | none |
| Reviewer edits | this report and REVIEW-STATUS.json only; nothing committed |
| Logs | `../logs/review4/`, outside the clone. Clean source copy `../rv-src-2997bb3` (`git archive 2997bb3b`, node_modules junction to the clone's, acceptance harness byte-identical by `cmp`) |
| Reviewer probes | `../logs/review4/rv4-held.ts`, `rv4-viewer.ts`, `rv4-region.ts`, `pre-c4-test/heldCorrectionExport.pre.test.ts`; reruns of `../logs/review1/rv-edge.ts`, `rv-parity.ts` and the in-clone probes |

## Checks run by the reviewer (exact code state 2997bb3)
| Check | Command / state | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit` in the archive (TypeScript 7.0.2) | exit 0, no output. `--listFilesOnly` lists 560 `src` files (`tsc.txt`, `tsc-2.txt`) |
| Full suite | `node --test --test-isolation=none "src/**/*.test.ts"` in the archive, 10:21–10:25 | exit 0: **2723 tests · 2720 pass · 0 fail · 0 cancelled · 3 skipped**. Skipped: Learn-link external health, HUGE=1, and "the scope script passes on HEAD" (the archive has no git parent). The fixer's in-clone run had 2721 pass / 2 skipped. The new cycle 4 tests are present in the output and pass (`full.txt`) |
| Cycle 4 targeted | heldCorrectionExport, emergencyGateCreate, removedExclusions, orGrantWidening at HEAD | 18/18 (`c4-targeted.txt`) |
| Non-vacuity | heldCorrectionExport.test.ts, imports rewritten to review 3's `../rv-src-3ca3fd1` | **fails** as it should. The pre-cycle-4 export of s-goal-block-legacy-auth draws `open "Core - Block - Legacy authentication"`, the users line and "Change only the settings listed above…" (`held-test-pre-c4.txt`) |
| Build | `npm run build` in the clone (dist gitignored) | exit 0; the only warning is the chunk-size warning seen in earlier cycles (`build.txt`) |
| Acceptance | `run-acceptance.mjs ../rv-src-2997bb3` | **28 PASS · 0 FAIL · 0 HARNESS_ERROR** (H01–H11, R01–R13, B01–B04) (`acceptance/results.md`) |
| Matrix | `s3-matrix.ts curated all` at HEAD | exit 0, **0 diff lines** against the fixer's `c4/matrix-3.txt` (`matrix.txt`, `matrix-vs-fixer.diff`) |
| Board lane | `c2-export-lane.ts` | `boardReadyBlocked` 7 (`export-lane.txt`) |
| Export parity | `rv-parity.ts` | identical to the fixer's `rv-parity-3.txt`: 11 `blocked`, 4 `escape-hatch-unverified`, 1 `readiness-unmet`. No wrong-target export, no id-less update script (`rv-parity.txt`) |
| Removed exclusions | `rv-edge.ts` | Content matches the fixer's `rv-edge-1.txt` (the differences are only line-truncation width). staffExclOtherApp draws "This change removes Office 365 Exchange Online from the policy's exclusions…" above "Change only…" (`rv-edge.txt`) |
| C01 original | `s5-lone-group-admins.ts`; `r2-hold-export.ts` SHAPE=lone/tie/all × REV 0/1 | Lone group-admins: `create-report-only`, no update, tracking null, export "Ready · Create", no admins id. Tie: update of "Policy B", executable. All: blocked `correct`, export action only (`s5-lone.txt`, `hold-export-*.txt`) |
| Walk | build, then `TEMP=../cache/tmp node --import ../logs/c1/netblock.mjs scripts/walk.mjs` in the clone. Preload re-read: only localhost reachable for Node fetch and Chrome host resolution | exit 0: **0 P0, 495 P1, 50 P2**, "show-ready on this walk (no P0)"; throttled first load 4704 ms (P1, as before). After stripping digits, stdout is **identical to the fixer's ebb9633 walk** (544 lines, 0 differ), and the reports differ only in the header. The fixer's own 2997bb3 walk had stopped at demo-week2 with no report; that partial capture was copied to `../logs/review4/fixer-walk-2997bb3-partial/` before rerunning (`walk.txt`, `walk-norm-diff.txt`, `walk-report-diff.txt`; `docs/reports/walk-2997bb3.md` and `walk/2997bb3/`, both gitignored) |
| PowerShell parse | not rerun | No script body changed in cycle 4. `git diff d62046d HEAD -- docs/implementation-content` touches only guests-mfa's Entra and AI Info Markdown |
| Test edits | `git diff d62046d HEAD -- '*.test.ts'` | no `.skip`/`.only`/todo added and no assert line removed. One pin changed (mfaAuthContentSpecs guests saves 5 and 9 → the effect lines), with a comment. content.test.ts adds `.shared.changeRemoves*` to the example-suppressed list, with its reason |
| Scope | `git diff --name-only adae27d HEAD` | package.json, lockfile, baselines, .github, vite/tsconfig and data/goals.json untouched. `src/feedback.ts` unchanged since adae27d. walk.mjs and page-contracts.json last changed in cycle 1 (disclosed); cycle 4 changes neither |

## Queue verdicts (review 3 queue)

### 1. Board/export Ready vs blocked: 38 of 45 FIXED; 7 REMAIN
- lifecycle.ts `nextMilestone`: a not-held, not-deployed, offered step whose every blocker is an emergency-access foundation (`GATING_SUBJECTS`) gets "Create the policy in report-only now; it is not turned on until emergency access is sorted." Waits on anything else are unchanged; the test covers a maker wait, a held gate and a deployed-policy control.
- Reviewer verification (`rv4-held.txt`, `rv4-viewer.txt`), plain fixtures as-is:
  - 81 gated creates. Their drawn PowerShell calls are **only `Create`** (77 calls). Every JSON state is `enabledForReportingButNotEnforced` (66).
  - Across curated and plain fixtures × as-is/all-Ready (185 renders): no gated step has a non-create operation, none excludes no group, none excludes a group absent from the fixture, and no export says "Enable policy: On".
  - An earlier regex flag ("PS writes enabled", 171) matched the script body's Enforce branch, not a drawn call; the call-mode count above settles it.
- Lane probe 7 and rv-parity 16 match the fixer. Remaining classes are as BLOCKED says: 3 demo enforced drifted policies with a pending exclude mapping, and 4 report-only watches.

### 2. Remaining uncalled scripts: REMAIN
Matrix `uncalled-template` 13 (guests-mfa 5, service-accounts-trusted-network 8). user-risk-medium's mid create is withheld on `policy.current.id`, because the param default binds it in every mode. getiamai guests-mfa is a single-policy resolution the pair package cannot bind (Entra withheld). Not started.

### 3. Removed tenant exclusions: FIXED in the step's portal/export lines; REMAIN in the viewer tabs
- generate.ts `removedExclusions` records `removes` only for sections the patch writes, and stepPortal.ts names them above "Change only…". The request body is unchanged.
- The tests assert the body, `removes`, the named line and a no-removal control.
- No curated or plain fixture draws the line on a current step: all 12 updates with `removes` (demo block-legacy-auth, block-device-code, mfa-all-users) are not current. Only the synthetic rv-edge shapes exercise it.
- **Remaining:** the viewer's Entra and AI Info tabs (package text) say nothing about removals, and neither does the drawn script. See N1 for where that matters.

### 4. shared-devices people-policy exclusions and dangling Enforce reference: REMAIN (not started)

### 5. guests-mfa effect statement: FIXED
Both saves and AI Info carry the effect. Registry regenerated (2 texts). stateKeepingCorrection reads the compiled blocks, and the pin was updated with a comment.

### 6. Package gaps: REMAIN
session-lifetime `missing=policies.session.unmanaged.target.displayName,policy.target.excludeUsers` (still in the matrix) and register-info-protected `policy.target.mode`. pim-activation-reauth authContext/strength is now `missing=` on mid's create.

### 7. Tests: CorrectGrant FIXED; pim-activation-reauth grant+session edge REMAINS
orGrantWidening now requires exactly `CorrectConditions` and `CorrectGrant`, each with `-PolicyId`, and compares the CorrectGrant call's grant with the body.

### 8. Low: REMAIN
Same-name create; passkey profiles; unprojected lifecycle/ReportOnly/Location leftovers; worker Lane B/P1 paths and scoring of a missing methods entry; real-login latency not claimed.

## New finding N1 (high): the screen still hands over the held correction the export now withholds
- **Shape:** curated demo (`curatedFixture('demo')`, which the browser demo draws), s-goal-block-legacy-auth and s-goal-block-device-code:
  - lifecycle `enforced`; `implementationIsCurrent` false;
  - `nextSafeAction` `{correct, executable:false, blockedBy:"blocked"}`;
  - Readiness "PREREQUISITE · TO DO Create or Correct Emergency Access Accounts".
- **Screen** (`rv4-viewer.txt`, `rv4-region.txt`):
  - `packageStateOf` = `partial`, `previewNote` null; Entra, PowerShell, JSON and AI Info are drawn.
  - PowerShell calls `Invoke-IAMAIStep -Mode 'CorrectConditions' -TargetPolicyJson … -PolicyId '001e8481-136a-4fc6-87c0-08deaccfec22'`.
  - JSON is a PATCH whose `users.excludeGroups` is only the exclusions group `000f4435…`. It removes the policy's direct exclusion `000f4434…` ("Core - Break glass"; `removes.ids`).
  - No drawn tab says an exclusion is removed; the Entra tab says "confirm the exclusions group … is listed … Leave Enable policy as it is and click Save".
  - Matrix row `demo+curated … adjust · partial · executable`.
  - Browser capture `walk/2997bb3/demo/1280/step-09-Block-Legacy-Authentication.txt` (lines 44–57) and its screenshot show the Implementation region with those tabs and a Copy control.
- **Export** at HEAD: `["Clear what this step is waiting on."]`.
- **Why the fixer's reading is wrong:** 2997bb3's comment and RESULTS say "The screen already drew none of it: stepBody.ts draws channels only while `deployNow`". That holds only for unpackaged steps. stepBody.ts:278–281 uses the package projection's channels whenever `packaged`, whatever `deployNow` says. stepPackage.ts:228 ("A correction owed … projects whatever holds the step") returns `partial` here, because `safeCorrectionOf` (:166) is false once a group is taken out.
- **History:** the screen hand-over is pre-existing (cycle 3 matrix and review 3 matrix have the same `partial · executable` row; the rule is at adae27d stepPackage.ts:228). Before 2997bb3 the export agreed with it. After 2997bb3 the two channels contradict each other, and the dangerous one (an executable, copyable PATCH that drops a direct break-glass exclusion from an On block policy before emergency access is confirmed) is the one still offered. heldCorrectionExport.test.ts pins only the export.
- **Context:** docs/product/actionability/BLOCKED.md:91 (A1a task 6) records that ordering as a reversal of correction batch 2 ("the Plan releases it only once emergency access is sorted"). It is left for the owner to "confirm the reversal or narrow 'safe' (e.g. exclusions-only corrections)".
- **Recommendation (routine under RUN-CONTEXT, which requires preserving safety exclusions and aligning channels):** narrow the :228 branch. A correction that removes an existing exclusion, or otherwise fails U19 `safeCorrectionOf`, does not project an executable `partial` while an emergency-access wait holds the step. It becomes the non-copyable preview, as the export already treats it. The U19 add-only case (:220) stays `partial`.
  - Pin both surfaces on these two steps: screen not executable and export action-only.
  - Control: a U19 add-only correction under the same wait stays executable.
  - Update `correctionProjection.test.ts` narrowly if it pins the reversed order, with a comment.
  - If the fixer concludes the owner must choose, the options are:
    - (a) narrow as above (recommended);
    - (b) keep the :228 reversal and restore the export's lines, adding the removal disclosure to the viewer tabs.
    - Affected outputs either way: the viewer channels, the matrix rows and the export for these steps.

## Other observations
- **Residual export "before" line (low; fixer disclosed):** large s-goal-require-managed-device (curated/plain × as-is/ready: 4 renders) exports "Before this policy: Intune → … Not compliant; … 3 days …" under "Leave it in report-only and watch it.". The screen draws the same Intune prerequisite inside a non-copyable preview, so this is prose parity, not an executable hand-over.
- The 13 offered-but-not-current policy renders all draw channels on screen. Only the 4 renders of N1 (the two steps × as-is/ready) are executable with `previewNote` null. The others (large intune-enrollment-reauth, require-managed-device, curated demo+ready mfa-all-users) carry the preview note.

## Scope and feature preservation
- **Tabs and channels:** matrix identical to the fixer's. Against cycle 3, the 81 changed rows are the fixer's classified gate-create moves (60 `blocked · preview` → `missing · executable`, 17 → `missing · preview`, 4 channel changes from package gaps).
- **Enabled-policy state:** no correction projection moves an enabled policy to report-only; gated creates are report-only only.
- **Notice:** the Connect beta notice and `feedback@getiamai.com` are unchanged (walk: no P0; footer shows the address). The Jon Hope baseline pin is untouched.
- **Tests:** narrow; no suppression added.
- **Working tree after review:**
  - ` M docs/preview-continuation/BLOCKED.md` and ` M docs/preview-continuation/RESULTS.md` (the fixer's, untouched);
  - ` M docs/preview-continuation/FINAL-REPORT.md` and ` M docs/preview-continuation/REVIEW-STATUS.json` (this review, uncommitted as REVIEW.md requires).
  - HEAD is still `2997bb3b…`; stash empty.
  - Gitignored outputs rewritten: `dist/`, `docs/reports/walk-2997bb3.md`, `walk/2997bb3/`.
  - Outside the clone: `../logs/review4/` and `../rv-src-2997bb3/`. Its `node_modules` is a **directory junction** to the clone's; remove the junction itself, never follow it.

## Genuine owner choices
None blocks the queue. N1 touches an open historical item (A1a task 6), but the safe narrowing is supported by RUN-CONTEXT and the existing U19 definition. Options and a recommendation are listed above in case the fixer finds evidence otherwise. Every other item is routine: broken invocation, missing binding, missing disclosure, missing test.

## Queue for the next fixer (in order)
1. **N1 (high).** Stop the executable on-screen hand-over of a held enforced correction that removes an exclusion (stepPackage.ts:228 vs `safeCorrectionOf`). Align screen and export, and pin both on curated demo block-legacy-auth and block-device-code with a U19 add-only control. Re-check the matrix rows and the walk capture.
2. **Commit hygiene.** Inspect and commit the fixer's uncommitted cycle 4 RESULTS/BLOCKED ledger and this review. Correct RESULTS' claim that the ledger was committed.
3. **Uncalled or withheld scripts (high).**
   - guests-mfa (pair binding or withheld modes with reason) and service-accounts-trusted-network.
   - user-risk-medium: a Create call without PolicyId, `[string[]]` or JSON-text exclusions, `withheldModes.Enforce`.
   - Parse any changed script; tests read body and call together.
4. **getiamai guests-mfa single-policy resolution (medium).** Bind the one member or withhold with the pair reason; do not invent the second member.
5. **Removed exclusions in the viewer's Entra and AI Info tabs, and in the script/JSON disclosure (medium).** A binding projected into the correction blocks, pinned with rv-edge's two shapes.
6. **shared-devices people-policy exclusions (medium).** Give `json.people-patches` its request or withhold it with a reason; stop the script tab looking complete; remove the dangling readyToEnforce Enforce reference.
7. **Board Ready vs blocked, 7 remaining (medium).** Per BLOCKED: for the report-only watches, decide whether the action line should name what the watch waits on.
8. **Package gaps (medium/low).** session-lifetime unmanaged displayName/`excludeUsers`; register-info-protected `policy.target.mode`; pim-activation-reauth authContext/strength; the pim grant+session floor test.
9. **Low.** Export "before" line under a hold; unprojected lifecycle/ReportOnly/Location leftovers; same-name create; passkey profiles; worker Lane B/P1 and scoring of a missing methods entry.
10. **Verification after changes.** Full suite, typecheck, build, matrix, PowerShell parse of changed scripts, acceptance 28/28, and a walk that completes and writes its report at the committed state.
