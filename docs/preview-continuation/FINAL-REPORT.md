# Final report: continuation cycle 7, fresh review

**Status: CONTINUE.** Not ready for owner review. This report does not authorize publication, merge or deployment. No push, deploy, tenant action, script execution or external write was made.

## Identity
| Item | Value |
|---|---|
| Reviewed HEAD | `41a760f02a45d8a76f141f5109b86a4d338e348a` (branch preview-continuation) |
| Cycle 7 commits | 06315a7 (cycle 6 review docs); e7a065b, 4361874 (code); c320589, 41a760f (docs) |
| Code state | HEAD's code is 4361874. `git diff --stat 4361874 HEAD` touches only RESULTS.md and BLOCKED.md. The source/test/content diff `06315a7..HEAD` is project.ts, stepPortal.ts, registry.generated.json, bindingInventory.test.ts, 2 new tests (boundNameLineBreaks, sessionLifetimeUnmanaged), s-goal-session-lifetime CONTENT/META, and LIBRARY.json |
| Dirty tree at review start | none (`git status --porcelain` empty); stash empty. No unfinished work to preserve |
| Dirty source/test entries | none |
| Reviewer edits | this report and REVIEW-STATUS.json only; nothing committed |
| Logs and probes | `../logs/review7/`, outside the clone. New probes: `rv7-quote.ts`, `rv7-session.ts`, and the parse-only `rv7-ast.ps1`, `rv7-ast-calls.ps1`, `rv7-doubling.ps1`. Reruns: `s5-lone-group-admins.ts`, `r2-hold-export.ts` for lone/tie/all, `../logs/review1/rv-edge.ts`, `c2-export-lane.ts`, `s3-matrix.ts` |
| Reviewer copies | `../rv-src-41a760f`, a plain `git archive HEAD` with no node_modules, used for acceptance. The non-vacuity run used the fixer's `../c7-nv-06315a7`: its node_modules is a junction, and nothing there was edited |

## Checks run by the reviewer (exact code state)
| Check | Command / state | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit` in the clean clone at HEAD | exit 0, no output (`tsc.txt`) |
| Full suite | `npm test` in the clean clone at HEAD, 12:55:53–12:59:12 | exit 0: **2757 tests · 2755 pass · 0 fail · 0 cancelled · 2 skipped**. The skips are the Learn-link external health check (EXTERNAL_HEALTH=1) and the HUGE=1 fixture. Same totals as the fixer's `c7/full-2.txt` (`full.txt`) |
| Build | `npm run build` at HEAD | exit 0, chunk-size warning only (`build.txt`) |
| Acceptance | `node ../rv-src-41a760f/docs/preview-continuation/acceptance/run-acceptance.mjs ../rv-src-41a760f ../logs/review7/acceptance`; harness identical by `cmp` | **28 PASS · 0 FAIL · 0 HARNESS_ERROR**, exit 0 (`acceptance.txt`) |
| Matrix | `node docs/preview-corrections/probes/s3-matrix.ts curated all` at HEAD | exit 0. Row for row identical to the fixer's `c7/matrix-1.txt`: the only diff line is the `matrix exit 0` this wrapper appends (`matrix-vs-fixer.diff`). All 20 all-users-no-persistence rows are still previews on `missing=policy.target.excludeUsers` |
| Walk | after that build: `TEMP=../cache/tmp node --import ../logs/c1/netblock.mjs scripts/walk.mjs` at HEAD (13:00–13:03). The preload was re-read (`netblock-reread.txt`) | walk exit 0: **0 P0, 495 P1, 50 P2**, first throttled load 4732 ms (P1, as before). `docs/reports/walk-41a760f.md` (gitignored) matches the fixer's `walk-4361874.md` once digits are stripped, apart from the capture directory name (`walk-report-diff.txt`, 4 lines) |
| Non-vacuity | the three new or changed test files, byte-identical to HEAD by `cmp`, run in `../c7-nv-06315a7`, whose project.ts has no `oneLine` | exit 1. **6 tests fail**: boundNameLineBreaks 3 of 3, sessionLifetimeUnmanaged 2 of 2, and bindingInventory's changed session test (`nonvacuity.txt`) |
| Test edits | `git diff 06315a7 HEAD -- '*.test.ts'` | No `.skip`, `.only` or todo added. One assert line removed: bindingInventory's `includes('policies.session.unmanaged.target.displayName')`, replaced by an exact `deepEqual(['policy.target.excludeUsers'])`. That is narrower, and it is disclosed in RESULTS |
| C01 original | `s5-lone-group-admins.ts`; `r2-hold-export.ts` SHAPE=lone/tie/all | **0 diff lines** against review 6's logs. Lone group-admins: `create-report-only`, executable, tracking null. Tie: executable `correct`. All: `correct` not executable (`s5-lone.txt`, `hold-export-*.txt`) |
| Removed exclusions | `rv-edge.ts` CASE=staffGuestExcl / staffExclOtherApp, LEN=100000 | "…removes guest or external users…" and "…removes Office 365 Exchange Online…" are each drawn 4 times, as in review 6. The 8 diff lines are the same viewer lines cut at a different length (`rv-edge-100000.txt`) |
| Board lane | `node docs/preview-continuation/probes/c2-export-lane.ts` | `{"steps":107,"boardReadyBlocked":7,"noLaneReadyBlocked":7}`, unchanged (`export-lane.txt`) |
| Scope | `git diff --stat 06315a7 HEAD` over package.json, package-lock.json, .github, vite.config.ts, tsconfig.json, data, baselines, src/feedback.ts, scripts, docs/design/content.json, docs/qa/page-contracts.json | empty. content.json:978 still carries `mailto:feedback@getiamai.com` |

## Queue verdicts (review 6 queue)

### 1. R6-1, line breaks in bound names: FIXED
- `project.ts` `oneLine` is applied in `formatValue` to strings and list strings. `stepPortal.ts` reads object and policy names through it. `{{json:x}}` values stay JSON-encoded.
- Reviewer reproduction at HEAD (`rv7-quote.ts` case `lineBreak`):
  - Shape: rv-edge's staff shape, with group X named `Contractors\n<Remove-MgGroup…>` and the tenant policy named `Policy B\r\n<Remove-MgGroup…>`.
  - The script's line 2 is the whole removal comment, and line 3 is `param(`.
  - Parse only, reading the text as UTF-8: 0 errors and no `Remove-Mg*` CommandAst, on both Windows PowerShell 5.1.26100 and PowerShell 7.6.6 (`rv7-ast-ps51.txt`, `rv7-ast-pwsh.txt`).
- The policy name with a break is also safe in `-TargetPolicyJson`, because JSON encoding escapes it.
- The new tests fail on pre-cycle-7 source (above).
- **But** review 6 said "Leave invocation literals as they are", and that was wrong. See R7-1.

### 2. session-lifetime unmanaged member: FIXED within the evidence; still a preview on `excludeUsers`
- **Pin and package facts.** Confirmed by the sessionLifetimeUnmanaged premises, which fail on old source: `PINNED_GOAL_MAP['all-users-no-persistence']` is one id, and the unmanaged member's `memberStableId` is null.
- **At HEAD** (`rv7-session.ts`, curated demo-week2):
  - The drawn call is `Invoke-IAMAIStep -Mode 'CreateBrowser' -BrowserPolicyDisplayName 'Core - Session - Non-persistent browser sessions' -ExcludeGroupIds @('000f4435-…') -ExcludeUserIds '‹excluded people›'`.
  - The preview note is "Values still to resolve: excluded people."
  - With the accounts held, there is no hold, and Entra, PowerShell, JSON and AI Info are all drawn.
- **Parse only** (`rv7-ast-calls.ps1`, both PowerShell versions, drawn and held scripts): 0 errors. `CreateBrowser` is in the `-Mode` ValidateSet, and every passed parameter is declared (`rv7-session-ast-*.txt`). The script's `CreateBrowser` branch (CONTENT.md:255) uses only the browser name and conditions. The two-policy `Create` is withheld with a stated reason.
- **Before**, in the pre-cycle-7 copy (`pre06315a7/rv7-session.txt`): `-Mode 'Create'` with `-UnmanagedPolicyDisplayName '‹unmanaged device session policy name›'`, and a four-value note.
- **Remaining:** see the queue.
  - `policy.target.excludeUsers` (`[]` in the pinned target) keeps every render a preview.
  - The export reads "Ready · Create" and lists the whole create while the screen says "cannot be copied". The pre-cycle-7 copy shows the same export, so cycle 7 did not introduce this.
  - reportOnly/readyToEnforce still require the unmanaged id (fixer's reading, not re-rendered here).

### 3. Preview-note values (new in cycle 7): VERIFIED consistent with the drawn call
`planningValues` skips a parameter whose `modes` miss every run mode. That is the same test the invocation applies (`invocation.ts:124`, `if (!p.modes.includes(run.mode)) continue`), so the note lists exactly the parameters the drawn call passes. The guests adjust previews on demo and demo+curated now list only `‹both guest policy targets›`. Why a blocked guests adjust previews that run (rather than `CorrectPair`) was not traced (low).

### 4. Board Ready vs blocked, 7: REMAINS (not started)
Lane probe at HEAD: 7 and 7, unchanged. No lane or `nextSafeAction` code changed.

### 5. Package gaps: REMAIN
**register-info-protected `policy.target.mode`: investigated by the fixer; the reading is confirmed; not an owner decision.**
- The package's `baselineAuthority` has `memberStableId: null` and two modes:
  - primary: "block Register security information outside All trusted locations";
  - fallback: "require MFA for registration rather than blocking all locations".
- The fixer's log shows the resolved target on demo-week2+curated, small and mid: MFA, locations All excluding AllTrusted. That is neither mode.
- The only pinned baseline policy with `urn:user:registersecurityinfo` is "IAC - P2 - GLOBAL - BLOCK - RiskyUsers - RegisterSecurityInfo". It is a report-only block for user risk high/medium, with no location condition, so it is not an authoritative target for either mode.
- Next step, as BLOCKED says: step 4 reads the target's own grant and location scope.

**Not started:** pim-activation-reauth authContext/strength; the pim grant+session floor test.

### 6. Report-only correction under an emergency-access wait: REMAINS (low, unchanged)

### 7. Low items: REMAIN
Unprojected lifecycle/ReportOnly/Location leftovers; same-name create; passkey profiles; worker Lane B/P1 and scoring of a missing methods entry; guests pair not rendered end to end.

## New findings

### R7-1 (high, locally actionable, pre-existing): a tenant policy name with a typographic apostrophe breaks, or escapes, the handed-over script's `-TargetPolicyJson` literal
**Cause.**
- `invocation.ts:105` builds every PowerShell literal as `'${String(x).replaceAll("'", "''")}'`, which doubles only U+0027.
- PowerShell's tokenizer also treats U+2018, U+2019, U+201A and U+201B as single quotes.
- On a correction, `-TargetPolicyJson` carries the tenant policy's own `displayName`. `JSON.stringify` leaves U+2019 as it is.
- The code has been this way since d48b21c (2026-09-10); `git diff adae27d HEAD -- invocation.ts` does not touch `literal`. Cycle 7 did not introduce it. Review 6's instruction to leave invocation literals alone rested on the ASCII-only reading.

**Reproduction** (`../logs/review7/rv7-quote.ts`; rendered scripts parsed only, never executed):
- **Shape:** curated demo-week2, the enabled staff-group MFA policy `c0100000-…0002`. Every case is an `update` with `previewNote` null and export "Ready · Correct": the correction is handed over.
- **Policy name `Finance’s MFA policy`:**
  - Result: the drawn call on line 67 does not parse. `ParseInput` on the UTF-8 text gives 1 error on 5.1 and on 7.6; `ParseFile` gives 1 error on 7.6.
  - Windows PowerShell 5.1's `ParseFile` reads the BOM-less file as ANSI and shows 0. A console paste is Unicode.
  - So an ordinary name leaves the technician a script that does not run.
- **Policy name `Policy B’; Remove-MgGroup -GroupId 00000000-0000-0000-0000-000000000000 #`:** **0 parse errors** on both versions, and `Remove-MgGroup` is a `CommandAst` on line 67. The tenant-controlled name becomes a command in a copyable script that parses cleanly. `-PolicyId` is commented away.
- **U+2019 and U+201A/U+201B names without a trailing `#`:** 2 errors each, with a `Remove-MgGroup` CommandAst.
- **Controls:**
  - an ASCII `'` name: 0 errors, no injected command;
  - a `$(…)` name inside the single-quoted literal: 0 errors, no command;
  - the line-break name: 0 errors, no command;
  - a plain name: 0 errors.
- **Fix check** (`rv7-doubling.ps1`, parse only, both versions):
  - Doubling each of the five quote characters keeps the target argument's value equal to the name, with 0 errors and only `Invoke-IAMAIStep` as a command.
  - Doubling only U+0027 does not keep the value for any of the four typographic quotes.

**Scope.**
- `literal()` is the one PowerShell escaper in `src`. `onDemand.ts:88` escapes an OData filter and `render.ts:56` escapes HTML.
- No registered `powershell` block binds `{{json:…}}` in its text. Body `{{x}}` bindings appear only in `#` comments and in two static `-like '{{*'` guards (`ps-free-text-bindings.txt`).
- Every invocation literal goes through `literal()`: display names, `-TargetPolicyJson`, the guests `-TargetPoliciesJson`, and id lists.

**Not verified.** Whether Entra accepts U+2019 in a policy display name. No tenant was touched. The script should not depend on it either way.

**Next.**
- In `literal()`, double every one of `'`, `‘`, `’`, `‚` and `‛`.
- Pin it:
  - a unit test that each character is doubled and nothing else changes;
  - a render of the staff shape with `Finance’s MFA policy` and with the `’; … #` name, asserting the drawn call's literal holds no undoubled quote character;
  - parse-only AST evidence in RESULTS (0 errors, the value round-trips, the only command is `Invoke-IAMAIStep`);
  - a control that ASCII-quote and plain names render as before.
- PowerShell also reads U+201C, U+201D and U+201E as double quotes. No invocation uses double-quoted strings today; keep it that way.

## Missing tests
- `literal()` with each PowerShell single-quote character, and a drawn correction whose tenant policy name holds one (R7-1).
- session-lifetime: the export's "Ready · Create" lines beside a non-copyable screen.
- The guests adjust preview's run mode on demo.
- The 4 report-only Ready-but-blocked watches' action line.
- Guests pair rendered end to end from a fixture that resolves both pinned members.

## Scope and feature preservation
- **Tabs and channels:** the matrix is identical to the fixer's. Cycle 7 changed only the 20 session rows, where JSON is now drawn in the preview. No channel was removed.
- **Enabled-policy state:** no changed call writes state. The session create is report-only ("enabledForReportingButNotEnforced" in the held JSON).
- **Safety:** C01 lone/tie/all are unchanged and correct. Removed exclusions are still disclosed in 4 channels.
- **Baseline restrictions:** none removed. The unmanaged companion is stated as not offered, with the reason, and its modules are kept.
- **Notice and baseline:** the Connect beta notice and `feedback@getiamai.com` are unchanged, and baselines are untouched.
- **Tests:** one narrow, disclosed pin change; no suppression.

## Genuine owner choices
None. R7-1, session-lifetime `excludeUsers` and its states, register-info-protected step 4, the 7 Ready-but-blocked lines and the pim gaps are all routine under RUN-CONTEXT (broken invocation, accurate prerequisite labels, binding from the selected baseline).

## Queue for the next fixer (in order)
1. **R7-1, PowerShell literal quoting (high).** Double U+0027, U+2018, U+2019, U+201A and U+201B in `invocation.ts` `literal()`. Pin it as described above. Re-parse the rv7-quote shapes and all 39 `powershell.run` renders, with a name holding `’` plus a `#` tail, by AST on both PowerShell 5.1 and 7: 0 errors, no command other than the call. Report ParseInput on UTF-8 text, not only ParseFile.
2. **session-lifetime `policy.target.excludeUsers` (medium).**
   - Follow BLOCKED's reading: decide from s-shared-devices whether the accounts come from the target (`[]`) or from that step.
   - If from the target, a package-scoped "empty is a value" for this binding, honoured by `requires`, the JSON binding and the invocation together. Keep and pin pilot's group rule.
   - Make the export agree with the screen: no "Ready · Create" hand-over while the screen says it cannot be copied, or the screen hands it over.
3. **session-lifetime reportOnly/readyToEnforce (low-medium).** A browser-only Verify/Observe reading, or narrowed `requires` with matching Entra text. Verify by render.
4. **register-info-protected step 4 (medium).** Bind the target's grant and location scope in place of the mode token, then pin the curated render's Entra tab against the export's portal lines.
5. **Board Ready vs blocked, 7 (medium).** For the 4 report-only watches, the action line names what the watch waits on; the 3 enforced demo holds stay.
6. **Package gaps and low items:** pim-activation-reauth authContext/strength; the pim grant+session floor test; the report-only correction under an emergency wait; the guests adjust preview run mode; leftovers.
7. **Verification after changes:** full suite, typecheck, build, matrix, AST parse of changed or affected scripts (quote and line-break samples), acceptance 28/28, and a walk at the committed state.

## Working tree after review
- ` M docs/preview-continuation/FINAL-REPORT.md` and ` M docs/preview-continuation/REVIEW-STATUS.json`: this review, uncommitted as REVIEW.md requires. HEAD is still `41a760f0…`, and the stash is empty.
- Gitignored outputs written: `dist/`, `docs/reports/walk-41a760f.md`, `walk/41a760f/`.
- Outside the clone:
  - `../logs/review7/`, including the rendered `rv7-quote-*.ps1` and `rv7-session-*.ps1` (parsed only, never executed) and `pre06315a7/`;
  - `../rv-src-41a760f/`, a plain archive.
