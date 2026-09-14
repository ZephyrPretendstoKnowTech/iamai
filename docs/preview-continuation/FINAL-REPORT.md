# Final report: continuation cycle 8, fresh review

**Status: CONTINUE.** Not ready for owner review. This report does not authorize publication, merge or deployment. No push, deploy, tenant action, script execution or external write was made.

## Identity
| Item | Value |
|---|---|
| Reviewed HEAD | `84cd4316ea5562d146dcf8e9c42916911e63e7c8` (branch preview-continuation) |
| Cycle 8 commits | 7130d3c (cycle 7 review docs); 2b4e795, 84cd431 (code). The source/test diff `41a760f..HEAD` is invocation.ts, stepExport.ts and 2 new tests (quotedNameLiterals, previewExportNote) |
| Dirty tree at review start | ` M docs/preview-continuation/BLOCKED.md`, ` M docs/preview-continuation/RESULTS.md`: the fixer's cycle 8 ledger. RESULTS says "the docs commit carrying this ledger and BLOCKED", but that commit was not made. Inspected (docs only, +96 lines) and preserved, not committed. Stash empty |
| Dirty source/test entries | none |
| Reviewer edits | this report and REVIEW-STATUS.json only; nothing committed |
| Logs and probes | `../logs/review8/`, outside the clone: `full.txt`, `build.txt`, `acceptance*`, `walk.txt`, `s5-lone.txt`, `hold-export-*.txt`, `export-lane.txt`, `rv8-ast.ps1`/`ast-reparse.txt`, `enc/` (R8-1) |
| Reviewer copy | `../rv8-src-84cd431`, a plain `git archive HEAD` used for acceptance. (A `rm -rf` of an older path was denied, so a new directory name was used; nothing was deleted) |

## Checks run by the reviewer (exact code state: HEAD, clean source)
| Check | Command / state | Result |
|---|---|---|
| Full suite | `npm test`, 13:23:37–13:27:01 | exit 0: **2760 tests · 2758 pass · 0 fail · 0 cancelled · 2 skipped** (the Learn-link external health check and HUGE=1, as before). Same totals as the fixer's `c8/full-2.txt`. The 3 new tests are among the passes |
| Build | `npm run build` | exit 0, chunk-size warning only (`build.txt`) |
| Acceptance | `node ../rv8-src-84cd431/docs/preview-continuation/acceptance/run-acceptance.mjs ../rv8-src-84cd431 ../logs/review8/acceptance`; harness identical by `cmp` | **28 PASS · 0 FAIL · 0 HARNESS_ERROR**, exit 0 |
| Walk | WALK_ROW |
| C01 original | `s5-lone-group-admins.ts`; `r2-hold-export.ts` SHAPE=lone/tie/all | exit 0 each, **0 diff lines** against review 7's logs (lone: `create-report-only`; tie: executable `correct`; all: `correct`, not executable) |
| Board lane | `c2-export-lane.ts` | `{"steps":107,"boardReadyBlocked":7,"noLaneReadyBlocked":7}`, unchanged |
| PowerShell reparse | the reviewer's own `rv8-ast.ps1` (`ParseInput` on UTF-8 text) over the fixer's `c8/quote-after` (8) and `c8/ps-invoke` (26) renders, on Windows PowerShell 5.1 and PowerShell 7 | 68 of 68 parses have 0 errors, no `Remove-*`/`Set-*` command, and nothing at top level except `Invoke-IAMAIStep` calls (`ast-reparse.txt`). These are the fixer's rendered files, reparsed; the renderer itself is pinned by the new unit test |
| Non-vacuity | the fixer's `c8/nonvacuity-1.txt`, `-2.txt` (pre-cycle source `c8-nv-7130d3c`) read | quotedNameLiterals 2 of 2 fail and previewExportNote 1 of 1 fails on the old source, for the stated reasons. Not re-run by the reviewer |
| Test edits | `git diff --diff-filter=M 41a760f HEAD -- '*.test.ts'`; a grep for skip/only/todo in the new tests | no modified test file; two added; no `.skip`, `.only` or todo |
| Scope | `git diff --stat 41a760f HEAD` over package.json, lockfile, .github, vite/tsconfig, data, baselines, src/feedback.ts, scripts, docs/design/content.json, docs/qa/page-contracts.json | empty. content.json still has `mailto:feedback@getiamai.com` |

## Fixer evidence gaps
- **Walk at 84cd431 was not completed by the fixer.** RESULTS lists `docs/reports/walk-84cd431.md` and `walk/84cd431/` as written. The report file does not exist. `walk/84cd431/` holds only `home`, `demo` and `demo-week2`. `c8/walk-1.txt` ends at "walk: walking demo-week2" with no exit line, and no walk process was still running at review start. The verification table has no walk row. The reviewer's walk above replaces it.
- The fixer's ledger commit it describes was not made (see Identity).

## Queue verdicts (review 7 queue)

### 1. R7-1, typographic single quotes in invocation literals: FIXED (for text read as Unicode)
- `invocation.ts` `literal()` now doubles U+0027, U+2018, U+2019, U+201A and U+201B (`SINGLE_QUOTES`, `'$&$&'`). This is PowerShell's single-quote set. Nothing else changes, and invocations still use no double-quoted strings.
- Evidence read: the fixer's before/after AST logs, and the reviewer's own reparse (above). The new unit test round-trips the literal the way the tokenizer reads it, and the handed-over staff correction carries `Finance’s MFA policy` and `’ … #` names. Both fail on old source and pass at HEAD.
- **But:** the fix holds only when the script text is decoded as Unicode. See R8-1: the same class of break-out comes back when a copied script is saved without a BOM and run in Windows PowerShell 5.1.

### 2. session-lifetime `excludeUsers`: the hold is kept (reading confirmed); export disagreement FIXED
- **Reading.** The fixer kept `[]` as not-a-value because the package asks for "the resolved shared-device accounts" and gates on the complete set. That is consistent with the package text quoted in BLOCKED. The reviewer agrees: an empty pinned list says nothing about the tenant's shared-device accounts.
- **Export.** `stepExport.ts` `previewValueLines` appends the screen's own preview note after the portal walk-through, only when the package preview holds on missing bindings.
  - The first line uses the same condition as `stepBody.ts:295`, and the values line has the same form as `stepBody.ts:296`.
  - It passes `{}` confirmations. `packageRuntime` uses confirmations only to mark prerequisites satisfied (`stepPackage.ts:594-596`), so missing bindings do not depend on them. The export therefore cannot add the note where the screen would copy.
  - The fixer's `export-diff-summary.txt` covers 283 steps: 10 changed, `changedOtherThanNote: 0`, no line removed, order kept.
- **Remaining.** In 9 of those 10 exports, the state line still says "Ready · Create" directly above "It is not ready to run, so it cannot be copied yet." The lane engine is unchanged. This is the same issue as the board Ready-vs-blocked item (queue 5) and is not new.
- **Residual (low, as the fixer states):** a preview held only on an unconfirmed prerequisite would export its walk-through without the note. No fixture has one.

### 3. session-lifetime reportOnly/readyToEnforce: REMAINS (not started)
### 4. register-info-protected step 4: REMAINS (not started; the fixer's render facts and binding plan in BLOCKED are concrete and consistent with review 7)
### 5. Board Ready vs blocked (7): REMAINS (lane probe 7/7, unchanged)
### 6. Package gaps and low items: REMAIN (pim-activation-reauth authContext/strength, the pim grant+session floor test, report-only correction under an emergency wait, guests adjust preview run mode, leftovers)

## New finding

### R8-1 (medium-high, locally actionable, pre-existing): a tenant name with an ordinary non-ASCII letter breaks, or escapes, the handed-over script's literal when the script is saved without a BOM and run in Windows PowerShell 5.1
**Cause.**
- Scripts leave the app only by Copy (clipboard). `exportDownload` is never called with a script, and no `.ps1` is downloaded. The technician therefore saves the paste to a file, or pastes it into a console.
- Windows PowerShell 5.1 reads a BOM-less `.ps1` in the ANSI code page (Windows-1252 on en-US). Windows 11 Notepad saves UTF-8 without a BOM by default.
- Under Windows-1252, bytes 0x91, 0x92 and 0x82 decode to U+2018, U+2019 and U+201A, which are PowerShell single quotes. UTF-8 produces those bytes for ordinary characters:
  - `Ñ` is C3 91, `Ò` is C3 92 and `Â` is C3 82;
  - Cyrillic `Б` is D0 91 and `В` is D0 92;
  - `€` is E2 82 AC;
  - U+2011 and U+2012 end in 0x91 and 0x92.
- `literal()` doubles only real quote characters, so these bytes reach 5.1 as undoubled quotes.
- Nothing in the scripts or content requires PowerShell 7 or says how to save or run them: no `#Requires` and no edition statement in any rendered `c8/ps-invoke` script, and no such text in `src/content` or content.json.

**Reproduction** (`../logs/review8/enc/`; parse only, never executed):
- **Shape.** The fixer's rendered handed-over correction `c8/quote-after/rv7-quote-control.ps1` (curated demo-week2 staff correction, `-Mode 'CorrectConditions' -TargetPolicyJson '…'`). Its policy name `Policy B` was replaced by exactly what `JSON.stringify` plus `literal()` emit for the new name, since none of these characters is doubled. Files are UTF-8 without a BOM (`rendered-*.ps1`, `rendered-parse.txt`).
- **`Policy Ñ; Remove-MgGroup -GroupId 0000… #`:** 5.1 `ParseFile` gives **0 errors, with `Remove-MgGroup` as a CommandAst** after `Invoke-IAMAIStep`. PowerShell 7 `ParseFile`, and `ParseInput` on UTF-8 text on both versions, give 0 errors and no `Remove-MgGroup`.
- **`В; Remove-MgGroup … #` (Cyrillic):** the same result.
- **`Contraseñas y ACCESO Ñ` (benign):** 5.1 `ParseFile` gives **1 error**, so the saved script does not run. PowerShell 7 gives 0.
- **Minimal stub** (`enc/nobom.ps1`, `enc/parse.txt`): the same result on 5.1, with `Contraseñas MFA` as a harmless control (no `Ñ` uppercase, 0 errors).
- **Not verified.** That Entra accepts these names (ordinary Unicode display names are expected to be accepted); no tenant was touched. How many technicians run 5.1 from a saved file is not measurable here.

**Next (a routine fix of a broken, unsafe invocation; not an owner decision).**
- Make every invocation line pure ASCII whatever the file's decoding:
  - **JSON-typed parameters** (`-TargetPolicyJson`, `-TargetPoliciesJson`): escape every character above U+007E as `\uXXXX` in the JSON text before `literal()`. `ConvertFrom-Json` returns the identical string. Surrogate pairs stay as two escapes.
  - **Text literals and list items:** keep ASCII characters inside `'…'`, and emit any other character through an ASCII-only form that PowerShell decodes to the same string. Example: a parenthesised concatenation with `[char]0x00D1`, applied only when the value has non-ASCII.
- **Do not** add a `#Requires -Version 7` gate or silently drop names.
- **Pin it:**
  - a unit test that the rendered call line is ASCII-only and round-trips `Ñ`, `В`, `€`, U+2011/U+2012 and the five quote characters;
  - parse-only AST evidence of the staff correction on both versions, with 5.1 `ParseFile` on a BOM-less file plus `ParseInput`: 0 errors, the value equals the name, and the only top-level command is `Invoke-IAMAIStep`;
  - repeat over the 26 invocation-bearing scripts with a `Ñ … ; Remove-MgGroup … #` value;
  - keep the existing quote test.
- Template comment/header non-ASCII (e.g. an em dash in line 4) only shows garbled under an ANSI read. It cannot end a line and is not part of this finding.

## Missing tests
- An ASCII-only invocation line under a non-Unicode read (R8-1).
- The export's "Ready · Create" state line beside a "not ready to run" note (tied to queue 5).
- A preview held only on an unconfirmed prerequisite, in the export (low residual).
- The 4 report-only Ready-but-blocked watches' action line; the guests adjust preview's run mode; the guests pair rendered end to end.

## Scope and feature preservation
- **Tabs and channels:** only export text lines were added (10 of 283 steps), plus literal doubling. The fixer's matrix is identical to review 7's (`c8/matrix-2.diff`, 0 lines; read, not re-run: the code change touches no channel projection). No channel was removed.
- **Enabled-policy state:** no call changes state. C01 lone/tie/all are unchanged and correct.
- **Baseline restrictions and notice:** baselines, content.json (feedback mailto present), page contracts and walk rules are untouched.
- **Tests:** additions only, no suppression.

## Genuine owner choices
None. R8-1, the session-lifetime states, register-info-protected step 4, the 7 Ready-but-blocked lines and the pim gaps are all routine under RUN-CONTEXT (broken invocation, accurate labels, binding from the selected baseline).

## Queue for the next fixer (in order)
1. **Commit the fixer's cycle 8 RESULTS/BLOCKED ledger and this review, after inspection.**
2. **R8-1 (medium-high).** ASCII-only invocation literals as above; pin them with a unit test plus a 5.1 `ParseFile` on a BOM-less file and `ParseInput` on both versions, over the staff correction and all 26 invocation scripts.
3. **register-info-protected step 4 (medium).** Follow the binding plan in BLOCKED: target location and grant words replace `policy.target.mode`. Pin the curated Entra tab against the export's two portal lines on demo-week2, small and mid.
4. **Board/export Ready vs blocked (medium).** The 7 lane lines, and "Ready · Create" above "not ready to run" in the 9 exported previews.
5. **session-lifetime reportOnly/readyToEnforce (low-medium).**
6. **Package gaps and low items,** as listed in queue 6.
7. **Verification after changes:** full suite, typecheck, build, matrix, AST parses (UTF-8 and 5.1 BOM-less), acceptance 28/28, and a **completed** walk at the committed state, with its row in RESULTS.

## Working tree after review
- ` M docs/preview-continuation/BLOCKED.md`, ` M docs/preview-continuation/RESULTS.md` (fixer's uncommitted cycle 8 ledger, preserved), ` M docs/preview-continuation/FINAL-REPORT.md` and ` M docs/preview-continuation/REVIEW-STATUS.json` (this review). Nothing committed; HEAD unchanged.
- Gitignored outputs written: `dist/`, `docs/reports/walk-84cd431.md` and `walk/84cd431/` (the reviewer's walk overwrote the fixer's partial capture there).
- Outside the clone: `../logs/review8/` (including rendered `enc/*.ps1`, parsed only, never executed) and `../rv8-src-84cd431/` (plain archive).
