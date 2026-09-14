# Final report: continuation cycle 6, fresh review

**Status: CONTINUE.** Not ready for owner review. This does not authorize publication, merge or deployment. No push, deploy, tenant action, script execution or external write was made.

## Identity
| Item | Value |
|---|---|
| Reviewed HEAD | `0aabf685d71403aa63dbc1a00ee1ffb069dc2ac4` (branch preview-continuation) |
| Cycle 6 commits | a6c157a (cycle 5 review docs), 6d96531, 2f8a008, ec7bfed (code), 2a91409, 0aabf68 (docs) |
| Code state | HEAD's code is ec7bfed: `git diff --stat ec7bfed HEAD` touches RESULTS.md and BLOCKED.md only. Source/test diff `a6c157a..HEAD`: stepPackage.ts, StepSections.tsx, registry.generated.json, 8 test files (1 new), 25 correction packages' CONTENT/META, unmanaged-browser, guests META, shared-devices CONTENT, LIBRARY.json |
| Dirty tree at review start | none (`git status --porcelain` empty); stash empty |
| Dirty source/test entries | none |
| Reviewer edits | this report and REVIEW-STATUS.json only; nothing committed |
| Logs | `../logs/review6/`, outside the clone |
| Reviewer copies | `../rv-src-0aabf68`: plain `git archive HEAD`; the junction attempt failed (`junction.txt`), so it has **no** node_modules link. `../rv6-nv-a6c157a`: `git archive a6c157a2` plus HEAD's 8 changed test files. Its `node_modules` holds **copies** (not links) of idb, react, react-dom, scheduler and @azure, taken from the clone |
| Reviewer probes | `../logs/review6/rv6-removed-name.ts` (new). Reruns: `../logs/review1/rv-edge.ts` (staffGuestExcl, staffExclOtherApp), `s5-lone-group-admins.ts`, `r2-hold-export.ts` SHAPE=lone/tie/all, `s3-matrix.ts curated all`. Inline registry scans (commands in the sections below) |

## Checks run by the reviewer (exact code state)
| Check | Command / state | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit` in the clone at HEAD | exit 0, no output (`tsc.txt`) |
| Full suite | `npm test` in the clean clone at HEAD | exit 0: **2752 tests · 2750 pass · 0 fail · 0 cancelled · 2 skipped**. The skips are the Learn-link external health check (EXTERNAL_HEALTH=1) and the HUGE=1 fixture. Same totals as the fixer's `c6/full-4.txt` (`full.txt`) |
| Non-vacuity | HEAD's 8 changed test files run in `../rv6-nv-a6c157a` (pre-cycle-6 source) | **18 of 61 fail**: removedExclusionChannels 3 of 4 (its control passes); the pinned Save/AI texts in mfaAuthContentSpecs (4 tests) and sessionAdminContentSpecs (2); pilot's carried-whole test; guests R5-1 "no JSON body with no request"; the authored-package keep-state scan. The new report-only N1 pin (packageState) and the partly deployed pair pin pass there, as expected for pins of behaviour cycle 5 already had. Each has a premise and a control that execute. conditionsInvocation passes (it only filters an absent line). First run: `nonvacuity.txt`, where 5 files did not load for lack of `idb`. Rerun of those 5 with copied packages: `nonvacuity-2.txt` |
| Test edits | `git diff a6c157a HEAD -- '*.test.ts'` | No `.skip`/`.only`/todo added. Three assert lines were replaced, each by a narrower form: pilot's carried-whole, now with the optional line filtered, plus a premise and a not-drawn check; block-device-code `^param\(`, now anchored to the removal line and then `param(`; block-legacy-auth's exact AI text, extended by the paragraph. All match RESULTS' disclosure |
| Build | `npm run build` | exit 0, chunk-size warning only (`build.txt`) |
| Acceptance | `node ../rv-src-0aabf68/docs/preview-continuation/acceptance/run-acceptance.mjs ../rv-src-0aabf68 ../logs/review6/acceptance` (harness byte-identical by `cmp`) | **28 PASS · 0 FAIL · 0 HARNESS_ERROR**, exit 0 (`acceptance.txt`, `acceptance/results.json`) |
| Matrix | `node docs/preview-corrections/probes/s3-matrix.ts curated all` at HEAD | exit 0. **0 diff lines** against the fixer's `c6/matrix-1.txt` (`matrix-vs-fixer.diff`). executable 236, preview 125, uncalled-template 0, packageFault 0. The session-lifetime unmanaged key is still on 15 rows, and all 20 all-users-no-persistence renders are previews |
| C01 original | `s5-lone-group-admins.ts`; `r2-hold-export.ts` SHAPE=lone/tie/all | Lone group-admins: `create-report-only` executable, no update, tracking null, export "Ready · Create", `ids=[]`. Tie: executable `correct`. All: `correct` not executable (`blocked`), preview note "not ready to run". Unchanged from review 5 (`s5-lone.txt`, `hold-export-*.txt`) |
| Removed exclusions | `rv-edge.ts` CASE=staffGuestExcl / staffExclOtherApp | Both removal sentences are drawn ("…removes guest or external users…", "…removes Office 365 Exchange Online…"), 4 occurrences each across Entra, PowerShell, AI Info and export (`rv-edge.txt`) |
| Removal-line placement | registry scan (`removed-line-placement.txt`) | In all 25 packages the Entra line is in `sharedAfter`; for guests it is in the pair's only module. The AI Info line is top-level, and the script line is in the one `powershell.run` block every mode calls. So the line is drawn with any selected correction module: no module combination loses it |
| PowerShell parse | reviewer render + `Parser::ParseFile`, parse only, nothing executed | The R6-1 render below: 11 errors (`rv6-removed-name-parse.txt`). Not repeated for the fixer's 156-file unbound/bound set, whose sample name has a quote but no line break |
| Walk | `npm run build`, then `TEMP=../cache/tmp node --import ../logs/c1/netblock.mjs scripts/walk.mjs` in the clone at HEAD (12:19–12:23). Preload re-read: Node fetch and Chrome resolution reach only localhost | walk exit 0: **0 P0, 495 P1, 50 P2**; throttled first load 4.7 s (P1, as before). Report `docs/reports/walk-0aabf68.md` (gitignored) is identical to the fixer's `walk-ec7bfed.md` below the header after stripping digits, apart from the capture directory name (`walk.txt`, `walk-report-diff.txt`) |
| Scope | `git diff --stat a6c157a HEAD` over package.json, lockfile, .github, vite/tsconfig, data, baselines, src/feedback.ts, scripts, page-contracts, docs/design/content.json | empty. content.json still carries `mailto:feedback@getiamai.com` (:978) |

## Queue verdicts (review 5 queue)

### 1. Removed exclusions in executable channels: FIXED, with a new defect in the binding (R6-1)
- `removedExclusionNames` (stepPackage.ts:200) uses the same words as stepPortal.ts:299. It is bound as `policy.current.removedExclusions` when the step has exactly one planned operation, and per member in `memberBindings`. `op` is `plannedOperationsOf(step)[0]` (:414), the same single operation, and `removes` is computed from that update's own body (generate.ts:587).
- Evidence: rv-edge at HEAD, the placement scan, and non-vacuity 3 of 4 (all above). A correction that keeps every exclusion draws no line and no marker (the test's control passes on old and new source).
- The JSON channel carries no prose, as disclosed; the Entra, AI Info, script, portal and export lines name the removal.
- **But** the name is bound verbatim into a PowerShell `#` comment. See R6-1.

### 2. shared-devices: Create note FIXED; the Enforce reference is kept (agreed, low)
- s-shared-devices/CONTENT.md:123: "The PowerShell Create writes this one policy only. Excluding these accounts from the person-interactive policies is a separate step, made in Entra for each policy IAMAI identifies."
- `readyToEnforce` still names the withheld Enforce run, as user-risk-medium and service-accounts do. The reason is declared in `withheldModes`. Not a hand-over.

### 3. Guests pair JSON (R5-1): FIXED
- `json.target-pair` and `json.enforce-pair` are out of the projections. The new test fails on pre-cycle-6 source and passes at HEAD.
- The matrix moves only the two getiamai guests rows (the JSON degraded entry is gone), identical to the fixer's.

### 4. Board Ready vs blocked, 7: REMAINS (not started)
No lane or nextSafeAction code changed in cycle 6 (the diff is stepPackage bindings and comment, StepSections spacing, content). Not rerun. The fixer's 2f8a008 probe reads `{"steps":107,"boardReadyBlocked":7,"noLaneReadyBlocked":7}`.

### 5. Package gaps: REMAIN
- **session-lifetime unmanaged member (medium):** investigated, not fixed.
  - The reviewer's matrix still shows 15 rows with `policies.session.unmanaged.target.displayName` missing, and every all-users-no-persistence render is a preview.
  - The fixer's reading is supported by the code read here: `memberBindings` skips a member with no stable id, and the unmanaged member has `memberStableId: null`, so a required binding can never bind.
  - The proposed next step (make the unmanaged bindings optional, withhold only its runs with a stated reason, keep the pinned browser member executable) fits RUN-CONTEXT ("keep independently valid instructions usable… accurately explain unresolved values"). It is not an owner decision.
  - The reviewer did not re-read `PINNED_GOAL_MAP` itself.
- Not started: register-info-protected `policy.target.mode`; pim-activation-reauth authContext/strength; the pim grant+session floor test.

### 6. N1 follow-ups: comment and pins FIXED; release question open (low)
- The stepPackage.ts comment now separates the enforced and report-only readings.
- The report-only pin reads `blocked` under a break-glass wait, with `nextSafeAction` not executable as its premise and an ungated `partial` control.
- The partly deployed pair withholds only the script, on `policies.guests.strong.current.id`.
- Whether a report-only policy's correction should be released under the wait (§18.3) is still unchanged. The current hold is the conservative, consistent reading on screen, in the action and in the export, so it is not a material defect.

### 7. Low items: REMAIN
Unprojected lifecycle/ReportOnly/Location leftovers (shared-devices' `entra.correct.lifecycle`/`json.report-only` included); same-name create; passkey profiles; worker Lane B/P1 and scoring of a missing methods entry; guests pair not rendered end to end by a fixture; real-login latency not claimed.

### New in cycle 6, fixer finding: unmanaged-browser authored staging: FIXED (content only; never drawn)
- The diff removes the StageA/StageB runs, the `Stage` function, the "Refusing correction while policy is On" guard and the staging prose. It states the effect in Entra and AI Info, and closes the final `foreach` brace.
- The authored keep-state scan fails on pre-cycle-6 source and passes at HEAD.
- The package's Partial projection is still withheld in the registry, so none of this reaches a screen.

## New findings

### R6-1 (medium, introduced in cycle 6, locally actionable): a tenant name with a line break leaves the script comment and becomes code in a copyable script
**Before and after.** Cycle 6 is the first time tenant free text is bound inside a PowerShell script body.
- At a6c157a, 0 registered `powershell` blocks contain a `{{binding}}`. Every value reached scripts through invocation.ts `literal()`, as single-quoted strings, where a line break stays inside the string.
- At HEAD, 25 blocks do, all `# This change removes {{…removedExclusions}} …`.
- The guests pair's lines also bind `{{policies.guests.<role>.current.displayName}}`, the tenant policy's own name.
- The inline registry scan is in the review log.

**Data path.**
- names.ts `put` stores directory display names as read, with no normalising.
- `removedExclusionNames` maps ids through `nameOf`.
- project.ts `bindText` → `formatValue` inserts strings verbatim, with no per-format escaping.

**Reproduction** (`../logs/review6/rv6-removed-name.ts`, output `rv6-removed-name.txt`):
- Shape: rv-edge's staff policy (curated demo-week2, enforced, `excludeGroups: [exclusions group, X]`). Group X's `displayName` in the fixture's group map is `"Contractors\nRemove-MgGroup -GroupId 00000000-0000-0000-0000-000000000000"`.
- `label(X)` returns the name with the line break.
- The operation is `update` with `removes.ids=[X]`, and `previewNote` is null: the correction is handed over, not previewed.
- The drawn PowerShell artifact reads:
  ```
  function Invoke-IAMAIStep {
  # This change removes Contractors
  Remove-MgGroup -GroupId 00000000-0000-0000-0000-000000000000 from the policy's exclusions. …
  param(
  ```
- Parse only (`rv6-removed-name-parse.txt`): 11 errors. The function's `ParamBlock` is null, `Remove-MgGroup` is a `CommandAst` in the function body, and the invocation line and closing brace no longer parse.
- The Entra Save item, AI Info and export line split the same way. That is prose, but the Save item's second half falls out of the numbered list. The export sentence existed before cycle 6 (ebb9633); the script comment did not.
- `MODE=nameOf` (a `ctx.nameOf` returning the same text) gives the identical render.

**Not verified.** Whether Entra/Graph accepts a line break in a group, application or policy display name. A web search was inconclusive, and no tenant was touched. The product does no normalising either way, and a script the technician runs should not depend on that.

**Next.**
- Normalise line breaks and other control characters (at least `\r`, `\n`, `\u0085`, `\u2028`, `\u2029`) in values bound into free text. Doing it in `bindText` for every non-JSON format, or at least `powershell` and list-item markdown, covers the guests `current.displayName` too.
- Leave invocation literals as they are.
- Pin it:
  - a removal name and a guests policy name with `\n`, `\r\n` and `\r`: the rendered script keeps one comment line and its `param(` block;
  - a parse-only check (or an AST-free assertion that no bound line starts outside the comment);
  - the Save item stays one list item.

### R6-2 (low, observation): the removal line is bound only when a step has exactly one planned operation
A non-member package whose step plans two operations gets no line (`plannedOperationsOf(step).length === 1`). stepPortal.ts' portal line uses the same single-operation reading, so the channels agree. The guests and session sets bind per member. No registered correction package was found that plans two operations without members (unmanaged-browser's Partial projection is withheld). Record only.

## Missing tests
- Line breaks and control characters in names bound into script, Entra and AI text (R6-1).
- session-lifetime: a curated render whose browser member is executable and whose unmanaged reason is stated (after the fix).
- Guests pair rendered end to end from a fixture resolving both pinned members.
- The 4 report-only Ready-but-blocked watches' action line.

## Scope and feature preservation
- **Tabs and channels:** the matrix is identical to the fixer's. Cycle 6 moved exactly the 2 getiamai guests rows (JSON degraded entry gone); no drawn channel was removed.
- **Enabled-policy state:** no correction call writes state. unmanaged-browser's authored Correct now PATCHes name, conditions, grant and session only (not projected). The keep-state scans pass at HEAD.
- **Safety:** C01 lone/tie/all unchanged and correct. Removed exclusions are now disclosed beside every executable correction channel except JSON, which carries no prose.
- **Notice and baseline:** the Connect beta notice and the `feedback@getiamai.com` link are unchanged; baselines are untouched.
- **Tests:** narrow, disclosed pin changes; no suppression.

## Genuine owner choices
None. R6-1 is a routine bug fix, as are session-lifetime (optional member with a stated reason), the 7 Ready-but-blocked action lines, the package gaps and the report-only release reading. Each is routine under RUN-CONTEXT.

## Queue for the next fixer (in order)
1. **R6-1, name normalising in bound text (medium, new).** Normalise line breaks and control characters in free-text bindings, covering the script `#` lines (25 packages, and the guests `current.displayName`) and the Entra/AI list items. Pin it with `\n`, `\r\n` and `\r` names, a parse-only check of the rendered script, and a control that a normal name renders unchanged. Re-parse the 39 script blocks with a line-break sample.
2. **session-lifetime unmanaged member (medium).**
   - Make the unmanaged bindings optional, and give its Entra/AI lines `[omit this line when unavailable]`.
   - Withhold only its script runs, with "no pinned unmanaged-device session policy".
   - Pin a curated render with an executable browser create that never names the unmanaged member. Check `policy.target.excludeUsers` on that render at the same time.
3. **Board Ready vs blocked, 7 (medium).** For the 4 report-only watches, the action line names what the watch waits on. The 3 enforced demo holds stay; that is the safe reading.
4. **Package gaps:** register-info-protected `policy.target.mode`; pim-activation-reauth authContext/strength; the pim grant+session floor test.
5. **Report-only correction under an emergency-access wait (low).** Either release it in `nextSafeAction` and `packageStateOf` together, reversing the packageState pin, or record why §18.3 does not apply.
6. **Low:** unprojected lifecycle/ReportOnly/Location leftovers; same-name create; passkey profiles; worker Lane B/P1 and scoring of a missing methods entry.
7. **Verification after changes:** full suite, typecheck, build, matrix, PowerShell parse of changed scripts (including a line-break sample), acceptance 28/28, and a walk at the committed state.

## Walk
- Reviewer walk at HEAD (code = ec7bfed): **0 P0, 495 P1, 50 P2**, the same findings as the fixer's ec7bfed walk and the cycle 5 walks. The 3 long-sentence P1s that 2f8a008 added are gone; the plain demo's MFA and device-code planning previews still draw the removal line.
- The walk draws the plain demo (`demoFacts.ts:19`), so it does not exercise R6-1, the guests pair or rv-edge's shapes. For those, the evidence is the probes, the matrix and the tests above.

## Working tree after review
- ` M docs/preview-continuation/FINAL-REPORT.md` and ` M docs/preview-continuation/REVIEW-STATUS.json` (this review, uncommitted as REVIEW.md requires). HEAD is still `0aabf685…`; stash empty.
- Gitignored outputs written: `dist/`, `docs/reports/walk-0aabf68.md`, `walk/0aabf68/`.
- Outside the clone:
  - `../logs/review6/`, including the rendered `rv6-removed-name-*.ps1`, parsed only and never executed;
  - `../rv-src-0aabf68/`, a plain archive with no junction;
  - `../rv6-nv-a6c157a/`, whose node_modules holds copied packages, not links.
