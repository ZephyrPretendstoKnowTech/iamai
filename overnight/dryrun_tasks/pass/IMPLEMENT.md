# Synthetic live PASS dry run

## User-facing outcome
Prove the real runner can carry a fresh Claude Code session through main commit/push, exact-SHA CI/deploy verification, a real structured OpenAI review, and PASS without touching product source.

## Scope
This is infrastructure validation only. Work directly on clean `main`. Do not modify any tracked file. Preflight branch/status/HEAD, then create exactly one empty commit:

`git commit --allow-empty -m "chore: overnight runner PASS dry run"`

Push main. Verify `ci` and `deploy-pages` for the exact pushed SHA, including walk/build/deploy. Return the standard handoff with status DONE and `files_changed: []`. Do not claim approval.

## Acceptance
Exactly one fresh Claude pass creates one empty pushed commit, the working tree remains clean, the runner independently confirms the pushed SHA and exact-SHA workflows, and the real reviewer returns PASS or PASS_WITH_NOTES without a correction.

## Validation
Use the normal exact-SHA `ci` and `deploy-pages` verification. No product test changes or source edits are allowed.

## Frozen boundaries
Foundations A/B/C/D and all product source are read-only for this harness. Do not edit the runner/task contracts while the harness is executing.
