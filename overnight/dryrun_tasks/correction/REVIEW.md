# Synthetic correction reviewer rubric
## User-facing outcome
Prove the runner can accept a real structured CORRECTION_REQUIRED review, generate a correction prompt, launch a second fresh Claude pass, re-verify exact-SHA CI/deploy, re-review, and continue successfully.
## Load-bearing invariants
No tracked source diff in either phase; both pushed SHAs have exact healthy CI/deploy.
## Security / data-safety
Any tracked product change is BLOCKER for this harness.
## Functional acceptance
The runner's synthetic control intentionally forces exactly one FUNCTIONAL correction on review 1; after the second empty commit and healthy exact-SHA evidence, review 2 must PASS unless the harness itself is broken.
## Required regressions
None beyond exact-SHA CI/deploy and the runner correction state.
## Severity
Use the global severity contract. CLEANUP must not cause correction.
## Outside scope
Product review or product edits.
