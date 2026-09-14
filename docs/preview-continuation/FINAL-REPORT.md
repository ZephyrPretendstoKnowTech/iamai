# Final report: continuation cycle 9, fresh review

**Status: CONTINUE.** Not ready for owner review. This report does not authorize publication, merge or deployment. No push, deploy, tenant action, script execution or external write was made.

## Identity
| Item | Value |
|---|---|
| Reviewed HEAD | `0ec26c7525788cc8dbf71aa5fe341c8945efdbfe` (branch preview-continuation) |
| Cycle 9 commits | c840800 (cycle 8 ledger and review docs, verbatim); 0989d8a (code: `invocation.ts`, `project.ts` one argument, `quotedNameLiterals.test.ts` modified); ea2e223, 0ec26c7 (docs only) |
| Code state | `git diff 0989d8a HEAD` outside `docs/preview-continuation` is 0 lines, so evidence at 0989d8a is evidence for HEAD's code |
| Dirty tree at review start | none (`git status --porcelain` empty); stash empty. The fixer's ledger commit was made this time |
| Dirty source/test entries | none |
| Reviewer edits | this report and REVIEW-STATUS.json only; nothing committed |
| Logs and probes | `../logs/review9/`, outside the clone: `full.txt`, `tsc.txt`, `acceptance.txt` + `acceptance/`, `nonvacuity.txt`, `hold-export-*.txt`, `s5-lone.txt`, `rv9-tok.ps1`, `tok-ps51.txt`, `tok-pwsh.txt`, `nonascii-ps.mjs`/`.txt` (vacuous, see below) |
| Reviewer copy | `../rv9-src-0ec26c7`, a plain `git archive HEAD`, used for acceptance |

## Checks run by the reviewer (exact code state: HEAD, clean tree)
| Check | Command / state | Result |
|---|---|---|
| Full suite | `npm test`, 13:46–13:49:59 (acceptance and typecheck ran alongside) | exit 0: **2760 tests · 2758 pass · 0 fail · 0 cancelled · 2 skipped**, the same totals as the fixer's `c9/full-2.txt`; the skipped tests' names were not re-read (`full.txt`) |
| Typecheck | `npx tsc --noEmit` | exit 0, no output (`tsc.txt`). This also replaces review 8's unfilled typecheck placeholder |
| Acceptance | `node ../rv9-src-0ec26c7/docs/preview-continuation/acceptance/run-acceptance.mjs ../rv9-src-0ec26c7 ../logs/review9/acceptance`; harness identical by `cmp` | **28 PASS · 0 FAIL · 0 HARNESS_ERROR**, exit 0 |
| C01 original | `s5-lone-group-admins.ts`; `SHAPE=lone\|tie\|all r2-hold-export.ts` | exit 0 ×4, **0 diff lines** each against review 8's logs (lone `create-report-only`; tie executable `correct`; all `correct`, not executable) |
| Non-vacuity (independent rerun) | HEAD's `quotedNameLiterals.test.ts` (confirmed identical by `cmp`) in `../c9-nv-c840800`, whose `invocation.ts` equals `c840800`'s by `cmp` | exit 1, **2 of 2 fail** (`nonvacuity.txt`) |
| PowerShell reparse (reviewer's own script) | `rv9-tok.ps1`: `Parser::ParseFile` over the fixer's 33 BOM-less renders (`c9/ps-invoke` 26, `c9/quote-after` 7) on Windows PowerShell 5.1.26100 (ANSI read) and PowerShell 7.6.6 | both: `files=33 bom=0 parseErrors=0 badTopLevel=0`. Every top-level statement other than a function definition is an `Invoke-IAMAIStep` command. **No non-comment token contains a character above U+007E** on either version (`tok-ps51.txt`, `tok-pwsh.txt`). Parse only; nothing executed |
| Fixer render ASCII claim | `grep -a '^Invoke-IAMAIStep'` over the same files | 168 call lines, 0 containing a character outside 0x20–0x7E |
| Walk | not re-run (budget). The fixer's walk at 0989d8a (same code as HEAD) completed: `c9/walk-1.txt` ends `exit 0` at 13:45:07; `docs/reports/walk-0989d8a.md` exists and reads "Verdict: show-ready on this walk (no P0). 495 P1, 50 P2." | Read, not reproduced. This is the first completed walk since cycle 7 |
| Matrix | not re-run. The fixer's matrix at the raw-regex tree had 0 diff lines against cycle 8; the final tree differs only in how the two regex ranges are spelled | Read, not reproduced |
| Test edits | `git diff c840800 HEAD -- '*.test.ts'` | one modified file (quotedNameLiterals), disclosed in RESULTS; no `.skip`, `.only` or todo |
| Scope | `git diff c840800 HEAD` over package.json, lockfile, .github, scripts, docs/design/content.json, docs/qa/page-contracts.json | 0 lines; content.json still carries `mailto:feedback@getiamai.com` (1 match) |

## Queue verdicts (review 8 queue)

### 1. Commit the cycle 8 ledger and review: DONE (c840800)
The commit carries review 8's unfilled placeholders (`WALK_ROW` in the report's walk row, `WALK_TSC` in REVIEW-STATUS). The fixer disclosed this in RESULTS. The typecheck above and the fixer's completed walk replace the missing evidence.

### 2. R8-1, ASCII-only invocation lines: FIXED
- **Code read.** `literal(v, json)`:
  - For a parameter bound to a `.json` binding, every UTF-16 unit U+007F–U+FFFF becomes `\uXXXX` inside the one single-quoted JSON literal. Surrogate pairs become two escapes, which JSON decodes back to the character.
  - Other text becomes `('' + [char]0xXXXX + '…')`, starting with a string so `+` concatenates. U+0027 is doubled. ASCII-only values render exactly as before.
  - The JSON choice follows the declared binding name, not the value.
- **Test.** `quotedNameLiterals.test.ts` asserts that the call line is ASCII and reads each text, list item and JSON value back through a small tokenizer model. The cases are the five quotes, `Ñ Ò Â Б В €`, U+2011, U+2012, an astral character and `Équipe – “Staff”`. The test also pins exact forms, an ASCII control and a stand-in control, and covers the handed-over staff correction with the four R8-1 names. Removing the old exact typographic-doubling pins is correct: those pinned the ANSI-unsafe form. Reviewer rerun on the pre-fix source: 2 of 2 fail.
- **Evidence.** The reviewer's 5.1/7 `ParseFile` pass (above) gives 0 errors, only `Invoke-IAMAIStep` at top level, and no non-ASCII outside comments. It covers all 26 invocation-bearing scripts and the 7 staff-correction cases. So the template code bodies of those 26 scripts are also ASCII outside comments, and a BOM-less 5.1 read cannot turn a template string's own dash into a quote.
- **Body bindings (the fixer's closure).** Tenant text bound into template bodies sits in `#` line comments, and in Windows-1252 no UTF-8 continuation byte decodes to CR or LF. I accept this for the default Western code page.

### 3–6. REMAIN, not started in cycle 9
- register-info-protected step 4 (medium): the binding plan in BLOCKED (cycle 8 entry) stands.
- Board/export Ready vs blocked (medium): 7 lane lines, and 9 exports reading "Ready · Create" above "It is not ready to run". Lane probe not re-run; no lane or export code changed.
- session-lifetime reportOnly/readyToEnforce (low-medium).
- pim-activation-reauth authContext/strength and the grant+session floor test; report-only correction under an emergency-access wait; the guests adjust preview's run mode; unprojected lifecycle/ReportOnly/Location leftovers (low).

## New observations (low; none blocks R8-1)
- **L9-1, stand-in branch.** `renderInvocation` draws a stand-in with only U+0027 doubled, so typographic quotes are not doubled there. Stand-ins come from `placeholder(k)` (project.ts:291), which is product text from the binding key, and a preview is never copyable, so no tenant text or copy path is involved. Not verified: that no placeholder string contains U+2018–U+201B.
- **L9-2, C0 controls in text literals.** `NOT_ASCII` starts at U+007F, so a tab or line break in a non-JSON text value stays inside the quotes. It cannot end a single-quoted literal, but it breaks the "ASCII line" property the test asserts. Existing `boundNameLineBreaks` coverage was not re-read for invocation values. The JSON path is safe, because `JSON.stringify` escapes controls.
- **L9-3, non-Western ANSI code pages.** The reasoning for comment-bound tenant names holds for Windows-1252 only. It was not checked for DBCS code pages (932/936/949/950), where a lead byte can pair with the next byte. The rendered comment lines continue with ASCII text after the name, so the worst expected effect is one garbled character. Not verified.
- **Vacuous reviewer probe, disclosed.** `../logs/review9/nonascii-ps.mjs` looked for fenced PowerShell blocks in CONTENT.md and found none, because the packages do not use that format. Its "0" is not evidence. The tokenizer pass over the rendered scripts replaced it.

## Missing tests
- The export's "Ready · Create" state line beside a "not ready to run" note (queue item board/export).
- A preview held only on an unconfirmed prerequisite, in the export (low residual from cycle 8).
- The 4 report-only Ready-but-blocked watches' action line; the guests adjust preview's run mode; the guests pair rendered end to end.
- L9-2: a control character in a non-JSON invocation value.

## Scope and feature preservation
- **Tabs and channels:** unchanged. The code change is limited to invocation literal spelling. The fixer's matrix had 0 diff lines, and the walk shows 0 P0 with the same normalized findings as cycle 7.
- **Enabled-policy state:** no call changes state. C01 lone/tie/all are unchanged and correct.
- **Baseline restrictions, notice, page contracts, walk rules:** untouched. The feedback mailto is present.
- **Tests:** one modified file, its exact pins replaced by stronger read-back and ASCII assertions over a superset of shapes. No suppression.

## Genuine owner choices
None. Every remaining item is routine under RUN-CONTEXT: accurate labels, binding from the selected baseline, and state parity between board and export.

## Queue for the next fixer (in order)
1. **Commit this review** (FINAL-REPORT.md, REVIEW-STATUS.json) after inspection.
2. **register-info-protected step 4 (medium).** Bind the target's location and grant words in place of `policy.target.mode`, following BLOCKED's cycle 8 plan. Pin the curated Entra tab against the export's two portal lines on demo-week2, small and mid. Regenerate registry/LIBRARY.
3. **Board/export Ready vs blocked (medium).** The 7 lane lines, and "Ready · Create" above "not ready to run" in the 9 exported previews. Settle each class inside the existing lane/nextSafeAction readings, without a new rule, and pin it with the lane probe's shapes.
4. **session-lifetime reportOnly/readyToEnforce (low-medium).** A browser-only reading, or requires narrowed together with the Entra observe/enforce text.
5. **Low:** L9-2 (escape or fold C0 controls in non-JSON invocation text, with a test); pim gaps; report-only correction under an emergency wait; guests adjust run mode; leftovers.
6. **Verification after changes:** full suite, typecheck, build, matrix, AST parses (5.1 BOM-less `ParseFile` and 7) where scripts or bindings change, acceptance 28/28, and a completed walk at the committed state.

## Working tree after review
- ` M docs/preview-continuation/FINAL-REPORT.md` and ` M docs/preview-continuation/REVIEW-STATUS.json` (this review). Nothing committed; HEAD unchanged.
- Outside the clone: `../logs/review9/` and `../rv9-src-0ec26c7/` (plain archive). No gitignored outputs were written by the reviewer: no build and no walk were run.
