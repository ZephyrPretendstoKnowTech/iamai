# RUN-CONTEXT-B — Batch B: Universal fixes + per-step content

Every segment reads this file first, then only the inputs its segment names.

## Repository
- Repo: C:\Dev\IAMAI. Starting HEAD: current origin/main. Preserve newer work.

## Authorities (read only when a segment names them)
- MASTER  docs/product/actionability/IAMAI-Universal-Fixes-Master-List.md — the 28 universal items with file paths, current/target behavior, implementation approach, and tests.
- STEPS   docs/product/actionability/step-findings/ — per-step finding docs. Each names its step ID, archetype, current state, step-specific fixes, and which universal items apply.
- A1      docs/product/actionability/IAMAI-Actionability-Dependency-Playbook.md
- R-STATE docs/product/actionability/reference/state-model.md
- R-RENDER docs/product/actionability/reference/step-renderer.md
- R-READY docs/product/actionability/reference/readiness-taxonomy.md
- R-SCHED docs/product/actionability/reference/schedule.md
- R-FIX   docs/product/actionability/reference/fixtures.md
- R-WALK  docs/product/actionability/reference/contracts-and-walk.md
- R-SCHEMA docs/product/actionability/reference/content-schema.md

## Decisions (do not ask, do not re-decide)
All decisions from RUN-CONTEXT-A.md remain in force. Additional decisions from the six-step review:

1. Remove "What to do" from every step. Inputs → action column. Operational guidance → Implementation channels. Generic prose → deleted.
2. Two-column layout: left = Why → Readiness → Implementation → Done when. Right = milestone date + IAMAI inputs (260px, stacks below 900px).
3. Compact/expand readiness tiles: collapsed = one line (icon + label + status + chevron, ~48px). Expanded on click. Tiles don't match heights (align-items: start). State resets on step close.
4. Planned work banner removed entirely. Copy button disabled with reason tooltip when content can't be copied.
5. Implementation channels always visible when authored content exists. Never "Nothing to submit yet" (except baseline-conflict steps which show: "Not enough information to provide implementation guidance. The baseline defines this policy two ways; resolve the conflict before implementation is available.").
6. Enforced + no drift = Completed. Enforced + drift = Ready · Correct. Observing reserved for Report-only policies accumulating evidence.
7. packageStateOf evaluates `partial` (safe correction) before `!executableNow`, including when lifecycle = enforced.
8. Threshold tile text: gate language when unenforced, informational when enforced.
9. Substatus "Needs decision" → "Decision".
10. Row subtitles (plan-row-reason) removed. "next" pill removed.
11. Impact: counts only, never names. "Configuration only" replaced with per-step-type fallback label from package META `impact.fallbackLabel`.
12. PowerShell and JSON channels for CA policy steps only.
13. Expand viewer: sticky header with icon-only Copy and Minimize buttons.
14. Learn link inline at end of Why (per-step content pass adds the link text).
15. Source checked rendered from verifiedSources[].checkedOn (renderer done in A4; content pass adds dates).
16. Scan-matched objects pre-filled in pickers, step stays open until admin saves.
17. Conditional inputs (mail devices, partner accounts, device-code workflows, shared devices, travel) require explicit Save before step can complete.
18. High-Risk sign-in and user-risk packages: author channels by copying from Medium-Risk counterpart.
19. Baseline-conflict steps: explicit "not enough information" message, no channels.
20. Workload-identity step: only generate when a sync connector exists.

## Working rules
Same as RUN-CONTEXT-A.md:
- One root cause per segment. Stay inside the segment's DO list.
- `npx tsc --noEmit` during work; targeted tests; full suite once at segment end.
- Commit per change with the segment id prefix. WIP commits every 20 minutes, squash at segment end.
- Never revert a prior segment's product change.
- After applying a stash, run the full suite before committing.
- No walk, no build, no Chrome until B9.
- Edit-only outside the files the segment names.

## Overnight failure protocol
Same as RUN-CONTEXT-A.md:
- Two failures on one root cause: revert to green, append to BLOCKED.md, continue to next task in the segment.
- DONE-WHEN unmet: BLOCKED.md entry, end the segment.
- Never ask; choose smallest reversible option and log under Choices.

## Freeze
No Home/Connect/Print-layout redesign, no public website changes, no scheduler removal, no resolving register-info source conflict or Admin Portal baseline conflict, no changing the baseline or pinned.json.
