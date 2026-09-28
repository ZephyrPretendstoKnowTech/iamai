# Hand-off: finish round 4, then audit it yourself

You are taking over IAMAI mid-flight. `CLAUDE.md` and the memory index load
automatically — read them, they are authority. This file is the state of the
work and the method, not a restatement of them.

## What IAMAI is, in one paragraph

A browser-only, read-only Entra Conditional Access rollout planner. It reads a
tenant, builds a plan of policy steps, and tells a person what to do in their
own admin centre. It never writes to a tenant. Every claim it makes on screen
is therefore a claim about someone else's production identity system, made to
someone who will act on it. **A wrong sentence here locks people out of their
own tenant.** That is the standard the work is held to.

## The job, in three phases

### Phase 1 — clear the register

`docs/plans/2026-09-22-persona-round-4-register.md` holds 59 findings from five
personas run against hostile tenants. Status now:

| Severity | Rows | Fixed |
|---|---|---|
| 5 | 7 | 5 |
| 4 | 17 | 1 |
| 3 | 19 | 0 |
| 2 | 15 | 0 |
| 1 | 1 | 0 |

Work down by severity. **Validate every row before you work it** — round 3 had
four findings dissolve under checking and two that were the harness lying, and
a withdrawal with a written reason is worth as much as a fix. Each row's
`Status` cell is where the verdict goes, in prose, including withdrawals.

Two severity 5s are open:

- **R4-06 / Priya D3 — the readiness gate is advisory, and its disappearance is
  silent.** IAMAI refuses to hand over an enforce instruction because it judges
  the change unsafe. The reader enforces in the portal anyway. The step then
  reads `Completed`, Done-when satisfied, nothing recording that the threshold
  was never met. A gate that congratulates you for walking around it is not a
  gate, and its silence reads as endorsement.
  *Approach worked out, nothing written:* `generate.ts` computes
  `action.readinessGate` only inside `if (!state.satisfied)` (~line 1878), so an
  enforced step has no gate object at all. Lift the threshold calculation out of
  that guard; where the step IS satisfied and the threshold still unmet, set a
  new `Action.enforcedBelowReadiness { measure, threshold, value, floor? }` in
  `types.ts` beside `readinessGate`, and render it as a warn tile. It must hold
  nothing — the work is done — it is a fact about the tenant.
  Reproduce: `node docs/qa/night/personas/r4-priya-11-enforced.ts`.
- **R4-08 / Sam D2 — the plan walks you into the state its own cutover paragraph
  forbids, then cannot get you out.** Not investigated. Read
  `docs/qa/night/personas/r4-sam-REPORT.md`.

The five source reports are `docs/qa/night/personas/r4-{jordan,nadia,priya,sam}-REPORT.md`
and `r4-marcus-FINDINGS.md`. Each finding names the exact script that reproduces
it. Run it before you believe it, and run it again after you fix it.

### Phase 2 — audit it yourself

When the register is clear, audit the product by **your own** standard of what
good looks like. The persona method below is a reference, not a constraint — if
you have a better way to find what a real administrator would hate about this
tool, use it. What the previous rounds have NOT covered well: Export, MFA
Readiness, How, Connect, Inventory, the printed plan, and everything at mobile
width. Round 4 also produced one finding class nobody chased: mechanical
consistency (the same fact worded differently on two surfaces).

### Phase 3 — fix what you find

Same discipline as phase 1: register the findings with severity, validate,
fix at the source, unit test each one, push.

## The method that has been working

**Personas.** `docs/qa/night/personas/HARNESS.md` documents the harness:
`tenant()`, `plan()`, `rescan(t, prior, now)`, `render()`, `lanes()`,
`observations()`, `deploy()`, `days()`, `enrolMfa()`, `prepareEmergencyAccess()`,
`configurePasskeys()`, `settleFoundations()`, `acceptDirection()`, `ctxOf()`.
A persona is a named person with a tenant, a goal and a temperament, who drives
the real engine through a scripted sequence and writes up what they saw in their
own words, with a rating out of 10. Hostile tenants (403 on registrationDetails,
no sign-in evidence, inherited policies, guests) find far more than clean ones.

**Trust the harness less than the product.** Round 4's harness told at least two
lies before it told a truth — a ruled-out step reported as "not on the board",
a donor's registration row not copied by `enrolMfa`. When a finding looks
absurd, suspect the harness first.

## The two root-cause patterns, across all four rounds

These are the payload. Most findings are instances of one of them.

1. **The engine computes the right answer and drops it before the page.**
   The fact exists and is correct; the view model has no slot for it, or a guard
   filters it out, or a lane that answers "what is left to do" is empty by
   definition. Three of the four fixes I made are exactly this shape.
2. **A "fix" that strengthened a warning instead of removing the dangerous
   instruction.** Round 3 found a severity 5, moved the consequence into the
   sentence, and shipped — the instruction telling someone to delete both
   break-glass accounts was still there in round 4, with a code comment
   predicting the lockout. **If the tool is telling someone to do something
   harmful, the fix is to stop telling them, not to warn them harder.**

A third worth watching: two of round 4's severity 5s were defects introduced the
night before and caught within a day by independent personas. Speed of fixing is
not the same as correctness of fixing.

## What I fixed today, as worked examples

- `b70d82c1` — a step claimed its policy was written "before IAMAI's first
  scan". IAMAI cannot know that date. `watchedArrive` compares against the
  immediately prior scan only; `neverObserved` is set both for a policy the
  first scan found enforced and for one deployed straight to enforced under the
  watch, so neither dates it. The sentence now claims only authorship, which is
  what the tag proves. *(My first attempt gated on `neverObserved` and I
  reverted it — it cannot tell the two cases apart. Reverting a wrong fix is
  normal here.)*
- `dcfc6aee` — `deriveUncached` returns `result('Completed')` before computing
  blockers, so enforcing ahead of a hard prerequisite erased the record of it.
  `LaneResult.unmetPrerequisites` now carries the hard prerequisites of the
  action a completed step already took that are still unmet;
  `PrerequisiteBlocker.overtaken` renders the tile. Pattern 1, exactly.
- `a4b0cbd2` — a deployable PowerShell script was shipped whole however few
  modes IAMAI offered, so a step that withheld enforcement in the Portal and
  JSON channels shipped its `Enforce` branch pre-filled, one word's edit away.
  `scriptForRuns` in `src/content/implementation/invocation.ts` now ships only
  the called modes. Pattern 2, exactly.

## Working discipline (beyond CLAUDE.md)

- One root cause per commit. Plain commit message that explains the *defect*,
  not the diff. `git commit -F <file>` — heredocs into `-m` mangle.
- `npm run verify -- <test files>` while working;
  `npm run verify -- --prepush <test files>` before every push (~90s, adds build
  + browser smoke). Naming the right test files is the part that goes wrong:
  I mis-selected about eleven times in one session and CI caught breaks in files
  I had not thought to name. When in doubt, name more.
- Never `npm test` casually (13–15 min) and never run the walk.
- Every fix gets a unit test asserting the observable behaviour, with the defect
  written into the test's comment so nobody re-introduces it.
- Record each finding's verdict in the register as you go.

## Traps that cost me time

- `$'` in a `String.replace` replacement string is a special pattern (it inserts
  the text after the match). **Always pass a replacer function**, `() => new`.
- Heredocs eat a backslash level. Build regex escapes with
  `String.fromCharCode(92)`, or use `includes` instead of `match`.
- `content.json` is huge — grep the key, never read it whole.
- CI `concurrency: cancel-in-progress` cancels the previous run on a new push.
  A "cancelled" ci run on an older commit is expected, not a failure.
- Every push to main reports `Bypassed rule violations` because the ruleset
  expects a PR. That is the standing state and an **open owner decision** — do
  not treat it as something to route around silently, and do not change the
  ruleset without asking.

## Owner decisions still open

- The GitHub ruleset that every push bypasses.
- A fifth `Lifecycle` value for "deployed but switched off" (currently collapses
  to `not-deployed`).
- G-F2's 63 unproduced binding producers.
- R4-03b (severity 4): the "Verify after the change" line lives inside the
  enforce instruction prose, gated on pre-enforcement states, so it stops
  rendering exactly when it becomes relevant. Fix is in the content library
  across packages, not the engine.

Ask in batches at natural gates (CI green, before building a design, before a
deploy). Otherwise decide and continue.

## Start here

1. `git log --oneline -5` and confirm CI is green on `a4b0cbd2`.
2. Read the register.
3. Reproduce R4-06 before writing a line of it.
