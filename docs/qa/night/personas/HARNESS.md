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

## What it can do now

```ts
import { tenant, plan, rescan, observations, deploy, days,
         settleAll, settleFoundations, prepareEmergencyAccess,
         configurePasskeys, acceptDirection, enrolMfa,
         decide, answers, render, lanes, ctxOf, mappingOf } from './harness.ts'
```

- `t.mapping` is the tenant's STORED mapping record and `t.decisions` the
  step decisions the person saved — two records, as the app keeps them. What
  every surface reads is `mappingOf(t)` (= `run.input.mapping`): the stored
  record with the detected defaults applied, then the saved decisions over it
  (`appliedMapping`, as `planData.ts` derives it). `decide()` saves a
  decision and does not touch `t.mapping`; read `mappingOf(t)` after it.

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
- `enrolMfa(t)` — the team registers a method. The one action that moves the MFA
  readiness gate.
- `days(t, n, {failures})` — n days pass: the clock moves, the scan's collected
  window moves with it, and everyone a report-only policy covers signs in during
  it. `failures` seeds sign-ins the policy would have stopped.
- `deploy(t, step, 'exact' | 'enforced' | 'unconfigured', { held? })` — does what
  the step offers. An `update` operation (turning a policy on) patches the row its
  own `policyId` names, and merges `conditions` the way Graph does: a section the
  patch carries replaces that section, one it leaves out stays. `'enforced'` also
  turns an updated policy on. `{ held: true }` applies what the step declares and
  withholds today as well (a switch a readiness threshold holds): without it an
  "everything on" stage never applies a held switch, and never reaches what
  follows one.

## The journey that now works, on `mid`

```
settled   done 12, ready 19, blocked 6
created   in-report-only 11
day 8     ready-to-enforce 9
enforced  done 19
```

## Known walls, which are the product's and not the harness's

1. **The MFA readiness gate reads "not measured".** `methodReadiness` returns a
   null percentage when ANY person in scope has an unreadable method, so the
   gate says "waits for MFA readiness to reach 90%; it is not measured today" —
   a threshold with no number, and nothing the reader can move. The count exists
   one line away ("209 of 279 ... not yet established for 70") and the gate does
   not use it.
2. `device-registration-mfa` sits behind that gate and never advances. (This
   used to name `admin-portals-protected` too; the product withholds that step
   from every surface, and since 2026-09-22 the harness does as well.)

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
  personas rendered and filed a step no screen draws, and "Known walls" below
  named it. `plan()` and `rescan()` now drop them too.

## Rules

- Nothing in this directory goes in the repo; it is gitignored.
- Quote what the product renders. `render()` reads the same `stepBodyOf` the
  screen does.
- Before reporting a defect, check it is not the harness. The last run reported
  a class of them that were.
