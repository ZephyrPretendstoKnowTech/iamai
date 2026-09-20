# The prompt for the audit session

Paste this into a new chat. It assumes nothing about what that session remembers.

---

You are continuing IAMAI, a browser-only, read-only Microsoft Entra Conditional
Access rollout planner. It tells an admin what to build in their own tenant and
never writes to one. A public beta ships Monday 2026-09-21.

Read these first, in order, and do not start work until you have:

1. `CLAUDE.md` — the rules that cannot move.
2. `docs/plans/weekend-launch.md` — what happened this weekend and every owner
   decision made along the way.
3. `docs/plans/audit-method.md` — how this product is audited and why (the
   methods are taken from the field, with sources; read the severity rules).
4. `docs/plans/v1-audit-plan.md` — the running order you are executing.
5. `docs/plans/owner-questions-2026-09-20.md` — what the owner has answered and
   what is still his to answer.

Your job, in the order `v1-audit-plan.md` sets out:

**Step 0.** Build the eleven decisions the owner has already answered (they are
listed as answered or decided in `owner-questions-2026-09-20.md`). They change the
sentences the audits will read, so they land first. Push, with CI green.

**Step 1.** The Readiness tile audit — heuristic, three independent passes,
merged.

**Step 2.** The Implementation Task audit — heuristic, three independent passes,
merged, every channel.

**Step 3.** The journey audit — cognitive walkthrough with the four scenarios,
then the service blueprint. Use Claude-in-Chrome against the deployed site where a
real browser makes the answer more honest.

**Step 4.** The claim-integrity and failure-mode passes, alongside step 3.

**Step 5.** The fix pass: merge, dedupe, severity-order, build, test, push.

Then stop. The security review is a separate session against the final tree.

How to work here:

- The four Establish Emergency Access steps and the four Direction steps are
  frozen: findings against them are written to
  `docs/plans/frozen-step-suggestions.md`, never applied. The exception is the
  four Direction text fixes and two Emergency Access instruction fixes the owner
  approved on 2026-09-20 — those are in step 0.
- The Emergency Access steps are the quality bar for every other step. Copy them;
  do not invent a second visual or verbal language. Anything that seems to need a
  new component goes to `docs/plans/policy-anatomy-deviations.md`.
- Heavy work goes to subagents in worktrees; review each diff before it lands, and
  never merge a branch you have not read.
- Verify with `npx tsc --noEmit`, `npm run build:site`, focused
  `node --test --test-isolation=none <files>`, `git diff --check`,
  `node scripts/tenant-guard.mjs`. Run the full suite before a push. CI runs on
  every push beside the deploy; watch it.
- Never run the walk.
- Phone width is not a consideration for V1. Check 1280.
- Ask the owner only what genuinely needs him: something that changes what a
  policy does in a tenant, changes a frozen design, changes the shape of the
  product, reverses a decision he made, or needs knowledge only he has. Everything
  else you decide, on his test — does it serve the baseline's goal, keep the
  tenant simple, and avoid inventing features. Collect questions in one document,
  written the way `owner-questions-2026-09-20.md` is written: the screen, what it
  says today, what a person would get wrong, the options as outcomes, a
  recommendation, six lines.
- Tell the owner at phase boundaries, and update `weekend-launch.md` before any
  handoff.

Start by reading, then by reporting what step 0 contains and how you will verify
it. Do not begin the audits until step 0 is pushed and green.
