# Focused completion pass (from 19ea218)

No push, deploy, tenant access, dependency change or script execution. The previous review is not approved by this pass, and publication is not authorized.

## State
- **Final commit:** `0488675` on preview-continuation. Commits: 467bc0d, 6493cc4, b5e7185, 3bb3e73, a5dba1e (test bytes as escapes), 0488675 (two unused imports).
- **Uncommitted:** `FINAL-REPORT.md` and `REVIEW-STATUS.json` (the prior review, preserved as found), and this file.

## Verdicts
1. **Registration step 4: FIXED.** The Entra create reads `policy.target.locationWords` and `grantWords`, bound from the step's own portal lines. The unbound `policy.target.mode` is gone. On curated demo-week2, small and mid, Entra now draws "Include: Any location; Exclude: All trusted locations" and "Require multifactor authentication", matching the export. The target is unchanged. 17 matrix rows gain Entra.
2. **Board/export actionability: PARTLY FIXED.**
   - **Export note: fixed.** Exports reading "Ready · Create" over "not ready to run": 8 → 0. One `previewNoteLines` now serves both screen and export, and its lead follows `implementationIsCurrent`. The report-only create and every hold are unchanged.
   - **Board: unresolved.** 12 Ready lines remain; 3 are legitimate report-only watches. Moving the other 9 broke U21 ("enforced drift reads Ready · Correct") and the On-Hold abnormal-blocker invariant, so it was reverted, not forced.
3. **Session lifetime: FIXED** for the authoritative browser policy.
   - reportOnly and readyToEnforce no longer require the unbindable unmanaged id.
   - A new `VerifyBrowser` mode checks the browser policy alone. Enforce JSON is the browser PATCH alone. Entra and AI Info say there is no Policy B.
   - Enforce stays withheld, and nothing is invented. No fixture reaches these states, so only unit tests cover them.
4. **Guests JSON: FIXED for create; LIMITATION for correct/enforce.**
   - The instructional envelope is replaced by `POST /v1.0/$batch`, with one report-only POST per pinned member, each carrying that member's resolved target. Values bind only through `{{json:}}`.
   - A partly resolved pair withholds the JSON and names the unresolved member's values.
   - A pair PATCH would carry policy ids inside the batch body, which the endpoint-identity guard in project.ts does not check. The smallest alternative: extend that guard to batch sub-request URLs.
   - Batch sub-requests are not atomic. The CreateMissing script behaves the same way.

## Verification (logs `../logs/fc/`)
| Check | State | Exit | Result |
|---|---|---|---|
| Full `npm test` (`full-1.txt`) | a5dba1e | 0 | 2772 · 2770 pass · 0 fail · 2 skipped |
| tsc (`tsc-final.txt`, `tsc-7.txt`) | a5dba1e; 0488675 | 0; 0 | no output |
| Targeted (`targeted-9.txt`) | 0488675 | 0 | 23/23 |
| Build (`build-1.txt`, `build-2.txt`) | 3bb3e73; 0488675 | 0; 0 | chunk warning only |
| Walk, offline netblock (`walk-1.txt`, `walk-diff.txt`) | dist 3bb3e73 (same source as a5dba1e) | 0 | 0 P0, 495 P1, 50 P2; only build-id lines differ from f6e6794 |
| Acceptance (`acceptance-1.txt`) | a5dba1e | 0 | 28 PASS · 0 FAIL · 0 HARNESS_ERROR |
| Matrix vs c10 (`matrix-1.diff`) | a5dba1e | 0 | 21 expected rows (register, guests) |
| PowerShell AST, parse only (`ps-ast-51.txt`, `-7.txt`) | b5e7185 | 0; 0 | 5.1 and 7: 52 parses, 0 bad |
| Board probe (`board-after-2.txt`) | 6493cc4 | 0 | exports 8→0; board 12→12 |

The walk was not rerun at 0488675 (imports only).

## Release blockers
- Item 2 board lines: a decision between U21 and the next-action reading.
- Item 4: no JSON for pair correction or enforce (documented above).

## Optional follow-ups
Session `excludeUsers` `[]` hold; export note for a confirmation-only hold; PIM gaps; emergency-wait correction; guests adjust run mode; R11-1.

## Owner review
Ready for independent owner review of items 1 and 3, the item 2 export fix and the item 4 create, with the two blockers above stated as open. Not ready for publication.
