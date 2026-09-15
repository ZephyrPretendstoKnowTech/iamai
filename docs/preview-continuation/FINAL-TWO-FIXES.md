# Final two fixes (from 0488675)

No push, deploy, tenant access, dependency change or script execution. This does not approve the earlier independent review.

## State
- **Commits:** `8beafe8` (Task 1, with snapshots), `275a54c` (Task 2). HEAD is `275a54c` on preview-continuation.
- **Uncommitted, preserved as found:** `FINAL-REPORT.md`, `REVIEW-STATUS.json`, `FOCUSED-COMPLETION.md`, and this file.

## Task 1: owner's five-status contract. Verdict: FIXED
Classification changed; policy operations did not. `lanes.ts` derives the lane from the facts about the next action. The board, the step view and the export all read that one result.

| Case | Before | Now |
|---|---|---|
| Enforced drift, unmapped reference (demo: 3 policies) | Ready · Correct | On Hold · Baseline references an unmapped group |
| Correction behind a Ready decision (large: managed device) | Ready · Correct | Up Next · After Decide How Devices Are Managed |
| Report-only, collecting evidence (week2 intune; admins threshold) | Ready · Observing | On Hold · Observing |
| Window closed, records read, not yet cleared | Ready · Observing | Ready · Review. Enforce is not offered |
| Prerequisite Ready to create, but reaching "enforced" needs observation | Up Next | On Hold · After <step> |
| Deeper prerequisite (token protection) | Up Next | On Hold · After Exclusions Group |
| Deferred prerequisite | On Hold | unchanged, satisfies nothing |
| Emergency access short of hardening | Ready · Observing | Ready · Correct |

Readiness to enforce still comes from the tracker's two gates, so elapsed time alone never makes a policy Ready to enforce. U21 and the "On Hold needs an abnormal blocker" rules were replaced in tests. No Watching status was added. Content keys added: `substatus.review`, `bar.review`.

## Task 2: guests pair correction/enforcement JSON. Verdict: FIXED
`batchRequests` extends the identity guard into `$batch` sub-requests:
- Each sub-request is one pinned member, used once.
- A POST may only create in the policies collection.
- A PATCH may only target its own role's bound `current.id`, which must be a GUID not targeted by another sub-request.
- Any other method or url, or a body naming an id, is refused.

What the JSON now does:
- **Correct:** two PATCHes with displayName, conditions, grantControls and sessionControls, and no state. This matches `CorrectPair`.
- **Enforce:** two PATCHes with only `state: enabled` on the same ids as `EnforcePair`.
- **Unresolved member:** the JSON is withheld on that member's id.
- **Create:** unchanged.

Batches are not atomic. The script keeps its own pre-checks and rollback.

## Verification (logs `../logs/ft/`)
| Check | Exit | Result |
|---|---|---|
| tsc (`tsc-4.txt`) | 0 | no output |
| Full `npm test` (`full-1.txt`) | 0 | 2777 · 2775 pass · 0 fail · 2 skipped |
| Build (`build-1.txt`) | 0 | chunk-size warning only |
| Matrix vs fc (`matrix-1.txt`, `.diff`) | 0 | 1 row: the guests unanswered preview gains `json:+` (bare stand-ins flag `does-not-parse`, as on 88 existing preview rows). No Entra or PowerShell change |
| Acceptance (`acceptance/`) | 0 | 28 PASS · 0 FAIL · 0 HARNESS_ERROR |
| Walk, offline netblock, dist 275a54c (`walk-1.txt`) | 0 | 0 P0, 491 P1, 50 P2 (was 495 P1); not diffed |
| PowerShell AST | — | NOT RUN. Reused from b5e7185: the script block, invocation and bindings are unchanged |

## Remaining
- The reciprocal Security Defaults cutover pair can now read On Hold on both sides. This is consistent with the contract but has no dedicated test.
- The walk's P1 change (495 → 491) was not investigated.
