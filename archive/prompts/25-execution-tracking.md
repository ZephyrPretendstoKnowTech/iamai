# 25 — Execution tracking, progress map, plan file v2

Precondition: 24 committed. Read docs/design/roadmap-v2.md sections 5, 6, and 8.

1. Detection (§5): on every scan, match policies to steps by description tag first, then by intent fingerprint with a note. Derive from `createdDateTime`, `modifiedDateTime`, policy state, and report-only results: actual start and end per ring, days in report-only, sign-ins observed, failures and interruptions by user, and evidence quality. The user is never asked whether a step is done.
2. Regressions: a done step whose policy is later disabled, deleted, weakened, or has its scope narrowed reopens with a dated note.
3. State history per step with the evidence that justified each transition, stored in the plan file.
4. Progress map (new tab, default once any step has started): the journey band, the planned-versus-actual calendar strip, the headline sentence with projected finish, per-step planned versus actual dates with slip reasons, and the "what changed since last scan" list marking each entry as planned or unplanned.
5. Re-plan in place: step ids stable, done steps keep their evidence, new gaps append to the right wave, plan revisions recorded. Never regenerate a plan that discards execution history.
6. Plan file v2 (§6) with a migration from v1 and a test that loads a v1 file and produces an equivalent v2 plan. User edits (skips with reasons, reorders, custom dates, owners) survive re-planning.
7. Roadmap tabs become Progress, Plan, Danger areas, Schedule, Export (§8). Schedule carries owners, editable dates, the critical-path sentence, and an ICS export of scheduled steps.
8. Export tab: the plan as PDF (existing print layout), the change record per step, and the plan file. Nothing new is invented here beyond wiring what exists.
9. Tests: use the `midflight` fixture for detection, regression, and re-plan behaviour; assert that a re-plan after a baseline update preserves every done step and its dates.

Run npm test and vite build, commit, push, and report what the midflight fixture proved.
