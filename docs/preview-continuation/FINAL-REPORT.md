# Final report: continuation cycle 1, fresh review

**Status: CONTINUE.** Not ready for owner review. This does not authorize publication, merge or deployment. No push, deploy, tenant action or external write was made.

## Identity
| Item | Value |
|---|---|
| Reviewed HEAD | `d15428eaa9c2485e399a2e5676528a0192685d8b` (branch preview-continuation) |
| Continuation commits | 37d32f5 (launcher docs), 6f41c3a, ed76b36, d15428e on adae27d |
| Reviewer edits | None to application code or tests; nothing committed. New files: this report, REVIEW-STATUS.json |
| Logs | `../logs/review1/` (outside the clone). Scratch source copies `../rv-src-d15428e`, `../rv-src-adae27d` (`git archive` of this clone, with node_modules junctioned to the clone's) |
| Walk outputs | `docs/reports/walk-d15428e.md`, `walk/d15428e/`. Both are gitignored and written inside the clone by scripts/walk.mjs |
| Stash | empty |

## Dirty working tree at review (preserved, not touched)
| Path | What it is |
|---|---|
| docs/preview-continuation/BLOCKED.md, RESULTS.md | Fixer's cycle 1 ledger, uncommitted |
| src/ui/surfaces/contentReview.test.ts | **Unfinished work.** Expects `Prerequisite · To do`, but `planBoard.ts:280` still maps Ready to `In progress` |
| src/ui/surfaces/riskDeviceCampaignContentSpecs.test.ts | Same unfinished rename (two regexes) |

These edits fail against the committed source. `node --test --test-isolation=none` on the two files gives 19 tests, 16 pass, **3 fail** (R3 prerequisite label, s-goal-require-managed-device, s-verify-mfa) (`dirty-tests.txt`). 98 files under `docs/qa/step-snapshots` still read `Prerequisite · In progress`. RESULTS.md makes two inaccurate claims:
- "No unfinished work is left uncommitted apart from these docs." Two test files are also uncommitted.
- The walk at d15428e is "pending". That run never wrote a report. The reviewer's run is below.

## Checks run by the reviewer (exact code state)
| Check | Command / state | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit` in `../rv-src-d15428e` (HEAD archive) | exit 0 (`tsc.txt`) |
| Full suite | `node --test --test-isolation=none "src/**/*.test.ts"` in `../rv-src-d15428e` | exit 0: 2602 tests · 2599 pass · 0 fail · 0 cancelled · 3 skipped (184 s). Skipped: the Learn-link external-health test and the HUGE=1 fixture (the fixer's same two), plus "the scope script passes on HEAD", which the archive cannot run because it has no git history. The fixer's in-clone run of the same code (`full-3.txt`) passed it (`full.txt`) |
| Changed test files | policyIdentity, tracking.drift, connectSignedOut at HEAD (clean files) | 45/45 pass. Each new test named in RESULTS ran and passed (`targeted.txt`). Their loops iterate non-empty constant lists |
| Dirty test files | contentReview, riskDeviceCampaignContentSpecs, working tree | 3 fail (above) |
| Acceptance | `run-acceptance.mjs ../acc-src-d15428e` (the harness's 3 hashed sources plus generate.ts and coverage.ts byte-identical to the clone) | **28 PASS · 0 FAIL · 0 HARNESS_ERROR** (`acceptance.txt`) |
| Walk | `node --import ../logs/c1/netblock.mjs scripts/walk.mjs` at HEAD (preload read first: localhost only). 06:52–06:56 | exit 0. **0 P0**, 495 P1, 50 P2; throttled first load 4630 ms (P1). Normalized findings compared with the fixer's ed76b36 walk: exactly 11 lines differ, all removed, all "link feedback@getiamai.com is not in the connect.* allow list". No new finding. The empty-value self-control ran at walk start. The only `@()` in the captures is `$changed=@()` (`walk.txt`) |
| Matrix | `s3-matrix.ts curated all` at HEAD | Row-for-row identical to the fixer's `matrix-2.txt` (diff 0). **143** `uncalled-template` rows; **20/20** passkey `held:packageFault` (`matrix.txt`) |
| PowerShell parse | Parse-only (`Parser::ParseFile`) on the rendered mfa-all-users correction (R1-F3 target) and create scripts; not executed | 0 errors each (`ps-parse.txt`) |
| readGroup probe | `c1-readgroup.ts` with module mocks | 8 PASS · 0 FAIL (`readgroup.txt`) |
| Build | not rerun | Fixer's `build-2.txt` at d15428e: exit 0 |

Reviewer probes: `rv-edge.ts`, `rv-portal.ts`, `rv-parity.ts` (also run against adae27d), `rv-psid.ts`, `rv-ps-dump.ts`. The fixer's `s5-lone-group-admins.ts`, `s1-gap4-reportonly-weak.ts`, `c1-a1-tagged.ts` and `r2-hold-export.ts` (SHAPE all/tie/lone) were rerun at HEAD.

## Queue verdicts
### 1. C01 lone group-assigned admins policy: FIXED (verified)
- Original reproduction at HEAD: `s5-lone-group-admins.ts` gives candidate "Policy A" with ownScope false and step `create-report-only` of "Core - Require - MFA for all users" in report-only. There is no update and tracking is null. In `r2-hold-export SHAPE=lone`, no channel or export carries the admins id.
- Selection is by grant: `strength.ts grantExceedsFloor`, used in `coverage.ts` ownScope. No name or order rule is involved. Shapes covered by executing tests:
  - lone strength policy, group and group+user
  - lone MFA AND compliant device
  - lone MFA with group+role
  - each of those reversed and under two name sets
  - strength policy beside a staff policy: the staff policy is the target
  - two MFA group policies: held
  - lone staff MFA: an executable correction of the staff policy, whose PowerShell names its id
  - All users beside an admins policy
- True tie (`rv-edge tieMfa`): export "On Hold · Not supported" carries the ambiguity text, the contract carries the hold copy, every viewer artifact is unavailable, and previewNote is null.
- Residual (low): a lone admins-group strength policy **named with the plan's own name** gets a report-only create with that same display name (`rv-edge loneNamed`). It is safe, since nothing is updated, but it gives the tenant two policies with one name.
- Missing test: `grantExceedsFloor`'s OR multi-control branch. For example, MFA OR compliant device must stay the goal's own.

### 2. C01/C05 hold consistency and A1 drift
- **R2-N1 held-step Implementation: FIXED.** `stepPackage.ts` plans nothing for `ambiguousTarget`. Across 214 steps with operations in 10 curated fixtures, both as-is and all-Ready, no ambiguous step draws an artifact (`rv-parity.txt`).
- **A1 vacuous assertion: FIXED.** The A1 test now asserts directly: exactly one report-only create, and neither the untracked drifted policy nor another goal's policy is tracked. It runs and passes. The 6 assertion lines removed across the continuation's test diff are all replaced by direct or stronger ones.
- **A1 tagged/named drift duplicate: FIXED.** `c1-a1-tagged.ts` at HEAD: tagged and named give an update of the drifted policy, tracked, `manual-correction`, not executable. Untracked keeps the report-only create.
- **Gap 4, below-floor report-only own policy: REMAINING (high).** `s1-gap4-reportonly-weak.ts` at HEAD: coverage `absent`, candidate `Policy W` reportOnly with ownScope true, reasons `[]`. It still gives a create beside it (`create-report-only`, blocked).

### 3. C02/C06 lifecycle, channels and scripts
- **Correct-step lead: FIXED in the synthetic shapes.** Export: "Correct the existing policy with the changes listed." A create keeps "Create the policy in report-only." **No test pins it**. Curated fixtures do not exercise it: the parity probe finds no mismatch at adae27d either.
- **R1-F3 Intune Enrollment: FIXED.** In the all, tie and lone shapes at HEAD, portal, PowerShell, JSON, AI and export all carry the exclusion. The rendered PowerShell target includes `d4ebce55…` and parses. The Admin Portal goal, the other pinned policy with application exclusions, is held on `baseline-conflict` in all 8 synthetic shapes. The new applications section cannot reach it (`rv-portal.txt`).
- **Uncalled script templates: REMAINING (critical).** 143 rows, unchanged. `rv-psid.txt` (demo block-legacy-auth, large require-managed-device): the script declares mandatory `-Mode`/`-TargetPolicyJson` and has no call line. `StageForCorrection` PATCHes an enabled policy to report-only, and `CorrectConditions|Grant|Session` throw "Refusing access-affecting correction while policy is On". That contradicts RUN-CONTEXT: preserve active enforcement by default. The export for the same steps says "Change only the settings listed above".
- **Immediate effect of changing an enabled policy: REMAINING.** `rv-edge staffExclOtherApp` / `staffGuestExcl`: an **executable** correction widens the enabled "Policy B" from a group to All users and changes its resources. Export, Entra and AI never say that saving applies MFA to everyone at once.
- **Guest exclusion removal: REMAINING (medium).** `rv-edge staffGuestExcl`: the update's `users` omits the tenant's `excludeGuestsOrExternalUsers`. The change appears only inside the raw from/to JSON. The export reads "Include: All users, Guest or external users → all types" and never says a guest exclusion is removed. Graph PATCH semantics for `conditions.users` remain unverified from a primary source.
- **Tenant application exclusion replaced: new observation (medium, disclosure).** `rv-edge staffExclOtherApp`: coverage reason `apps-excluded`. The update replaces the tenant's Exchange Online exclusion with the baseline's Intune Enrollment exclusion. This is consistent with the goal. The export line states only the new target and not the removal.

### 4. C05 passkey and other package gaps: REMAINING
- The matrix at HEAD still has **20/20** `held:packageFault`:
  - missing: `authenticator.target.configuration`, `tap.target.configuration`
  - invalid: `json.fido2: a JSON body with no request`
- Session-lifetime: `missing=policies.session.unmanaged.target.displayName,policy.target.excludeUsers`.
- register-info-protected: `degraded entra(policy.target.mode)`.
- No change was made in cycle 1.

### 5. Required walk and notice
- **Walk contract for the notice: FIXED.** 0 P0 at HEAD, with the 11 notice-link P1s gone as described above. The walk still raises a P0 if the address appears on Connect outside the notice's single `mailto:` link, or if that link is missing or duplicated. `forbidEverywhere`, the error page's rules and How's rules are unchanged.
- **Empty value `@()`: FIXED.** The negative/positive control runs at walk start.
- **"without locking anyone out": FIXED.** Content, test pin and walk pin were changed together.
- **"Prerequisite · In progress": UNFINISHED** (dirty tests only; see above).
- **STEP.md references: NOT STARTED.**

### 6. Verification
- readGroup: VERIFIED (8/8, rerun).
- Worker end-to-end uncertainty propagation: **NOT VERIFIED**.
- Real-login latency (C08): NOT VERIFIED; an offline fast path does not establish it.
- Export parity beyond all-users (`rv-parity.ts`, 214 steps):
  - 0 exports open a policy other than the update target.
  - 0 PS/JSON name a non-target policy.
  - **114 exports show a `Ready · …` state while `nextSafeAction` is blocked or held.**
    - 109 `blocked`, e.g. small s-goal-admin-session "Ready · Create" / "Clear what this step is waiting on."
    - 4 `escape-hatch-unverified`
    - 1 `readiness-unmet` (demo s-goal-mfa-all-users "Ready · Correct")
    - The adae27d copy gives identical counts, so these predate cycle 1. They are still a contradiction in the export.
  - 8 update steps whose PowerShell carries no policy id: these are the uncalled staging templates.

## Scope and feature preservation
- The `adae27d..HEAD` diff has 21 files, all added or modified. No deletions or renames. package.json, lockfile, baselines, .github and vite/tsconfig are untouched. The Jon Hope pin is unchanged.
- Tabs and channels are unchanged: the matrix rows are identical to the fixer's, and the drawn tab sets match R2. The Connect beta notice with `mailto:feedback@getiamai.com` is present once on every Connect fixture (walk, 0 P0).
- Test and contract edits are narrow:
  - The feedback address was removed only from the `connect.signedOut`/`connect.signedIn` forbid lists, with a stricter walk P0 in their place.
  - `EMPTY_VALUE` exempts only `@()` and carries a control.
  - The R1-F2 tie test's premise change is disclosed, and the old shape has its own test expecting the staff target.
  - No `.skip`, `.only` or `.todo` was added.
- Enforcement:
  - No cycle 1 change moves an enabled policy to report-only.
  - R1-F3 adds the baseline's Intune Enrollment exclusion to an enabled MFA policy on correction. It is listed as a "Target resources" change, but no immediate effect is stated.
  - The pre-existing staging scripts still demote enabled policies (item 3).

## Genuine owner choices
None. Every remaining item is routine under RUN-CONTEXT: target selection, channel contradictions, broken invocation, invalid binding, disclosure, or missing verification.

## Queue for the next fixer (in order)
1. **Unfinished prerequisite label.** Finish the dirty `To do` change:
   - `planBoard.ts:280` plus its doc comment
   - the 98 `docs/qa/step-snapshots` files, updated transparently
   - rerun contentReview/riskDeviceCampaign and the full suite
   - Commit the two test edits with it, and correct the two inaccurate RESULTS.md claims.
2. **C02/C06 scripts (critical):**
   - Give the 143 uncalled templates a bound call line (`-Mode` plus `policy.target.json`).
   - Make in-place correction keep the policy's state by default. `StageForCorrection` and the "Refusing … while policy is On" throw must not be the default path; staging can stay as an opt-in with its effect stated.
   - Word block, grant and session separately.
   - `-ReadinessApproved` needs a declared prerequisite or a withheld reason.
   - Tests must read the script body and call line together.
3. **Immediate effect on enabled policies.** Where a correction targets an enabled policy, say so in export, Entra and AI (e.g. "the policy is On; saving applies MFA to all users immediately"). Cover the group-to-All-users widening and resource changes.
4. **C05 passkey (critical).**
   - Give `json.fido2` its request (Graph v1.0 PATCH on authenticationMethodConfigurations/fido2) and project FIDO2 only.
   - A JSON hold must stop holding Entra, PowerShell and AI.
   - Authenticator and TAP stay unresolved.
   - Explain the AAGUID restriction's effect on existing keys.
5. **Gap 4:** coverage records the below-floor grant of a report-only own policy, and generate corrects it instead of creating beside it.
6. **Removed exclusions.**
   - Disclose an omitted `excludeGuestsOrExternalUsers` and a replaced tenant `excludeApplications` in changes and export, or preserve them where the baseline allows.
   - Settle `conditions.users` PATCH semantics from Microsoft documentation.
7. **Export state vs blocked action** (114 exports; pre-existing). The state label must not read Ready when `nextSafeAction` is blocked, held by the escape hatch, or unmet on readiness.
8. **Remaining package gaps:** session-lifetime unmanaged member and `excludeUsers` binding, register-info-protected `policy.target.mode`, STEP.md references in technician text.
9. **Missing tests:**
   - `grantExceedsFloor` OR multi-control
   - export lead "Correct the existing policy…" on an update step
   - a lone policy carrying the plan's name gets no duplicate display name, or the duplicate is stated
10. **Verification:**
    - worker end-to-end uncertainty propagation with mocked fetch
    - export parity for block-legacy-auth, admin-session and the guests pair once their scripts are callable
    - rerun walk, matrix, acceptance (expect 28/28) and a PowerShell parse on the code state that is finally committed
