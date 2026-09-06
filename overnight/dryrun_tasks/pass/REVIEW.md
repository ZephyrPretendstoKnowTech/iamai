# Synthetic PASS reviewer rubric
## User-facing outcome
Prove the runner can carry one no-source-change Claude commit through push, exact-SHA CI/deploy and real reviewer PASS.
## Load-bearing invariants
No tracked file diff; main pushed; exact SHA CI/deploy successful.
## Security / data-safety
Any tracked product change is BLOCKER for this harness.
## Functional acceptance
PASS when the empty commit has healthy exact-SHA evidence and no tracked diff.
## Required regressions
None beyond exact-SHA CI/deploy; this is infrastructure.
## Severity
Use the global severity contract. CLEANUP must not cause correction.
## Outside scope
Product review or product edits.
