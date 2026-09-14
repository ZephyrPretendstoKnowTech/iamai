# Final report: continuation cycle 2, fresh review

**Status: CONTINUE.** Not ready for owner review. This does not authorize publication, merge or deployment. No push, deploy, tenant action, script execution or external write was made. Only public Microsoft Learn documentation was read.

## Identity
| Item | Value |
|---|---|
| Reviewed HEAD | `a3d22f32bf20abc4bb7c40b345ca52e924bf0864` (branch preview-continuation) |
| Cycle 2 commits | 081da09 (cycle 1 docs), e208d3d, 7ed4caf, 74ad604, 58915aa, 3211c4b, 7898cb4, a409b3c, a3d22f3 (docs + probes) |
| Code state | `a409b3c..HEAD` changes only RESULTS.md, BLOCKED.md and the two c2 probes, so HEAD's code is the fixer's a409b3c |
| Dirty tree at review start | none (`git status --porcelain` empty); stash empty. No unfinished work to preserve |
| Reviewer edits | this report and REVIEW-STATUS.json only; no application/test edits; nothing committed |
| Logs | `../logs/review2/` (outside the clone). Clean source copy `../rv-src-a3d22f3` (`git archive a3d22f32`, node_modules junctioned). Reviewer probes: `../logs/review2/probes/rv2-gap4.ts`, `rv2-effect.ts`, `rv2-or.ts`, `../logs/review1/rv2-edge2.ts`; cycle 1 reviewer probes `rv-edge.ts`, `rv-parity.ts` rerun |
| Walk outputs | `docs/reports/walk-a3d22f3.md`, `walk/a3d22f3/` (gitignored, written by scripts/walk.mjs) |

## Checks run by the reviewer (exact code state)
| Check | Command / state | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit` in `../rv-src-a3d22f3` | exit 0 (`tsc.txt`) |
| Full suite | `node --test --test-isolation=none "src/**/*.test.ts"` in `../rv-src-a3d22f3`, 08:01–08:04 | exit 0: **2659 tests · 2656 pass · 0 fail · 0 cancelled · 3 skipped**. Skipped: Learn-link external health, HUGE=1 fixture, and "the scope script passes on HEAD" (the archive has no git history; the fixer's in-clone `full-5.txt` at a409b3c passed it, 2657/2 skipped). New cycle 2 tests are in the output and pass: 51 stateKeepingCorrection, 3 passkeyProjection, 3 gap 4 (`full.txt`) |
| Acceptance | `run-acceptance.mjs ../rv-src-a3d22f3` (harness byte-identical to the clone by `cmp`) | **28 PASS · 0 FAIL · 0 HARNESS_ERROR** (`acceptance.txt`); matches the fixer's `acceptance-3.txt` |
| Matrix | `s3-matrix.ts curated all` in the archive | exit 0; **row-for-row identical to the fixer's `matrix-5.txt` (0 diff lines)**. packageFault 0; `uncalled-template` 23 (guests-mfa 5, service-accounts-trusted-network 8, user-risk-medium 2, shared-devices 8); session-lifetime `missing=` 2 rows; register-info-protected `degraded entra(policy.target.mode)` 17 rows (`matrix.txt`) |
| PowerShell parse | not rerun | sha256 over all 40 PowerShell blocks (text + meta) in registry.generated.json is identical at 7898cb4 and a409b3c, so the fixer's parse at 7898cb4 (37 rendered files, 0 errors, `../logs/c2/ps-parse-2.txt`) covers HEAD |
| Walk | `TEMP=../cache/tmp node --import ../logs/c1/netblock.mjs scripts/walk.mjs` at HEAD (preload re-read: Node fetch and Chrome host resolution limited to localhost) | exit 0, 08:06–08:10. **0 P0, 498 P1, 50 P2**; "show-ready on this walk (no P0)"; throttled first load 4643 ms (P1, as before). After stripping item numbers, times, dates and the SHA, the findings are **identical to the fixer's a409b3c walk (507 lines each, 0 differ)**. Still present: the three passkey "supporting methods" dangling-lead P1s (cause below). The empty-value self-control ran at start. The feedback address appears on the Connect captures, and the walk's single-`mailto` notice rule raised no P0 (`walk.txt`, `walk-norm-*.txt`) |
| Snapshots | `git diff -U0 e208d3d^ e208d3d -- docs/qa/step-snapshots` | 98 files, 220 changed lines, all `"label": "Prerequisite · In progress"` → `"To do"`; no other snapshot change after e208d3d |
| Test edits | cycle 2 `*.test.ts` diff | no `.skip`/`.only`/todo added; 5 removed assert lines, each replaced by the new-wording assertion with a comment |
| Scope | `git diff --name-only adae27d a3d22f3` over package.json, lockfile, baselines, .github, vite/tsconfig | untouched |

## Queue verdicts

### C01 lone group-admins policy: FIXED (re-verified at HEAD)
- `s5-lone-group-admins.ts`: candidate "Policy A" ownScope false; step `create-report-only` of "Core - Require - MFA for all users"; no update; tracking null (`lone.txt`).
- `r2-hold-export.ts` lone/all/tie × REV 0/1: lone exports "Ready · Create" with no admins id in any channel; tie exports the correct lead against "Policy B"; all-users correction still targets the staff policy (`hold-*.txt`).
- `c1-a1-tagged.ts`: untracked keeps a report-only create, tagged/named update the drifted policy, `manual-correction`, not executable (`a1.txt`).
- **New finding in the same class, pre-existing (see R1 below):** the OR branch of `grantExceedsFloor` lets a group policy with a weaker alternative be widened to All users with its grant kept.

### Unfinished prerequisite label: FIXED
planBoard.ts `Ready: 'To do'`; the two cycle 1 test edits committed with it; snapshots label-only (above). The two inaccurate cycle 1 RESULTS claims are corrected in RESULTS.md.

### C02/C06 staging scripts and state-keeping corrections: FIXED for the ten packages; wording gaps REMAIN
- Verified in content and registry: `StageForCorrection`, its ValidateSet entry and "Refusing access-affecting correction while policy is On" are gone. State is written only by Create (report-only) and Enforce (enabled, still guarded by "Refusing enforcement: policy is not Report-only…" checks). `powershell.run` is `deployableAfterBinding` with `-TargetPolicyJson`/`-PolicyId` bound. META `safety` says the policy keeps its state.
- `rv2-effect.ts` (10 packages + mfa-all-users/admins × CorrectConditions/Grant/Session): every correction draws exactly one call bound to the target and the policy id. No Entra, AI or PowerShell text asks to move a policy to Report-only. (The probe's `ps=STAGE` column is a reviewer false positive: `/Refusing/` matched the legitimate Enforce guards.)
- `rv-parity.ts` at HEAD: `ps-missing-update-id` 8 → **0**; 0 exports open a non-target policy.
- Three Enforce modes that need `-ReadinessApproved` are `withheldModes.Enforce` with a reason.
- **REMAINING (medium): immediate effect not stated in every channel.** `rv2-effect.txt`:
  - The Entra CorrectConditions text of **s-goal-admin-session**, **s-goal-block-auth-transfer** and **s-goal-block-device-code** ends "5. Save. Leave **Enable policy** as it is." with no effect sentence. Adding the exclusions group to an On policy exempts its members at once.
  - AI Info states no effect for any correction of **admin-session**, **block-auth-transfer** or **admins-phishing-resistant**.
  - `stateKeepingCorrection.test.ts` lets this through. Its Entra regex accepts `Leave \*\*Enable policy\*\* as it is` (which states no effect) as satisfying the effect check, and it asserts only the *absence* of staging text in AI Info (`if (!c) continue`), never the effect. RESULTS.md's "Entra/AI … do carry the save effect" is therefore inaccurate.
- The export/Contract lead for an all-update step now reads "Correct the existing policy with the changes listed. If it is On, they apply to sign-ins as soon as you save." (rv-edge diff, hold-tie). It is generic: on a group → All users widening it does not say *who* is newly required, though the mfa-all-users AI Info does.

### C05 passkey: FIXED (projection); Authenticator/TAP correctly unresolved
- Matrix: 0 packageFault; passkey rows `executable portal:+ ai:+`. `json.fido2` is `PATCH …/policies/authenticationMethodsPolicy/authenticationMethodConfigurations/fido2` with the pinned body, restriction included. No Authenticator/TAP body invented; `Apply` withheld with a reason; `FIXED_IDENTITY` is anchored to the Graph v1.0 authenticationMethodsPolicy root. The negative controls run: id-less CA PATCH refused, look-alike path refused, positive twin projects.
- Microsoft Learn (how-to-enable-passkey-fido2, fetched during review, updated 2026-06-15) contains both quoted sentences verbatim. "Key restrictions set the usability of specific models or providers for both registration and authentication" supports Entra step 3's "a key already registered with any other AAGUID can no longer be used to sign in".
- **Not verified (low, pre-existing):** the same page now documents *passkey profiles* (opt-in is irreversible, and global settings move into a Default passkey profile). Whether the drawn portal path "Under Allowed passkeys, enable Enforce key restrictions" and a top-level `keyRestrictions` PATCH still apply to a tenant opted into profiles was not checked against the Graph reference.
- **Walk P1 "Then configure the supporting methods: has nothing listed under it": cause found, not a missing list.**
  - authoredText.ts:43-45 turns the authored blank line into a `break` part, and StepSections.tsx:434 draws it as `<span class="authored-break">`. The lead `<p>`'s next sibling is therefore that span.
  - walk.mjs:368-375 only accepts `ul, ol, .names-group, .picker, .decision, p, div` there, so it flags the lead.
  - The list is drawn: capture `walk/a409b3c/demo/1280/step-02-…txt` lines 32–39.
  - Fix the rule, which does not skip `.authored-break` (checking the rest of the walk stays clean), or the block's blank line. Do not drop the colon.
- Residual: `passkeyProjection.test.ts` reaches Verify with `'verificationRequired' as never`. Settings steps draw no PowerShell tab, so this has no drawn effect.

### Gap 4 below-floor report-only own policy: FIXED; side effects reviewed
- `s1-gap4-reportonly-weak.ts` at HEAD: coverage partial, reason weaker-control, one update of Policy W with body `[grantControls]`, changes `[Grant controls]`, stays report-only (`gap4.txt`).
- `rv2-gap4.ts` at HEAD vs d15428e:
  - (E) the gap 4 shape: create → grant-only update. Fixed.
  - (C) enforced All users MFA + report-only admins MFA: the admins goal was a create beside the admins policy; it is now a grant-only update of that role-assigned report-only policy. Consistent with the fix.
  - (A, D) a report-only **All users** MFA policy is not taken by the admins goal. No cross-goal takeover.
  - (B) enforced admins phishing-resistant + report-only admins MFA: status stays `enforced` with no operation, but the result now carries a `weaker-control` reason beside `excluded`. The enforced-weak branch already behaves this way. Whether any surface shows that reason on an in-place goal was not checked (low).

### STEP.md in technician text: FIXED
`grep -c STEP.md` over every CONTENT.md sums to 0.

### Export/board lane vs next safe action: REMAINING (medium-high, reproduced)
- `c2-export-lane.ts` at HEAD: `{"steps":107,"boardReadyBlocked":45,"noLaneReadyBlocked":45}`, identical to the fixer's, e.g. demo s-goal-block-legacy-auth "Ready · Correct" blockedBy `missing-object`.
- `rv-parity.ts` (10 fixtures × as-is/all-Ready, 214 steps): 114 unchanged. 109 `blocked`, 4 `escape-hatch-unverified` (demo/midflight admins "Ready · Observing"), 1 `readiness-unmet` (demo mfa-all-users "Ready · Correct").

### Removed exclusions not disclosed: REMAINING (medium, reproduced)
`rv-edge.ts` at HEAD:
- **staffGuestExcl:** the executable update's `users` drops the tenant's `excludeGuestsOrExternalUsers`. It appears only in the raw from/to JSON of "Users".
- **staffExclOtherApp:** the tenant's Exchange Online exclusion is replaced by Intune Enrollment.
- Export, Entra and AI for both say neither "the guest exclusion is removed" nor "the Exchange Online exclusion is removed". The export also says "Change only the settings listed above; leave every other setting on this policy as it is."
- `conditions.users` PATCH semantics were still not read from Microsoft's conditionalAccessPolicy update reference.

### Remaining uncalled scripts: REMAINING (high)
23 matrix rows (above). guests-mfa `-TargetPoliciesJson` (two policies); service-accounts-trusted-network and shared-devices `-Mode`; user-risk-medium.

### Package gaps: REMAINING (medium/low)
- session-lifetime (`all-users-no-persistence`): `missing=policies.session.unmanaged.target.displayName,policy.target.excludeUsers`, preview with stand-ins.
- register-info-protected: `degraded entra(policy.target.mode)` on 17 rows.

### Verification (FINDINGS 6)
- readGroup: verified in cycle 1 (8/8); not rerun, no change since.
- Worker end-to-end uncertainty propagation: **NOT VERIFIED** (no probe or test in cycle 2).
- Real-login latency (C08): not claimed, not verified.
- Export parity beyond all-users: rv-parity covers 214 steps. No wrong-target export, no id-less update script. The Ready/blocked contradiction remains.

## New finding

### R1 (high, pre-existing since adae27d): a part-population policy with a weaker OR alternative is widened to All users with its grant kept
Probe `../logs/review2/probes/rv2-or.ts`, run on HEAD, d15428e and adae27d with identical plans (`rv2-or-head.txt`, `-d15428e.txt`, `-adae27d.txt`); also `../logs/review1/rv2-edge2.ts` with staff and admins groups.
- Shape: an **enabled** policy for an admins group with grant `{operator: OR, builtInControls: [compliantDevice], authenticationStrength: phishing-resistant}`, no other MFA policy.
- mfa-all-users: candidate `weak`, **ownScope true**, meetsFloor false. The step is `correct`, **executable**, and updates `c0100000-…0001` with body keys `[conditions]` only: `includeUsers:["All"]`, `includeGroups:[]`. Changes `["Users","Target resources"]`, no grant change, no `weaker-control` reason.
- The PowerShell call `CorrectConditions -PolicyId c0100000-…0001` carries a target whose `grantControls` is still `OR [compliantDevice] + phishing-resistant strength`. The export: "open "Policy A" … Include: All users … Change only the settings listed above; leave every other setting on this policy as it is."
- Effect if followed: as soon as it is saved (the policy is On), every user without a compliant device must satisfy phishing-resistant MFA. That is the C01 hazard reached through OR. The same shape with `MFA OR compliant device` widens a grant that lets everyone skip MFA with a compliant device; the correction does not deliver the goal's floor and does not say so.
- Why it slips through: strength.ts `grantExceedsFloor` under OR counts as exceeding only if *every* control is stronger, so `strength OR compliantDevice` is not "exceeding" and the policy stays own. Nothing then corrects its below-floor grant on the widening path.
- No test covers the OR branch. The cycle 1 review asked for one.
- **The fix is routine, not an owner decision:** a policy chosen as the all-users goal's own must not be widened with a grant that is not the goal's floor. Either the update also writes the floor grant (listed as a change, with its effect stated), or such a part-population policy is not own and the goal gets the report-only create. Pick the reading consistent with gap 4 (correct the grant in place) or with C01 (asks something other than the floor, so it is not own). Cover OR-with-stronger, OR-with-weaker (MFA OR compliant device), AND and plain shapes, both orders, and assert on the target JSON and the export.

### Other lower observations
- `loneNamed` (rv-edge): a lone admins-group strength policy named "Core - Require - MFA for all users" still gets a report-only create with the same display name. Safe (no update) but gives the tenant two same-named policies; unstated. No test.
- The matrix counts 51 rows whose issues include `stand-in:‹complete target policy›`; RESULTS.md cycle 2 cites 45 new ones at 7ed4caf. Preview-only rows; not investigated further.

## Scope and feature preservation
- Tabs and channels: matrix drawn columns are unchanged except passkey (now drawn Entra + AI, which were withheld by the fault). No settings step gained machine tabs (stepBody.ts U15 unchanged).
- Enforcement: no cycle 2 change moves an enabled policy to report-only. The staging default that did is removed. Create stays report-only, and Enforce keeps its report-only precondition. The gap 4 correction writes no state.
- Baseline: the Jon Hope pin is untouched. The passkey AAGUID allow list and attestation are kept.
- Notice: cycle 2 does not change the Connect contracts or the beta notice. The walk at HEAD raised no P0 under the rule that requires exactly one `mailto:feedback@getiamai.com` link in the notice and forbids the address elsewhere on Connect.
- Working tree after review: ` M docs/preview-continuation/FINAL-REPORT.md`, ` M docs/preview-continuation/REVIEW-STATUS.json` (uncommitted, as REVIEW.md requires); stash empty; HEAD still `a3d22f32…`. The walk wrote gitignored `docs/reports/walk-a3d22f3.md` and `walk/a3d22f3/`.
- Test/pin edits are narrow: each replaced assertion names the removed staging or "leave it On" wording and asserts its replacement. Snapshots are label-only. The one weak spot is the stateKeepingCorrection effect regex (above).

## Genuine owner choices
None. Every remaining item is routine under RUN-CONTEXT: wrong target or grant on widening, broken invocation, channel/state contradiction, disclosure, invalid binding, missing verification.

## Queue for the next fixer (in order)
1. **R1 OR-alternative widening (high).** Fix the own-scope or grant correction for part-population policies whose OR grant is not the floor (above). Add the missing `grantExceedsFloor` OR tests at the fixture level with target JSON and export assertions.
2. **Remaining 23 uncalled scripts (high).**
   - guests-mfa: a pair binding, or `withheldModes` with a reason.
   - service-accounts-trusted-network, shared-devices, user-risk-medium: a bound invocation or a withheld reason.
   - Tests read the body and call together.
3. **Board/export Ready vs blocked (medium-high).** 45 steps by the board lane, 114 no-lane. Classify by `blockedBy` (`blocked`, `missing-object`, `escape-hatch-unverified`, `readiness-unmet`). Find whether planLanes or nextSafeAction misreads each, and fix that reading without adding a new readiness rule.
4. **Immediate effect in every correction channel (medium).**
   - Entra CorrectConditions for admin-session, block-auth-transfer, block-device-code.
   - AI Info for admin-session, block-auth-transfer, admins-phishing-resistant.
   - Tighten `stateKeepingCorrection.test.ts`: require an effect sentence in Entra *and* AI, not "Leave **Enable policy** as it is" alone.
5. **Removed exclusions (medium).** Disclose (or preserve where the baseline allows) a dropped `excludeGuestsOrExternalUsers` and a replaced tenant `excludeApplications` in changes, export, Entra and AI. Read Microsoft's conditionalAccessPolicy update reference for `conditions.users` PATCH semantics.
6. **Package gaps (medium/low).** session-lifetime unmanaged displayName and `excludeUsers`; register-info-protected `policy.target.mode`.
7. **Walk rule vs `.authored-break` (low).** The passkey lead is followed by its list. Make the dangling-lead rule skip the break span, or remove the blank line, and confirm no other finding hides behind it.
8. **Low.**
   - Same-name report-only create beside a lone plan-named admins policy: state it or avoid it, with a test.
   - Whether an enforced goal's `weaker-control` reason from a report-only companion (rv2-gap4 B) is drawn anywhere.
   - Passkey portal path and `keyRestrictions` body under passkey profiles.
9. **Verification.**
   - Worker end-to-end uncertainty propagation with mocked fetch.
   - After changes: full suite, typecheck, build, matrix, PowerShell parse of any changed script, acceptance 28/28, and the walk on the committed state.
