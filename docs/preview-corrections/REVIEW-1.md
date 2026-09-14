# R1 — fresh adversarial review (2026-09-13 22:48 MDT –, in progress)

Reviewer did not implement S0–S4. Candidate HEAD at start 144b6ce, tree clean, `git stash list` empty, no preserved unfinished diff. Compared against audited source c65d9f4. No application code modified in R1. Logs: ../logs/r1/.

## Scope / feature preservation (diff c65d9f4..HEAD)
- 38 files outside docs/preview-corrections; no deleted or renamed files; no change to package.json, package-lock.json, baselines/, .github, scripts/, vite/tsconfig, CLAUDE.md/AGENTS.md.
- Checkpoint: detailed per-finding results follow below as they are established.

## Focused checks (R1)
| Check | Command | Exit | Result |
|---|---|---|---|
| Critical suites | `node --test --test-isolation=none` policyIdentity, tracking.drift, foundationA, foundationB, responseShape, proofChronology, phishingResistant, channelParity, betaNotice, emptyArtifact, mfaAuthContentSpecs, sessionAdminContentSpecs, planVariants (`../logs/r1/focused-1.txt`) | 1 | 214 tests · 213 pass · 1 fail · 0 skipped. Failure: foundationB.test.ts:73 "nothing but lifecycle.ts assigns a status" — `src/graph/collect/http.ts: now 3 assignments, was 2` (S2 e6a73a3 `GraphResponseShapeError`), as recorded in BLOCKED S3 22:27. Still failing at HEAD 144b6ce: a required check is red |

## R1-F1 — C01: a drifted all-users policy now gets an executable duplicate create instead of a hold [FAILED · high · regression vs audit A1/A3 direction]
- Scenario: `node docs/preview-corrections/probes/r1-a1-drift.ts` (curated demo-week2, `Core - Grant - MFA for all users` grant drifted to `compliantDevice`, no prior record — the drift audit A1 probe; `../logs/r1/a1-drift.txt`). `DRIFT=0` control: the step is in place, no operations.
- Expected (docs/product/actionability/reference/audit-a1-a6.md A1 "Only correct a policy the goal itself owns and no other goal claims as its satisfier. **Otherwise hold with an explanation**"; A3 "never as missing"; FINDINGS C01 "no … duplicate-policy creation workaround"): no update against another goal's policy AND no executable create beside the tenant's own drifted all-users policy; the step holds for review.
- Actual at 144b6ce: mfa-all-users coverage `partial`, candidates only the admins and guests policies (`ownScope:false`); operations `[create, "Core - Require - MFA for all users", state enabledForReportingButNotEnforced]`; tracking none; `nextSafeAction` `create-report-only`, **executable: true** (blockers `["readiness"]`). The foreign update is gone (C01 fixed there), but the audited hold is replaced by a copyable second tenant-wide MFA policy beside the drifted one.
- Assertion weakening: `src/roadmap/tracking.drift.test.ts:260-283` (commit 76320e8) removed `assert.equal(driftOutcomeOf(step), 'review-required')` and `nextSafeAction(step).executable === false`; the replacement hold assertions sit in a loop over tracked members pointing at a claimed policy, which is empty here (tracking is null), so they never execute. The test now passes on the duplicate create. S1 recorded this as gap 3 (BLOCKED S1 21:50) and called it "an honest create"; that contradicts A1's stated direction and C01's no-duplicate rule.
- Severity: not a security weakening (the create is report-only), but an executable duplicate policy proposal replacing a hold is a regression of an audited P0/P1 invariant. S5: hold (not executable) with an explanation when the goal has no own candidate but the tenant carries a policy the goal's step previously owned/that matches the goal's scope with a drifted control — without name hardcoding — and restore an assertion that executes (`executable === false` for this scenario).
