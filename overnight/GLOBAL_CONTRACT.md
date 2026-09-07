# IAMAI Overnight Global Contract

## Product boundary

IAMAI is a browser-only, read-only Microsoft Entra Conditional Access planner. The overnight system may improve correctness, fidelity and the already-approved user experience, but it must not broaden IAMAI into a write-capable tenant management product.

Foundations A, B, C and D are frozen. They are dependencies, not design invitations. The overnight queue may repair consumers, evidence aggregation, classifiers, exports, portal guidance, or other downstream code that violates a frozen contract; it may not edit the frozen authority modules/tests, replace them, reinterpret them, or redistribute their authority. If a task appears to require a frozen-authority change, return `MANUAL_DECISION_REQUIRED` instead of changing it overnight.

The pinned baseline remains authoritative. An automated task may identify a baseline defect or contradiction, but it may not change the pinned baseline source, pinned commit, or make a new product decision about what the baseline ought to mean. Such a finding is `MANUAL_DECISION_REQUIRED`.

## Claude execution contract

Work directly on `main`.
Do not create a feature branch or PR.
Do not use an IAMAI orchestrator, supervisor, worktree, rebase, cherry-pick, automatic rollback, or force push.
Preflight `git status`, branch, and HEAD. If the tracked working tree is dirty, stop and report it.
Implement only the current task contract. Do not redesign adjacent foundations or opportunistically clean unrelated code.
Run the task's requested tests. Run `npx tsc --noEmit`, `npm test`, and `npm run build:site` before a changed task is pushed unless the task explicitly narrows one of those checks for a no-change audit.
Do not run `npm run walk` locally; the `deploy-pages` workflow owns the walk.
If tracked files changed, commit directly to `main` and push. If a pure audit proves no change is needed, do not manufacture a source change; report `NO_CHANGE` at the existing HEAD.
Verify `ci` and `deploy-pages` for the exact resulting SHA, including deploy `walk`, `build`, and `deploy` jobs.
Return the required handoff. Do not claim approval; approval comes from the independent reviewer.

## Required Claude handoff

End the final response with exactly one `<handoff>...</handoff>` block containing valid JSON with this shape:

```json
{
  "status": "DONE | NO_CHANGE | MANUAL_DECISION_REQUIRED | FAILED",
  "base_sha": "40-char SHA",
  "head_sha": "40-char SHA",
  "summary": "short factual summary",
  "files_changed": ["repo/relative/path"],
  "tests": [{"command": "...", "result": "pass | fail | not_run", "detail": "..."}],
  "ci": {
    "ci_run_id": "id or null",
    "ci_conclusion": "success or other/null",
    "deploy_run_id": "id or null",
    "deploy_conclusion": "success or other/null"
  },
  "manual_decision": "null or exact decision the human must make",
  "deferred": ["bounded item"],
  "notes": ["bounded factual note"]
}
```

The runner independently verifies git and GitHub Actions; this handoff is evidence, not authority.

## Reviewer contract

Review the task's stated end-user outcome and invariants, not an imagined perfect product. Use only these severities:

### BLOCKER
Must be corrected before dependent work. Examples: unsafe policy can be offered; tenant/privacy boundary violated; unknown becomes safe/present/confirmed; a security gate is bypassable; lifecycle/enforcement falsely advances; operator confirmation is manufactured; destructive/corrupting behavior; the feature is materially unusable for intended users.

### MAJOR
Normally must be corrected before dependent work. Examples: a common user path is materially wrong; architecture is likely to break the next planned task; the stated primary outcome is not implemented; important state/history is lost or misrepresented; substantial user-facing regression.

### FUNCTIONAL
A real task-scope bug affecting plausible end-user behavior but not a load-bearing invariant. Correct when bounded and valuable. It may be deferred after repeated reasonable corrections when it does not endanger dependent work.

### CLEANUP
Never blocks approval. Examples: niche/unreachable edge; dead/legacy shape; cosmetic copy/polish; test-only fixture oddity; unused report path; theoretical collision with no practical impact; minor duplication/refactor.

A CLEANUP finding must not produce `CORRECTION_REQUIRED`. Do not hunt for style preferences, speculative refactors, naming minutiae, or unrelated imperfections.

Allowed verdicts: `PASS`, `PASS_WITH_NOTES`, `CORRECTION_REQUIRED`, `BLOCKED`.
`PASS_WITH_NOTES` is success; notes go to backlog.
A reviewer may request a small set of exact additional repo-relative paths once. It must not request an unbounded repository crawl unless the task itself is a cross-cutting audit.

## Execution shape

This applies to every remaining task without changing any task contract. The task contract says what to build; this says how a session spends its time.

### Claude implementation session

Start from the current task contract, the files it names, the relevant diff and history, and the established upstream authority. Do not open with a repository-wide audit. Open a file because this task's outcome depends on it.

Reuse the existing authority for a fact rather than adding a second one. Foundations and prior implementation may be changed when correctness genuinely requires it; record that judgment in the handoff.

Run focused tests while editing. Run the broad required validation once, near completion. Then commit, push, hand off, exit. Do not poll GitHub Actions: the runner owns exact-SHA verification.

### Claude correction session

A correction is not a fresh audit of the task. Begin from the exact reviewer finding, its evidence, the reviewed diff, and the minimum set of files that finding touches.

Do not reopen an accepted finding without concrete regression evidence, and do not widen a correction into unrelated improvement. Assert the specific regression first, fix it, then run the broad required validation once near completion.

### Reviewer session

Review the current REVIEW.md criteria, the current diff, the handoff, the exact-SHA validation evidence, and the bounded context supplied. Completed upstream behaviour is established: treat it as sound unless the current evidence shows a regression. Do not hunt for unrelated historical defects or optional refactors.

After a correction, verify the actionable finding and the regression risk immediately around it rather than restarting a full architecture audit. The three-call ceiling is one primary review plus at most two recovery calls on the same review, never independent re-reviews.

## Correction policy

BLOCKER or MAJOR requires correction. FUNCTIONAL is corrected when bounded and valuable. CLEANUP is recorded and does not block.
After correction 2, correction 3 is allowed only for a BLOCKER, MAJOR, or still-broken primary user outcome. A third pass is never for cleanup/minutiae. A non-blocking FUNCTIONAL issue surviving two reasonable corrections is deferred. New CLEANUP found during a correction does not restart the loop.
