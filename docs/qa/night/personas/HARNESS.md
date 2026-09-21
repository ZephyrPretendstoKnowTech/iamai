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
         decide, answers, render, lanes, ctxOf } from './harness.ts'
```

- `plan(t)` — the FIRST scan. No prior record, by definition.
- `observations(run, prior?)` — what that scan recorded, to hand to the next one.
- `rescan(t, prior, now?)` — **always pass `prior`.** A rescan without it is
  another first scan.
- `prepareEmergencyAccess(t)` — registers an approved **hardware** key on each
  emergency account. Not the Authenticator: `requiredModels()` is ordered
  Authenticator-first and its first entry is a phone credential, which the
  product correctly refuses for break-glass.
- `configurePasskeys(t)` — applies the passkey target the step resolves.
- `acceptDirection(t, run)` — answers all four Direction steps with the
  product's OWN `suggested` value for each question. A persona who would answer
  differently calls `decide()` for that question instead.
- `settleFoundations` = emergency access + passkeys. `settleAll` = those plus
  the Direction answers.
- `enrolMfa(t)` — the team registers a method. The one action that moves the MFA
  readiness gate.
- `days(t, n, {failures})` — n days pass: the clock moves, the scan's collected
  window moves with it, and everyone a report-only policy covers signs in during
  it. `failures` seeds sign-ins the policy would have stopped.
- `deploy(t, step, 'exact' | 'enforced' | 'unconfigured')` — does what the step
  says. An `update` operation (turning a policy on) patches the row the step's
  member already owns.

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
2. Two policies (`admin-portals-protected`, `device-registration-mfa`) sit
   behind that gate and never advance.

## Fixed 2026-09-20, later the same night

`render()` called `stepBodyOf(step, ctx)` with **no lane**, so stepBody fell back
to the lane engine run over a plan of ONE step, and the contract, Done-when, rail
and badge followed that rather than the board — a different lane for 18 of 38
steps on a messy tenant. It now passes `{lane, blockers, prerequisiteLabel}` the
way `Plan.tsx` does. Any reading taken from `render()` before this is suspect.

## Rules

- Nothing in this directory goes in the repo; it is gitignored.
- Quote what the product renders. `render()` reads the same `stepBodyOf` the
  screen does.
- Before reporting a defect, check it is not the harness. The last run reported
  a class of them that were.
