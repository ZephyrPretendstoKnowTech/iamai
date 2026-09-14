# Final report: continuation cycle 3, fresh review

**Status: CONTINUE.** Not ready for owner review. This does not authorize publication, merge or deployment. No push, deploy, tenant action, script execution or external write was made.

## Identity
| Item | Value |
|---|---|
| Reviewed HEAD | `3ca3fd1477bb01222e702e9eaf933291ae268a94` (branch preview-continuation) |
| Cycle 3 commits | 7bcf4d3 (cycle 2 review docs), ffd4787, 9da0ec6, 6318b9d, fadd5a7, c0e91fe, 6ed777e, dedd58f, dfb6274, then cfbee44, 1c7fccb, 3ca3fd1 (docs only) |
| Code state | `dfb6274..HEAD` changes only RESULTS.md and BLOCKED.md, so HEAD's code is the fixer's dfb6274 |
| Dirty tree at review start | none (`git status --porcelain` empty); stash empty. No unfinished work to preserve |
| Dirty source entries | none. Reviewer edits are this report and REVIEW-STATUS.json only; nothing committed |
| Logs | `../logs/review3/`, outside the clone. Clean source copy `../rv-src-3ca3fd1` (`git archive 3ca3fd14`, node_modules junctioned, harness byte-identical by `cmp`) |
| Reviewer probes | `../logs/review3/rv3-or-calls.ts`, `rv3-shared-people.ts` (+ `-a3d22f3` copy), `rv3-effect-scan.mjs`; reruns of `../logs/review1/rv-edge.ts`, `rv-parity.ts` and the in-clone probes |

## Checks run by the reviewer (exact code state)
| Check | Command / state | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit` in `../rv-src-3ca3fd1` | exit 0, no output. `--listFilesOnly` shows 586 project files, so it checks real source (`tsc.txt`) |
| Full suite | `node --test --test-isolation=none "src/**/*.test.ts"` in the archive, 09:11–09:14 | exit 0: **2715 tests · 2712 pass · 0 fail · 0 cancelled · 3 skipped**. Skipped: Learn-link external health, HUGE=1, and "the scope script passes on HEAD" (the archive has no git parent; the fixer's in-clone `full-3.txt` at dfb6274 ran it: 2713 pass, 2 skipped). The new tests are in the output and pass: R1 8 + 2 controls + OR unit, keep-state scan 3, shared-devices 4, effect checks 36 + control, worker 7 (`full.txt`) |
| Build | `npm run build` in the archive | exit 0; the chunk-size warning seen in earlier cycles is the only warning (`build.txt`) |
| Acceptance | `run-acceptance.mjs ../rv-src-3ca3fd1` | **28 PASS · 0 FAIL · 0 HARNESS_ERROR**. Per-check statuses equal the fixer's dfb6274 run (`acceptance/results.json`) |
| Matrix | `s3-matrix.ts curated all` in the archive | exit 0, 490 rows, **row-for-row identical to the fixer's `c3/matrix-2.txt`** (the only diff is the fixer's `exit 0` trailer). packageFault 0; `uncalled-template` 15 (guests-mfa 5, service-accounts-trusted-network 8, user-risk-medium 2); `degraded entra(policy.target.mode)` 17; session-lifetime `missing=` still present (`matrix.txt`) |
| Export parity | `rv-parity.ts` (10 fixtures × as-is/all-Ready, 214 steps) | identical to review 2: 114 Ready-but-blocked (109 `blocked`, 4 `escape-hatch-unverified`, 1 `readiness-unmet`), no wrong-target export, no id-less update script (`rv-parity.txt`) |
| Board lane | `c2-export-lane.ts` | `{"steps":107,"boardReadyBlocked":45,"noLaneReadyBlocked":45}`, unchanged (`export-lane.txt`) |
| Worker | `c3-worker.ts` at HEAD | 7 PASS · 0 FAIL. Read: 403 reason "Insufficient privileges for upn-1@redacted"; failed methods batch leaves both users with no methods entry; 429×2 then ok after 3 requests, 2167 ms (`worker.txt`) |
| PowerShell parse | not rerun | no script body changed after the fixer's dfb6274 parse (workload 3 files, shared-devices 3 files, 0 errors) |
| Walk | `TEMP=../cache/tmp node --import ../logs/c1/netblock.mjs scripts/walk.mjs` at HEAD (preload re-read: Node fetch and Chrome host resolution limited to localhost) | exit 0, 09:15–09:19. **0 P0, 494 P1, 50 P2**, "show-ready on this walk (no P0)"; throttled first load 4621 ms (P1, as before). After stripping digits, the 544 `walk:` stdout lines are **identical to the fixer's 1c7fccb walk** (`c3/walk-2.txt`) except the report file name. Report `docs/reports/walk-3ca3fd1.md`, captures `walk/3ca3fd1/` (both gitignored, confirmed by `git check-ignore`) (`walk.txt`) |
| Test edits | `git diff a3d22f3 HEAD -- '*.test.ts'` | no `.skip`/`.only`/todo added. 6 assert lines removed; each has a replacement: the pilot/correctionProjection lifecycle asserts now assert no lifecycle block, no state in the request, `['Grant']`, and the effect sentence; the loose "Leave Enable policy as it is" Entra match is replaced by the stricter `EFFECT` loop over Entra **and** AI Info, with a negative control |
| Scope | `git diff --name-only adae27d HEAD` | package.json, lockfile, baselines, .github, vite/tsconfig, data/goals.json, page-contracts: untouched. `src/feedback.ts`, betaNotice and footer tests unchanged since adae27d, and their notice tests pass |

## Queue verdicts (review 2 queue)

### 1. R1 OR-alternative widening: FIXED (verified in every channel)
- generate.ts:1523 adds the floor grant section when the chosen own policy has `meetsFloor === false` and is not disabled.
- `c3-or-widening.ts` and `rv3-or-calls.ts` at HEAD, "strength OR compliant device" (admins group) and "MFA OR compliant device" (staff group):
  - one update of `c0100000-…0001`, body `[grantControls, conditions]`, changes `[Grant controls, Users, Target resources]`;
  - JSON grant `{"operator":"OR","builtInControls":["mfa"],…}`, no compliantDevice;
  - **PowerShell draws two calls, `CorrectConditions` and `CorrectGrant`, both with `-PolicyId`.** The mfa-all-users script's CorrectConditions PATCHes only `conditions` (CONTENT.md:116) and CorrectGrant only `grantControls` (:117), so both calls are needed, and both are drawn;
  - Entra "select Require multifactor authentication … Remove a non-canonical authentication strength or other grant control"; export "Grant → Require multifactor authentication".
- Control: plain MFA staff policy → conditions only, one call, no grant line. C01 control (strength AND device) → still a create.
- Lone admins (`s5-lone-group-admins.ts`): `create-report-only`, no update, tracking null. A1 tagged/named/untracked unchanged (`a1.txt`).
- **Test gap (low):** orGrantWidening.test.ts reads the target from the first call (`/-TargetPolicyJson '(.*?)' -PolicyId/`) and never asserts that a `CorrectGrant` call is drawn. If the grant module stopped projecting, the target JSON would still carry the grant and the test would pass while the script left the grant unchanged.
- **Edge (low, not probed):** pim-activation-reauth is the only goal whose floor has both a grant and a session (data/goals.json). The rule adds only `grantControls` there, so an own policy short on session with no counted people would get no session section. The rule is additive, so reason-derived sections are unaffected.

### 2. Remaining uncalled scripts: shared-devices FIXED; 15 REMAIN
- shared-devices: Create/CorrectConditions/CorrectGrant/Verify called with bound values; Enforce withheld with its reason; 4 tests pass.
- Matrix: 15 rows (guests-mfa 5, service-accounts-trusted-network 8, user-risk-medium 2).
- **Observation (medium, pre-existing JSON fault, newly visible in PowerShell):** `rv3-shared-people.ts` with `peoplePolicies.resolvedPatches` present:
  - JSON is degraded: `json.people-patches: a JSON body with no request (method and endpoint)`;
  - PowerShell draws `CorrectConditions` only. The `PeopleExclusions` run was removed from the module (c0e91fe), and nothing in the drawn script or `degraded` says the people-policy exclusions are not included;
  - with patches alone, only Entra and AI Info draw.
  - At a3d22f3 the JSON fault was the same and the script was an uncalled template, so no working channel was lost. But the script tab now looks complete while Entra instructs a change the script omits.
- LIBRARY.json `strictValidationErrors` 4 → 5: the new error is `projection.readyToEnforce.powershell: mode Enforce is withheld by its invocation`. The channel is not drawn (tested); the dangling projection reference is cleanup (low).

### 3. Board/export Ready vs blocked: REMAINING (medium-high, unchanged)
45 board-lane steps; 114 no-lane exports in rv-parity (above). Not started in cycle 3.

### 4. Immediate effect in every correction channel: FIXED for the listed packages; one package not covered
- admin-session, block-auth-transfer and block-device-code Entra verify lines, and admin-session, block-auth-transfer and admins-phishing-resistant AI Info, now state the effect.
- `stateKeepingCorrection.test.ts` `EFFECT` requires the effect in Entra and AI Info for 12 packages × 3 corrections (36 tests pass), with a control that the bare "Leave **Enable policy** as it is" fails.
- `rv3-effect-scan.mjs` (static, every package's Partial projection): 24 of 25 packages reference an Entra block and an AI block stating the effect.
- **MISS: s-goal-guests-mfa.** Its `entra.correct-pair` adds the exclusions group to both guest policies and says only "Save." twice. `ai.correct` has no state or effect sentence. The package does not stage report-only, but saving an exclusion on an On guest policy exempts the group at once, and nothing says so. The package's script is also uncalled (queue 2). Pre-existing; review 2 did not list it (medium-low).
- Not changed: the export lead stays generic on a group → All users widening. The changes list names the grant.

### 5. Removed exclusions not disclosed: REMAINING (medium, reproduced)
`rv-edge.ts` at HEAD is identical to the fixer's dfb6274 output:
- "staff group MFA excluding guests": the update's `Users` goes from a value with `excludeGuestsOrExternalUsers` to one without it;
- "staff group MFA excluding Exchange Online": the applications section replaces the tenant's exclusion with Intune Enrollment.
Export, Entra and AI say neither. The Graph update reference, read by the fixer, does not settle nested `conditions.users` merge semantics. The product sends the whole `users` object, so the missing disclosure is the defect.

### 6. Package gaps: REMAINING (medium/low)
session-lifetime `missing=policies.session.unmanaged.target.displayName,policy.target.excludeUsers`; register-info-protected `degraded entra(policy.target.mode)` 17 rows.

### 7. Walk rule vs `.authored-break`: FIXED
walk.mjs `after()` skips only `.authored-break` siblings. The fixer's c0e91fe walk removed exactly the 3 passkey P1s and one guests-mfa lead, and the guests capture shows its list follows the break. The rule still flags a lead followed by nothing or by a non-list element.

### 8. Low items: REMAINING
Same-name report-only create beside a lone plan-named admins policy; whether rv2-gap4 (B)'s `weaker-control` reason is drawn; the passkey portal path under passkey profiles.

### 9. Verification
- Worker end-to-end uncertainty propagation: **VERIFIED** (7/7 at HEAD) and one defect fixed (unredacted snapshot reason, regression test in `workerReasons.test.ts`). Not exercised: Lane B and P1-gated sections; whether scoring reads a missing methods entry as unknown rather than "no methods".
- Real-login latency (C08): not claimed, not verified.

## Cycle 3 finding: twelve packages staged report-only on correction: FIXED
- The fixer's scan found eleven packages (and workload-identity-block) whose Partial projection drew a lifecycle module when the policy was On: "Set Enable policy to Report-only while correcting", a state-only report-only PATCH and a `ReportOnly` run.
- Verified at HEAD:
  - `keepStateOnCorrection.test.ts` scans every registered package's Partial projection (shared blocks, mismatches, modules). It flags ReportOnly runs, state-only PATCH bodies and staging prose. `STILL_STAGING` is empty, and the synthetic-module and prose controls execute.
  - META projection greps for workload-identity-block, session-lifetime and shared-devices: no `lifecycle`, `report-only`, `ReportOnly` or `Location` reference. workload-identity-block draws only `Correct` with `PolicyConditions`/`PolicyGrant`.
  - The workload script's Correct guard is removed (CONTENT.md diff). The Location guard at :360 remains but no Partial module selects it.
  - Effect statements exist for all eleven plus workload (effect scan above). The workload statement names the token-request effect and the egress-address check.
- Enforcement preserved: no projection moves an enabled policy to report-only. Create stays report-only, Enforce keeps its precondition, and recovery "return to Report-only if something goes wrong" sentences remain.
- Unprojected leftovers (lifecycle blocks, ReportOnly modes, workload Location branch): cleanup only.

## Scope and feature preservation
- Tabs and channels: matrix drawn columns identical to the fixer's. Against review 2, only the 8 shared-devices rows changed (`ps:+ uncalled` → `ps:-` degraded on the unbound trusted location; Entra/JSON were already degraded for the same value).
- Baseline: Jon Hope pin untouched. Notice: `src/feedback.ts` and the notice tests unchanged since adae27d; the notice tests pass.
- Enabled-policy state: kept by default in every correction projection; effects stated except guests-mfa.
- Test/pin edits: narrow, each with a comment naming the removed report-only or effect-less wording.
- Working tree after review: ` M docs/preview-continuation/FINAL-REPORT.md`, ` M docs/preview-continuation/REVIEW-STATUS.json` (uncommitted, as REVIEW.md requires); stash empty; HEAD still `3ca3fd14…`. Gitignored outputs written: `docs/reports/walk-3ca3fd1.md`, `walk/3ca3fd1/`, `dist/`. Outside the clone: `../logs/review3/`, `../rv-src-3ca3fd1/`.

## Genuine owner choices
None. Every remaining item is routine under RUN-CONTEXT: broken invocation, channel contradiction, missing disclosure of an immediate effect, invalid binding, missing verification.

## Queue for the next fixer (in order)
1. **Board/export Ready vs blocked (medium-high).** 45 board / 114 no-lane. Classify by `blockedBy` (`blocked`, `missing-object`, `escape-hatch-unverified`, `readiness-unmet`), find whether planLanes or nextSafeAction misreads each, and fix that reading without a new readiness rule. Pin with `c2-export-lane.ts` shapes.
2. **Remaining 15 uncalled scripts (high).** guests-mfa (pair binding or withheld modes with reason), service-accounts-trusted-network, user-risk-medium. Tests read body and call together.
3. **Removed exclusions (medium).** Name a dropped `excludeGuestsOrExternalUsers` and a replaced tenant `excludeApplications` in changes, export, Entra and AI, with the effect on an On policy; pin `rv-edge` staffGuestExcl and staffExclOtherApp.
4. **shared-devices people-policy exclusions (medium).** Give `json.people-patches` its request or withhold it with a stated reason. Make the PowerShell channel either carry the exclusions or say it does not (for example a withheld notice), instead of drawing CorrectConditions alone as if complete. Remove the dangling readyToEnforce Enforce reference (strict error 5).
5. **guests-mfa effect statement (medium-low).** Entra `entra.correct-pair` and `ai.correct`: if a guest policy is On, adding the exclusions group exempts its members as soon as it is saved. Add guests-mfa to the effect test once it projects.
6. **Package gaps (medium/low).** session-lifetime unmanaged displayName and `excludeUsers`; register-info-protected `policy.target.mode`.
7. **Tests (low).** orGrantWidening: assert the drawn `CorrectGrant` call (not only the first call's target). A pim-activation-reauth shape (grant + session floor) short on session with no counted people.
8. **Low.** Same-name report-only create beside a lone plan-named admins policy; rv2-gap4 (B) reason drawing; passkey profiles; unprojected lifecycle/ReportOnly/Location leftovers; worker Lane B/P1 paths and scoring of a missing methods entry.
9. **Verification after changes.** Full suite, typecheck, build, matrix, PowerShell parse of any changed script, acceptance 28/28, walk on the committed state.
