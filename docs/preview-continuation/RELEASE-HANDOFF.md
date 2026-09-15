# Release handoff: preview-continuation

Prepared 2026-09-14 for the owner's push decision. This document approves nothing. No push, merge, deploy, workflow run or tenant access was performed.

## Candidate
| Item | Value |
|---|---|
| Code commit tested | `1954a2ca3906e74f97296105a961adad9b399794` (branch `preview-continuation`) |
| Base | `c65d9f4` = `origin/main` (verified with `git ls-remote` on 2026-09-14; ancestor of the candidate) |
| Range | 101 commits, no merges; 299 files, +11,433 / −1,926 |
| Change-scope lock (`node scripts/check-change-scope.mjs --range c65d9f4..HEAD`) | exit 0, "101 commit(s) … OK" |

This handoff is committed on top of the tested code commit as a docs-only commit. `git log` records its hash.

## Completed fixes and evidence
| Fix | Commit | Evidence |
|---|---|---|
| Owner's five-status contract (lanes, board, step view, export) | `8beafe8` | Full suite at `275a54c`: exit 0, 2777 · 2775 pass · 0 fail · 2 skipped. tsc 0. Build 0. Snapshots regenerated |
| Guest-pair correction and enforcement JSON as guarded Graph batches | `275a54c` | Same full suite. Matrix: 1 expected row. Acceptance 28/0/0. Offline walk exit 0 with 0 P0 |
| Duplicate batch target compared case-insensitively | `1954a2c` | New test fails on the pre-fix code. Targeted 23/23 and tsc 0 at `1954a2c`. Full suite not rerun: the change only affects `$batch` JSON validation |
| Earlier: register step 4 binding, export note, session-lifetime browser policy, guests create batch, R11-1 escapes | `467bc0d`…`0488675` | `FOCUSED-COMPLETION.md` |

Logs are outside the clone: `../logs/fc/`, `../logs/ft/`, `../logs/fg/`.

## Historical reviews
`FINAL-REPORT.md` and `REVIEW-STATUS.json` are the cycle 11 independent review of `19ea218`, with status **CONTINUE**. They are committed unchanged as historical evidence. No independent review has been run on `8beafe8`, `275a54c` or `1954a2c`.

## Remaining defects, gaps and deferred work
**Confirmed defects:** none known open in the fixed areas.

**Incomplete checks:**
- No independent review of the last three code commits.
- Full suite, build, walk and matrix were not rerun at `1954a2c`. They were run at `275a54c`; the later change is one comparison inside the batch guard plus its test.
- The PowerShell AST parse was reused from `b5e7185`. The script block and its bindings have not changed since.
- The Security Defaults cutover pair can show On Hold on both sides; no test covers it.

**Walk at `275a54c`: 0 P0, 491 P1, 50 P2.** The P1s are mostly not confirmed defects:

| Kind | Count | Classification |
|---|---|---|
| Visible control not in a page contract's allow list | 387 | Harness warning (contract upkeep). Not verified as defects |
| Sentence over 25 words | 89 | Copy-style warning |
| A lead line with nothing listed under it (Dormant Accounts, Exclusions Group) | 5 (2 distinct) | **Unverified, possibly real rendering defects**; not inspected |
| Throttled first load 4.7 s (over 2 s) | 1 | Performance warning |
| P2: Learn links not checked (network blocked), contract-question length | 50 | Harness or unverified |

The P1 drop from 495 to 491 was not investigated.

**Deferred work:**
- PIM gaps
- Report-only correction under an emergency wait
- Guests adjust run mode
- Session `excludeUsers` hold
- Export note for a confirmation-only hold
- L9-1 and L9-3 (not reproduced)

**Batches are not atomic:** the guest-pair JSON does not include the PowerShell script's pre-checks and rollback.

## Queued content-review tasks (`docs/content-review/SEGMENTS.md`)
All of these ran on `main` before `c65d9f4`. None ran in this candidate.

| Segment | Status |
|---|---|
| S0: renderer fixes R1–R9, UI polish U-P1–U-P3 | Ran (commits R1–R9, U-P1–U-P3, plus D1–D5) |
| S1: content patterns C1–C5 | **No commit found. Not evidenced as run** |
| S2–S5: 20 per-step specs | Ran (one commit each) |
| S6: pim-activation-reauth, register-info-protected, all-users-no-persistence, block-unsupported-platforms, geo-restriction | **Never started** |
| S7: user-risk-medium, notAssessed, rename-policies, separate-accounts, allowed-countries | **Never started** |

## Verdicts
**Ready for owner approval to push `preview-continuation` as a review branch: YES, conditionally.** The tree is committed. The push is a fast-forward of `origin/main` with no divergence. The change-scope lock passes. Push the branch, not `main`. On a non-main branch only `ci.yml` runs (typecheck, unit tests, build, smoke). `deploy-pages.yml` and `external-health.yml` run only on `main`.

**Ready for public deployment (merge or push to `main`): NO.** A push to `main` runs `deploy-pages.yml`: the walk, then the build, then publication to getiamai.com (`public/CNAME`), stopped only by a walk P0. Blockers:
1. There is no independent review of the final three code commits. The last review, cycle 11, reads CONTINUE.
2. The five "nothing listed under it" walk findings are not inspected.
3. Content segments S6 and S7 never started, and S1 is unevidenced.
4. CI has not yet run on this candidate.
