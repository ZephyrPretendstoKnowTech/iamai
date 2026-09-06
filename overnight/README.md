# IAMAI Overnight Runner V3.2 — live incremental queue

V3.2 keeps the V3.1 execution boundary and changes only queue ingestion/session behavior so task contracts can be authored while the runner is working.

## Fixed execution boundary

Claude Code still owns one task's implementation, tests, commit/push to `main`, and its own CI observation. The runner independently owns dispatch, durable state, exact-SHA GitHub Actions verification, OpenAI review, bounded correction policy, dependencies, budget, and reporting. There are no feature branches, worktrees, merges, rebases, automatic rollback, or supervisor/repair loops.

Foundations A/B/C/D remain frozen.

## Live task inbox

Human-authored task packages live at:

```text
overnight/tasks/<task-id>/
  META.json
  IMPLEMENT.md
  REVIEW.md
```

`overnight/tasks/` is intentionally git-ignored. This is required: task packages may be added while Claude is working, and that activity must not dirty `main`.

A folder is eligible only when all three required files exist, have been stable for the configured settling window, parse successfully, and pass the bounded contract checks. Incomplete/settling/invalid folders are quarantined from execution and do not stop unrelated runnable work.

The runner rescans the inbox after every task and while idle. A missing dependency package means WAITING, not failure. A known dependency that reaches a non-success terminal state blocks its dependent task.

## Immutable claim

Immediately before execution, the runner re-reads and snapshots the exact three-file package into:

```text
.overnight/contracts/<task-id>/<sha256>/
```

That snapshot is authoritative for the Claude implementation, review, and every correction pass. Editing the live inbox after claim cannot move the running task's goalposts.

A task ID that has already succeeded is immutable. If its live contract later changes, the runner records the changed hash and still does not rerun the completed task. New work must get a new task ID.

## One Claude task at a time

The queue is serial. Prompt authoring may happen concurrently, but the runner launches only one implementation/correction Claude process at a time and does not move to the next task until the current task reaches a terminal review result.

## Running out of tasks

No runnable task does **not** mean the backlog is complete. The runner enters IDLE and rescans `overnight/tasks/` every 30 seconds by default. The default idle window is 60 minutes. If a new runnable package appears, work resumes automatically.

After the idle timeout, the process exits cleanly with `IDLE_TIMEOUT`, preserves task history, and closes the nightly session.

## Future nights

Task history persists in `.overnight/state.json`. Session budget and live dry-run gates are per night/session. A normally idled/budget-stopped session is closed; the next `doctor`/dry-run automatically starts a fresh session with a fresh budget and gate while preserving completed task history.

If you intentionally need to reset an open-but-not-active session, use:

```text
python overnight/runner.py new-night
```

This resets only the nightly budget/gate. It does not erase task history.

## Tonight's command order

Once the runner infrastructure itself is committed/pushed and the repo is clean:

```text
python overnight/runner.py lint
python overnight/runner.py self-test
python overnight/runner.py doctor
python overnight/runner.py live-dry-run pass
python overnight/runner.py live-dry-run correction
python overnight/runner.py status
python overnight/runner.py run
```

`run` refuses to start until both real dry-run paths have succeeded in the same open session and the final dry-run SHA still anchors the queue start.

## Live dry runs

`live-dry-run pass` proves the real Claude -> empty commit/push -> exact-SHA `ci` + `deploy-pages` -> OpenAI review -> PASS path.

`live-dry-run correction` deliberately proves one `CORRECTION_REQUIRED` loop through a second fresh Claude pass, second exact-SHA CI/deploy verification, and successful re-review.

The deterministic `self-test` does not satisfy the live gate.

## Budget

The hard stop defaults to `$60` per session. Task envelope totals are allowed to exceed `$60`; the live queue may contain more work than one night can afford. The runner stops rather than intentionally starting a task when too little session budget remains to preserve a safe Claude/reviewer path.

Dry-run and doctor spend count against the same session hard stop.

## Status/reporting

Use:

```text
python overnight/runner.py status
```

It shows the current session, valid/incomplete/settling/invalid inbox packages, persisted task history, dependencies, contract hashes, dry-run gate, and budget.

The current session report remains:

```text
.overnight/OVERNIGHT-REPORT.md
```

Archived session diagnostics are copied under `.overnight/sessions/<session-id>/`.
