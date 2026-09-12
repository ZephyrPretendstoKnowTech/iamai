# RUN-CONTEXT-A — Batch A: one state vocabulary, projected finish, snapshot lock, trust tests, passkey step

Every segment reads this file first, then only the inputs its segment names.

## Repository
- Repo: C:\Dev\IAMAI. Starting HEAD for A1a: the current origin/main (4cde3e6 or later). Preserve newer work.

## Authorities and references (read only when a segment names them)
- A1  docs/product/actionability/IAMAI-Actionability-Dependency-Playbook.md — lanes, gates, sorting, worked examples.
- A2  docs/design/approved/anatomy/plan-step-v1.html — opened-step anatomy.
- A3  docs/product/actionability/reference/audit-a1-a6.md — the drift audit (findings A1–A6, B1–B4, C1–C5, D1–D7).
- R-STATE  docs/product/actionability/reference/state-model.md — every state word, its producer and consumers; the 28 meeting points in "Where the two vocabularies meet".
- R-RENDER docs/product/actionability/reference/step-renderer.md — opened-step tree; Implementation projector; packageStateOf order (§3.3); Planned work (§3.7).
- R-READY  docs/product/actionability/reference/readiness-taxonomy.md
- R-SCHED  docs/product/actionability/reference/schedule.md — planFinish (§8), estimate.targetEnd, When column (§7), freeze (§6).
- R-FIX    docs/product/actionability/reference/fixtures.md — expected lane counts per fixture.
- R-INV    docs/product/actionability/reference/steps-inventory.md
- R-REC    docs/product/actionability/reference/plan-record.md
- R-WALK   docs/product/actionability/reference/contracts-and-walk.md
- R-GAPS   docs/product/actionability/reference/goal-gaps.md
- R-SCHEMA docs/product/actionability/reference/content-schema.md, package-example.md
- CODE MAP: the filled code map in docs/product/actionability/RUN-CONTEXT.md still applies. Additional files named per segment.

## Decisions already made (do not ask, do not re-decide)
1. The lane engine is the only producer of a step's state for every surface: row, badge, readiness bar, rail, When words, header tiles, print, ICS, bundle, plan file, prompt pack. The legacy `Lifecycle` stage stays as an evidence *input* (report-only / enforced are tenant facts) and is never rendered as a judgment.
2. Row chip: a derived tenant fact only — `Report-only` or `Enforced` from `state.lifecycle`, else nothing. No Blocked / Held / Needs correction / Needs attention / Skipped / Ready chips anywhere.
3. Deferral words: the policy action is `Defer this step`; the question/prerequisite action stays `Doesn't apply here`. Badge and lane read `Deferred` or `Doesn't apply`. `Set aside` and `Skipped` disappear as words. Internal `skipped` / `setAside` stay; no migration.
4. Baseline conflict reads `On Hold · Baseline conflict` everywhere; never `Deferred`.
5. Observation window: 7 days (3 when nobody is affected) is the default *time component* of the evidence predicate; per-step override via a package META field `observation.minDays` (add the field; default null = 7/3). Record in playbook §7.
6. Pending owner decisions are actionable (`Ready · Needs decision`) until decisions have modelled inputs. Record in BLOCKED.md once.
7. Graph scope: `s-goal-azure-management-mfa`, `s-goal-mobile-app-protection`, `s-goal-unmanaged-browser` are not in the pinned baseline → excluded from `dependency-data.json` (playbook §10.0 gets a `generated: no — not in pinned baseline` column value; the build script skips them). `s-goal-workload-identity-block` stays (conditional). `s-prereq-passkey-settings` and `s-ladder-operator-passkey` stay and get generated in A5.
8. Runtime ids are canonical: the playbook and dependency-data use `s-goal-all-users-no-persistence` (title "Limit How Long Sessions Last") and `cleanup-hardening`. `runtime-source-reference-decision` is removed from §10.0.
9. Passkey target (product decision, deviates from the baseline): FIDO2 method enabled for all users; attestation enforced; key restrictions enforced, type `allow`, AAGUIDs = Microsoft Authenticator iOS and Android only; self-service registration allowed. AAGUID values are copied from the current Microsoft Learn page during A5, never from memory.
10. `Source checked <Mon D, YYYY>` is the wording (A2's "Source updated" is superseded); rendered only when `verifiedSources[].checkedOn` exists.
11. Header tiles after A1b: Steps · Completed · Projected finish (A2 fills) · Started. Waiting / Remaining / In place tiles are removed. The Needs-attention toggle is removed; On Hold is the attention view. The substatus and lane words live in content.json (`pages.plan.lanes.*`).
12. Readiness tiles show direct prerequisites only, labelled `Prerequisite · Ready` / `Prerequisite · Up Next` / `Prerequisite · On Hold` / `Prerequisite · Deferred`; the transitive emergency gate tile is suppressed when the exclusions-group tile is present.

## Working rules
- One root cause per segment. Stay inside the segment's DO list.
- `npx tsc --noEmit` during work; targeted tests; `node --test "src/**/*.test.ts"` once at segment end. No walk, no build, no deploy except A6.
- Commit per change with the segment id prefix. Also commit at least every 20 minutes of work, `wip:` prefix, squash at segment end.
- Never revert a prior segment's product change to make a check pass. If a walk/smoke/contract check conflicts with a decision above, update the check to the decision and say so in the commit; if the conflict is with something not decided here, stop that task and record it.
- A missing input named in READ is a segment stop, not a deferral.
- No narration, no reports except A6.
- Edit-only outside the files the segment names.

## Overnight failure protocol
- Two failures on one root cause: revert to green, append `segment · task · root cause · tried · smallest next step` to docs/product/actionability/BLOCKED.md, continue.
- DONE-WHEN unmet: tree green, BLOCKED.md entry, end the segment.
- Never ask; choose the smallest reversible option and log it under `Choices`.

## Chrome
- Chrome checks use the existing selectors (`.plan-row`, `.plan-row .lane`, `.step-body`, `[role=tab]`). If Chrome is unavailable, log `SKIPPED — Chrome unavailable` and continue.

## Freeze
No Home/Connect/Print-layout redesign, no public website changes, no scheduler removal, no package prose rewrites beyond the fields a segment names, no resolving register-info / Admin Portal / name.canonical / Email audiences.
