# The harness, after 2026-09-20

**Read this before running a persona.** The harness changed in ways that
invalidate part of the earlier runs.

## What was wrong before

`rescan(t)` passed no prior plan record, so **every scan was a first scan**. The
product could never tell a policy it watched appear from one that was already
there, and nothing the earlier runs reported about drift, continuity, an
observation window or an unobserved enforcement can be trusted.

Worse: the harness had no way to **prepare emergency access**, and emergency
access is the plan's one large gate. On nine of the ten shipped fixtures it is
unfinished, so no policy could ever complete. Personas that "stopped" were
mostly stopped by a gate the harness could not clear — not by a product defect.
Until 2026-09-22 it also had no way to **record the recovery test** (the
Cleanup row "Verify Emergency Access"), which every policy's enforcement waits
on, so no run on a tenant but the demo's week two could turn a policy on.

## What it can do now

```ts
import { tenant, plan, rescan, observations, deploy, days,
         settleAll, settleFoundations, prepareEmergencyAccess,
         configurePasskeys, recordDrill, acceptDirection, enrolMfa,
         decide, answers, render, stepView, lanes, ctxOf, mappingOf } from './harness.ts'
```

- `t.mapping` is the tenant's STORED mapping record and `t.decisions` the
  step decisions the person saved — two records, as the app keeps them. What
  every surface reads is `mappingOf(t)` (= `run.input.mapping`): the stored
  record with the detected defaults applied, then the saved decisions over it
  (`appliedMapping`, as `planData.ts` derives it). `decide()` saves a
  decision and does not touch `t.mapping`; read `mappingOf(t)` after it.

- `tenant(name, mutate?, { baseline? })` — a shipped fixture, **re-based on the
  pinned baseline the product ships** unless `{ baseline: 'fixture' }` asks for
  the fixture's own (the eight-policy synthetic stand-in, on every fixture but
  the demo). A run on the stand-in prints a warning: the goal map names none
  of its policies, so the engine matches them to goals by signature, which no
  production baseline does, and what a step creates, reaches or gates on is not
  what the product would show. A pinned tenant whose baseline the map does not
  describe stops (`goalMapDescribes`).
- `plan(t)` — the FIRST scan. No prior record, by definition.
- `observations(run, prior?)` — what that scan recorded, to hand to the next one.
- `rescan(t, prior, now?)` — **always pass `prior`.** A rescan without it is
  another first scan.
- `prepareEmergencyAccess(t)` — registers an approved **hardware** key on each
  emergency account. Not the Authenticator: `requiredModels()` is ordered
  Authenticator-first and its first entry is a phone credential, which the
  product correctly refuses for break-glass.
- `configurePasskeys(t)` — applies the passkey target the step resolves.
- `acceptDirection(t, run)` — presses Approve answers on all four Direction
  steps without touching a tile: each question's SAVED answer where it has one,
  else its suggestion, with its basis — exactly what the screen's draft holds
  (`DirectionQuestions.tsx`, `q.saved ?? q.suggested`). A persona who would
  answer differently calls `decide()` for that question instead.
- `settleFoundations` = emergency access + passkeys. `settleAll` = those plus
  the Direction answers.
- `recordDrill(t)` — the recovery test: each emergency account signs in with
  the key `prepareEmergencyAccess` registered, and the scan records it as
  passed (the demo week two's record, `withRecoveryTested`). Every policy's
  turn-on waits on it: until it is recorded a ready-to-enforce step offers no
  enforcement, and `deploy(…, 'enforced')` has nothing to submit. Run it after
  `settleFoundations`, and again after changing what it covers (the accounts,
  their keys, a policy that reaches them). Nothing else records it: the product
  reconciles observed recovery sign-ins on every scan, and the harness has no
  sign-in log for emergency accounts but this.
- `enrolMfa(t)` — the team registers a method. The one action that moves the MFA
  readiness gate. Everyone active holding no method the tenant allows (as
  `methodAvailability` reads it) registers a ready person's method; someone
  whose only methods the tenant turned off adds it beside them.
- `days(t, n, {failures})` — n days pass: the clock moves, the scan's collected
  window moves with it, and everyone a report-only policy covers signs in during
  it. `failures` seeds sign-ins the policy would have stopped.
- `lanes(t, run)` — the board's rows, tab by tab and group by group, each with
  the `title` the row draws. **A Cleanup row (the drill, alerting,
  consolidation) is a row with `step: null`**: read `row.id`, `row.title` and
  `row.cleanup` (its kind). A script that reads `row.step.id` on every row
  stops at the first Cleanup row — skip rows whose `step` is null, or read
  `row.id`.
  The harness cannot open a Cleanup row: `render()` and `stepView()` draw
  steps, and the Plan draws a Cleanup row's body with `CleanupRow`, which
  nothing here reads yet. Say so rather than describe a body you did not see.
- `render(t, run, step)` — the opened step, flattened. Its state is `badge`
  (what the head draws, `badgeLabel`) and `fact` (the chip beside it). There
  is no `state`; reading it throws.
- `stepView(t, run, step)` — the whole `stepBodyOf` result, with the board's
  lane, as ContentStep.tsx receives it, for a section `render()` does not
  flatten. Do not copy the board's readings into a script to call
  `stepBodyOf` yourself. **The badge is `badgeLabel(view.contract)`**;
  `contract.state.badge` and `contract.state.word` are inputs to it that no
  surface draws.
- `deploy(t, step, 'exact' | 'enforced' | 'unconfigured')` — does what the step
  says. An `update` operation (turning a policy on) patches the row the step's
  member already owns.

## The journey, on `mid`, measured 2026-09-22

`walk(tenant('mid'), { foundationsFirst: true, fidelity: 'exact', waits: true,
enrols: true })` (r3-journey.ts), on the pinned baseline:

```
first scan                  done 8, ready 9, blocked 25
direction answered          done 12, ready 12, blocked 14, skipped 4
passkeys configured         done 13, ready 21, blocked 4, skipped 4
emergency access prepared   (no status moves)
team registered a method    (no status moves)
policies deployed (exact)   in-report-only 9
report-only window          ready-to-enforce 8, in-report-only 1
recovery test recorded      (no status moves; the drill row reads Completed)
enforced what was ready     done 19, ready 15, blocked 3, in-report-only 1
```

Six of the eight enforce. The other two read Ready again after the turn-on
(`s-goal-pim-activation-reauth` Ready · Review, `s-goal-token-protection` Ready ·
Correct); nobody has looked at why. With `drills: false` the eight stay
ready-to-enforce for good, because each one's turn-on waits on the recovery test.

## What a run meets, measured 2026-09-22 on the pin

These are readings, not verdicts. A reading taken on the fixture's stand-in
baseline does not carry over to the pin, and this list once did exactly that.

1. **An MFA readiness gate can read "not measured".** After `settleAll`:
   `getiamai` (guests MFA), `messy` (admins phishing-resistant) and `hostile`
   (register info, admins, device registration). None on `mid`, `small`,
   `midflight` or `large`. On `mid` the gates read a number: 75% and 4%
   before `enrolMfa`.
2. **`device-registration-mfa` on `mid` stays On Hold through the journey.**
   Its tiles read "Baseline mapping: Baseline references an unmapped group",
   "Exclusions: Not met" and "Threshold: At least 4% MFA-ready"; `enrolMfa`
   does not move it. On the stand-in baseline the same step reads Ready ·
   Create and reaches report-only, and this note used to call it stuck behind
   the MFA gate: a wall measured on the stand-in does not describe the pin.
3. **The harness cannot open a Cleanup row** (see `lanes` above).

## Fixed 2026-09-20, later the same night

`render()` called `stepBodyOf(step, ctx)` with **no lane**, so stepBody fell back
to the lane engine run over a plan of ONE step, and the contract, Done-when, rail
and badge followed that rather than the board — a different lane for 18 of 38
steps on a messy tenant. It now passes `{lane, blockers, prerequisiteLabel}` the
way `Plan.tsx` does. Any reading taken from `render()` before this is suspect.

## Fixed 2026-09-22: what round 4's validators caught the harness saying

Each of these made a persona read something the screen never shows. A round-4
finding that rests on one of them is the harness's until it is re-run.

- **`acceptDirection` overwrote saved answers.** It saved `q.suggested` for
  every question; the screen's Approve saves `q.saved ?? q.suggested`. On
  Marcus's tenant that turned a saved "everyone works remotely, AU only" into a
  trusted office network and AU + NZ (R4-13). It now saves what Approve saves.
- **`plan()` derived from the stored mapping.** `planData.ts` derives the plan
  from `appliedMapping(stored, saved decisions)`; the harness handed
  `runFixture` the stored record, skipping the detected defaults, and
  `decide()` wrote each save back into that record, re-applying every earlier
  one over it. So a Direction question the product shows as a suggestion read
  as saved (Marcus's service accounts, R4-13's second example). `plan()` and
  `rescan()` now derive from `mappingOf(t)`, `ctxOf` renders with the run's
  mapping, and `decide()` only saves.
- **`plan()` showed a step the product withholds.** `planData.ts` drops the
  steps `customerPlanSteps` withholds from every customer surface (today the
  admin-portals policy) before anything reads them; the harness kept them, so
  personas rendered and filed a step no screen draws, and "Known walls" above
  named it. `plan()` and `rescan()` now drop them too.
- **`lanes()` was not the board.** It built rows from the steps only, so the
  Cleanup rows — the drill that holds every policy's enforcement among them —
  were never listed, and a tile naming "Verify Emergency Access" pointed at a
  row a persona could not find (R4-24, Nadia D6). It titled each row
  `step.title`, the engine's goal statement, which no row draws: the board
  draws `contentTitle(step)` ("Block Device Code Sign-in", not "Device-code
  flow blocked"), and the two differ on 22 of 40 steps of `mid` (R4-40,
  R4-47). It grouped by `step.kind` where the board reads the content kind,
  named a prerequisite by `step.title` where Plan.tsx's `titleOf` reads
  `plainTitle || title` (so `render()`'s tiles quoted goal statements too), and
  read every Cleanup row as incomplete regardless of the emergency-access
  answers. All five now match `Plan.tsx`.
- **`render().state` was a state no screen draws.** It was
  `contract.state.word / stage`, and persona libraries that copied the board
  readings printed `contract.state.badge`. The head draws `badgeLabel(contract)`,
  which reads the lane first: Sam's security-defaults, per-user MFA and
  Prepare Your Team steps read "Ready" to the persona and "On Hold" on the
  screen and the board (R4-22, R4-33). `render()` now returns `badge` and
  `fact`, and `stepView()` gives scripts the body without copying the board.
- **Every date was in the machine's time zone.** The product formats every
  date in the plan's display zone, which planData.ts sets from the stored
  mapping before it derives or draws anything. The harness never set it, so a
  Sydney tenant's 7:00 PM scan read as 3:00 AM on a Denver machine, and a date
  near midnight moved a day. `plan`, `rescan`, `lanes`, `render`,
  `stepView` and `ctxOf` now set the tenant's zone first. Dates quoted by
  round-4 personas were in the machine zone (R4-55's note, r4-sam-05).
- **`enrolMfa` never enrolled people whose only method is turned off.** It
  skipped anyone with any registered method, so a person holding only a phone
  number, in a tenant with text and voice disabled, never registered the method
  the campaign asks for. On Sam's tenant that is 669 people, and the readiness
  gate stopped at 86% however often it ran (R4-41). It now enrols them, by the
  product's own reading of which methods the tenant allows.
- **Every persona tenant but the demo ran on a baseline that never ships.**
  `fixture()` builds every non-demo tenant on an eight-policy synthetic
  baseline (fixtures/index.ts, whose comment said the opposite until
  2026-09-22); the product loads only the pinned package. Jordan, Marcus, Sam,
  Nadia and Priya all ran on the stand-in, so **every round-4 finding about
  policy content — apps, filters, names, JSON bodies — needs re-running on the
  pin before it is worked** (R4-10, R4-23). `tenant()` now re-bases on the pin
  by default.
- **`days()` and `enrolMfa()` counted people without a clock.** They called
  `activePeopleIds(snapshot)` with no time and no exclusions, so on Marcus's
  tenant 284 accounts counted as active where the product counts 246: 33
  dormant, 3 service accounts, 2 emergency accounts. Those signed in on every
  day of every report-only window and were enrolled with the team.
  `activePeople(t)` is now the product's reading (the scan's clock, service and
  emergency accounts out), and both use it. Found fixing the harness, not by a
  validator.

## Rules

- This directory is gitignored except the harness core — `harness.ts`, this
  file, `r3-tenants.ts` and `r3-journey.ts` — which is tracked (.gitignore
  says why). Scripts, probes and round reports stay untracked. Nothing here
  ships. The core's self-check is `src/testing/personaHarness.test.ts`: it
  imports the three `.ts` files, so the project's typecheck covers them, and
  it asserts each thing the harness once said that the screen does not. After
  changing the core, run `npm run verify -- src/testing/personaHarness.test.ts`;
  CI runs it with the suite. A fix to the harness adds its assertion there.
- Quote what the product renders. `render()` reads the same `stepBodyOf` the
  screen does.
- Before reporting a defect, check it is not the harness. The last run reported
  a class of them that were.
