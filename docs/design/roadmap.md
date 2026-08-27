# Design: roadmap v1

**Status:** ready to implement after intents.md.
**Inputs:** coverage results (intents.md), mapping answers, readiness table
(§10 scoring), Lane A/B derived tables, licence capabilities, plan-file.md.
**Output:** the Roadmap page and the plan file.

## 1. What a step is

```
Step {
  id: string                     // stable, e.g. "s-mfa-all-users"; survives re-scans
  goalId: string
  phase: 0..7
  kind: 'prerequisite' | 'create' | 'adjust' | 'verify' | 'enforce' | 'recurring'
  title: string                  // plain language, imperative: "Block legacy authentication"
  why: string                    // one paragraph; author Intent text from the baseline docs when present, attributed
  status: 'done' | 'ready' | 'blocked' | 'in-report-only' | 'ready-to-enforce' | 'skipped'
  blockedBy: StepId[]            // unmet prerequisites
  population: { total, active, admins, guests, ids }   // who the change touches
  readiness: Readiness           // goal-specific numbers, see §4
  evidence: Evidence             // Lane B numbers, see §5
  action: Action                 // see §3
  exitCriteria: string[]         // what must be true to move to the next status
  rollback: string               // how to undo, one paragraph
  history: { at, from, to, note }[]
}
```

Statuses move only forward, except `skipped` (user choice, needs a reason —
"not applicable to us", never "accepted risk").

## 2. Phases and ordering

Goals carry a phase in the catalogue. Within a phase, steps order by a risk
score: `population.active × severity − readiness.percent`, where severity is
3 for block, 2 for a strength or device requirement, 1 for MFA/session. Lowest
risk first, so early wins build confidence.

| Phase | Name | Contents |
|---|---|---|
| 0 | Foundations | mapping outcomes that don't exist yet (break-glass, exclusion group, trusted locations, custom strengths), security defaults off, per-user MFA migration, registration campaign on, the operator's own path checked |
| 1 | Low-impact blocks | legacy auth, device code, auth transfer — evidence usually shows zero affected |
| 2 | MFA for everyone | verification campaign → pilot → enforce |
| 3 | Admin hardening | phishing-resistant for admins, admin portals, admin session, Azure management |
| 4 | Guests and locations | guest MFA, geo restriction, registration protection |
| 5 | Devices | managed-device requirement, platform block, mobile app protection, device registration |
| 6 | Sessions | BYOD session controls, token protection |
| 7 | Advanced (licence permitting) | sign-in risk, user risk, workload identities |

A step whose goal is **enforced** in coverage is created with status `done` —
the plan shows progress from the first scan.

## 3. Actions

`create` (goal absent): the baseline policy for the goal, with every
tenant-specific reference replaced by the mapped object, `state:
enabledForReportingButNotEnforced`, and `description` carrying
`[IAMAI:<planId>:<stepId>]`. Presented three ways: the JSON to download; the
Entra admin center click path (Protection → Conditional Access → Policies →
New policy, with each field value listed in the portal's own vocabulary); and
a PowerShell one-liner using the JSON file with the Graph SDK. All read from
the same object.

`adjust` (goal partial): the specific diff, in words and as the field change —
"add group *Contractors* to the include list", "change grant from MFA to
Phishing-resistant MFA", "remove *Service Accounts* from exclusions", "change
persistent browser to Never" — plus the same three presentations for the
target policy body.

`prerequisite`: a how-to page for the object (create a break-glass account
per Microsoft guidance, create a named location, create an authentication
strength with these combinations), with the validation the Mapping step will
run when it exists.

`verify` (phase 2 only in v1): the verification campaign — list of users by
state, comms template placeholder, TAP guidance for `none`, the pilot group
suggestion when department data exists.

`enforce`: change `state` to `enabled` — click path only.

`recurring`: break-glass drill (last sign-in older than 90 days), re-scan cadence.

## 4. Readiness per goal

| Goal family | Readiness numbers shown on the step |
|---|---|
| MFA goals | verified / likely viable / not challenged / unverified / none, over the step's population; `percent` = (verified + likelyViable) / active |
| Admin goals | admins with a phishing-resistant method / admins; eligible-only admins listed as out of scope until activation |
| Device goals | users with ≥1 compliant device / active members; OS mix |
| Guest goals | active guests; cross-tenant MFA trust state |
| Block goals | see evidence — readiness is evidence |
| Location goals | countries seen in the window vs the allowed list; users seen outside it |

## 5. Evidence per goal (Lane B derived tables)

- Block goals: users seen using the blocked thing in the window (legacy protocol by type, device code, auth transfer) — the exact list is the blast radius.
- Once the created policy exists in report-only: its `reportOnlyFailure` / `reportOnlyInterrupted` counts and users, days observed, sign-ins observed. Exit criterion for `ready-to-enforce`: ≥ 7 days observed, ≥ 1 sign-in per active user in the population or ≥ 500 sign-ins, 0 failures — thresholds are named constants.
- Currently-failing cohort against existing enforced policies, shown at the top of the roadmap as "blocked today".
- When evidence is `insufficient`, steps say so and fall back to readiness alone; nothing is hidden.

## 6. Gating

A step is `blocked` when: a phase-0 prerequisite it references is not done;
readiness.percent is below the goal's threshold (MFA 90%, admins 100%, devices
80% — constants); or its population contains the operator without a satisfied
What-If check. Blocked steps show exactly what unblocks them.

## 7. Progress on re-scan

After each scan: match tenant policies to steps by description tag, then by
intent fingerprint; move `create` steps to `in-report-only` when the policy
appears in report-only, to `ready-to-enforce` when evidence meets the exit
criterion, to `done` when enabled; move `adjust` steps to `done` when
coverage becomes enforced; append history; write a checkpoint (plan-file.md
§checkpoints). Drift: a `done` step whose goal regresses re-opens as `adjust`
with a "changed since <date>" note.

## 8. Presentation

Roadmap page: "blocked today" banner when non-empty; phase timeline with
counts (done / ready / blocked); step cards expandable to the full detail
above; filters by status and phase. Print stylesheet renders the full plan in
phase order with the JSON in monospace blocks. "Save plan" writes the plan file
per plan-file.md; "Load plan" restores and re-runs progress matching.

## 9. Tests

1. Enforced goal → step created as `done`.
2. Absent goal with mapped references → `create` step whose JSON contains the mapped ids and the tag, state report-only.
3. Unresolved reference → step `blocked` by the phase-0 prerequisite.
4. Partial `weaker-control` → `adjust` step with the exact field change.
5. MFA step with readiness 60% → `blocked`, with the unblocking numbers.
6. Re-scan finds the tagged policy in report-only → `in-report-only`; evidence meets criterion → `ready-to-enforce`; enabled → `done`.
7. Regression after `done` → re-opened `adjust` with note.
8. Skipped step requires a reason; never shown as risk accepted.
