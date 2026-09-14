# Fresh review each cycle

Do not edit application code or tests in this session. Inspect the full continuation diff and current working tree. Reproduce claims with synthetic probes and read outputs yourself. You may write review reports and logs. Do not commit: the runner checks the reviewed HEAD against current HEAD. Keep reports in docs/preview-continuation and logs outside the clone.

Prioritize wrong target/scope, weakened enforcement, missing grants/exclusions, contradictory executable output and regression controls. Verify the original lone group-admins reproduction is corrected and legitimate all-user operations still work. Review the held-step implementation and export, not just nextSafeAction. Make sure changed regression assertions actually execute. Check that test edits fix the narrow inaccurate rule and do not blanket suppress failures.

Evaluate all queue items. Distinguish fixed, remaining, not reproduced, and not verified. A successful subprocess exit alone does not establish correctness. Inspect the full-suite/typecheck/build evidence for the exact code state; run missing checks where time permits. Browser walk and matrix need current evidence. Prioritize new concerns rather than rerunning everything when verified code has not changed. Compare independent acceptance results: expected 28/28, no harness errors.

Write FINAL-REPORT.md with reviewed HEAD, dirty source entries, fixes, remaining findings, exact evidence, scope preserved, missing tests and genuine choices. Write a concise actionable queue for the next fixer. Do not stop merely because the original finite list of segments has completed.

Finally write REVIEW-STATUS.json as a JSON object:

    {"cycle": 1, "reviewedHead": "full git rev-parse HEAD", "status": "CONTINUE", "reason": "specific remaining work"}

Replace cycle with the cycle supplied by the launcher and reviewedHead with the actual SHA. Allowed status values:

- CONTINUE: any locally actionable defect or missing verification remains, or review is incomplete. Default when uncertain.
- READY_FOR_OWNER_REVIEW: all required review evidence is complete, no material corrective issue remains, no dirty application/test changes, and the feature-preservation requirement is met. This does not authorize publication.
- NEEDS_OWNER_DECISION: review is complete and the ONLY remaining work requires a concrete product choice unsupported by baseline/source evidence. List exact options and recommended choice in FINAL-REPORT. Do not use this for the notice, ordinary test changes, routine bug fixes, or lack of time. Finish independent work first.

This JSON is control metadata, not proof by itself. The owner still reviews the report. Never claim READY when a required check fails or a material executable instruction remains incorrect.
