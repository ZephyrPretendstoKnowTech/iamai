# Synthetic live CORRECTION_REQUIRED dry run

## User-facing outcome
Prove the real runner can traverse one deliberate structured CORRECTION_REQUIRED verdict, generate a bounded correction prompt, launch a second fresh Claude Code pass, re-verify exact-SHA CI/deploy, re-review, and continue successfully.

## Scope
This is infrastructure validation only. Work directly on clean `main`. Do not modify any tracked file. Preflight branch/status/HEAD, then create exactly one empty first-phase commit:

`git commit --allow-empty -m "chore: overnight runner correction dry run phase 1"`

Push main. Verify `ci` and `deploy-pages` for the exact pushed SHA, including walk/build/deploy. Return the standard handoff with status DONE and `files_changed: []`. The reviewer harness will deliberately request one bounded synthetic correction; follow only that correction prompt in the next fresh session. Do not claim approval.

## Acceptance
The first real review emits the harness-controlled single FUNCTIONAL CORRECTION_REQUIRED finding; the runner creates a correction prompt; a second fresh Claude pass creates the requested second empty pushed commit; exact-SHA CI/deploy passes again; the second real review PASSes; no tracked source file changes in either phase.

## Validation
Use the normal exact-SHA `ci` and `deploy-pages` verification for both pushed SHAs and verify the runner records exactly one correction and two Claude handoffs.

## Frozen boundaries
Foundations A/B/C/D and all product source are read-only for this harness. Do not edit the runner/task contracts while the harness is executing.
