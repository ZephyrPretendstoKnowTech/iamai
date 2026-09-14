# Segment instructions

Every session reads RUN-CONTEXT, its section, relevant FINDINGS entries and RESULTS. Local commits only. Minutes are upper bounds, not obligations to fill. The launcher can shorten them to preserve final review.

## S0 — Baseline and reproduction (25 minutes)
Read C01–C09 at summary level. Inspect local instructions and actual build/test side effects. Record starting SHA, selected baseline, tool versions and initial dirty status. Install locked dependencies only if needed (`npm ci --ignore-scripts --no-audit --no-fund`), no updates. Run typecheck, full local tests and build when available; record exact failures/environment limitations. Establish targeted fixture reproductions of critical findings and identify current code paths. Update RESULTS; do not spend the whole session reading audit prose. No application edits except regression harnesses needed for subsequent work. Commit ledger/harness if coherent.

## S1 — Policy identity and correction semantics (75 minutes)
Read C01/C02. Start with recorded reproduction. Inspect goal resolver and shared operation boundaries before editing authored prose. Correct wrong identity and conditions/grant/state coupling using existing design. Add independent expected-answer tests with policy renaming/order reversal and overlapping goals. Do not change baseline, strip methods, hide instructions or introduce global migration policy. Resolve narrow proven mistakes; record unresolved security decisions. Run focused tests and typecheck/build. Checkpoint each coherent fix.

## S2 — Collection and readiness truth (45 minutes)
Read C03/C04. Reproduce malformed response behavior and date/proof cases; use mocks only. Add minimal response validation without breaking scalar endpoints, retry/cancel semantics or valid empty collections. Propagate unknown/partial. Fix method timestamp normalization/unsupported continuity conservatively without inventing expiration or removing historical display. Run focused tests, typecheck/build. Record scope not proven.

## S3 — Content runtime and channel parity (80 minutes)
Read C05/C06 and unresolved C01/C02. Compile the existing library and classify diagnostics by shared cause. Repair source metadata/projection/bindings with strongest leverage. Prioritize passkey setup, all-user/admin MFA, legacy/device-code/auth-transfer/session corrections, then remaining affected policies. Preserve tabs and validators. For complete synthetic inputs inspect rendered Entra, JSON and PowerShell, assert types and shared operation equivalence. For incomplete inputs confirm honest prerequisite behavior. Repair currently broken Email/AI content when a common cause makes it feasible; no new template campaign. Produce a package/state/channel matrix. Focused checks plus build.

## S4 — Entry journey, notice and targeted language (45 minutes)
Read C07/C08/C09. Add agreed Connect notice FIRST using existing components. Reproduce loading with local synthetic/demo states; fix actual cause if feasible. Correct misleading method/proof labels, stale enforcement wording, dead references and internal instructions without changing product architecture. Limit incidental layout edits to defects in touched surfaces. Verify both Connect states/themes and a narrow viewport. No live tenant sign-in. Run focused checks/build.

## R1 — Fresh adversarial review (35 minutes)
Read REVIEW.md. You did not implement earlier changes. Inspect diff from recorded source SHA and critical tests independently; do not trust RESULTS claims. Do not modify application code. You may create local synthetic probes and write REVIEW-1.md/RESULTS review entries. Prioritize wrong identity, security meaning, incomplete input behavior, lost information/features and assertion weakening. Record precise failures and reproduction, file/line and expected outcome; distinguish blockers from cosmetic requests. Commit review evidence only, preserving any dirty implementation work for S5.

## S5 — Repair review findings (45 minutes)
Read REVIEW-1.md and REVIEW.md. Fix reproduced critical/high R1 findings and unfinished critical earlier corrections only. No new features or scope. If a proposed review fix is wrong, rebut with a test/source rather than silently ignoring. Re-run directly relevant checks and update RESULTS with fixes/limitations. Checkpoint before time runs out.

## R2 — Final independent verification (65 minutes)
Read REVIEW.md. Independently review final diff and changes since R1. Do not edit application code or bless uncommitted work as a release commit. Run full local tests, typecheck, production build and supported local browser walk/targeted journeys after inspecting script side effects. Use synthetic data only. Verify all exposed channels in corrected critical scenarios and the feature-preservation inventory. Record command, exit code, counts, environment failures, current SHA and dirty state. Produce FINAL-REPORT.md and RESULTS. Verdict is READY FOR OWNER REVIEW or NOT READY; neither authorizes deploy. Any unresolved critical unsafe instruction, failing required check, feature removal, unknown candidate identity or unverified key fix means NOT READY. Commit reports only if possible without staging unrelated files. Finish with candidate SHA and exact remaining issues.
