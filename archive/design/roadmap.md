# Design: roadmap v1

**Status:** implemented (`src/roadmap/`); §11 records what changed after this design was written.
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

## 10. First run and the 2026-08-27 redesign

The first live run (prompt 07) produced ~49 phase-0 steps, almost all "map
service principal X" — the engine was right and the experience was wrong.
Lachlan's review that night reset the product from checklist to advisor;
this section records what changed in the roadmap as built (all tests in §9
still pass, plus schedule tests):

- **Phase 0 collapsed.** One "answer N setup questions" step when required
  Setup answers are missing; real create steps only for break-glass, the
  exclusions group, and a trusted location when they genuinely don't exist;
  first-party apps, strengths, and persona groups are auto-resolved (persona
  groups are created inside the step that targets them).
- **Impact per step, for this tenant**: block steps quote the last 30 days'
  usage ("zero sign-ins would have been affected"); MFA steps quote how many
  active users aren't verified yet.
- **Safe-today lane**: zero-usage blocks sort first and are promoted on the
  Overview as free security.
- **Handle-with-care users** (Setup answer): named on every step that
  touches them with per-user setup notes, sequenced last, and enforcement
  gated (`ready-to-enforce` requires `highCare.ready` in addition to the
  evidence criterion). Never an exclusion.
- **Comms drafts**: user-facing steps carry a paste-ready announcement with
  the scheduled date and the aka.ms/mfasetup link.
- **Operator self-safety**: steps whose population includes the signed-in
  operator state whether the operator has a strong method.
- **Learn link + TLDR + CIS tags** per goal (`data/goals.json`).
- **Auto-schedule** (`schedule.ts`): phases get calendar dates from a
  chosen start; duration scales with work and includes the 7-day report-only
  window; weekday starts; 2–4 weeks typical, longer stated honestly.
- **Danger areas** (`dangers.ts`): blocked-today users, high-care users who
  can't pass MFA, admins without phishing-resistant methods, the operator's
  own gap, stale break-glass — each with named people, the exact Entra path,
  and a link.
- **Names, never IDs** via `src/names.ts` + `getByIds` resolution.

Still open: a live run of the redesigned plan against the tenant with Setup
completed (the dev capture `roadmap-run` records it when opened with
`?dev=1`).

## 12. Pace by tenant size (prompt 18, 2026-08-28)

- The pace presets are gone. `constants.ts` holds the size bands from
  ux-review-03 §A3: small (≤30 active users, 4 weeks, 2-week verification
  window), mid (31–300, 8 weeks, 4-week window), large (>300, 12 weeks,
  6-week window). Observation is always 7 days. The band is detected from
  active users and can be overridden on the Overview; the override travels
  in the plan file as `schedule.band`.
- Sequence: day 0 (foundation work, report-only creation) → registration and
  verification window → observation → enforcement waves in phase order. The
  waves share what the band leaves after the fixed windows (never under 2
  days each), so the total lands on the band's expected length. A plan with
  more waves than fit runs over honestly: `Schedule.extendedBy` names the
  steps in the waves past the expected end and the Overview says so.
- Evidence-driven: the verification step is `done` when MFA readiness meets
  the threshold on a scan; its window then drops to 0 and every wave pulls
  forward. The end date is recomputed on every scan.
- Verified in `schedule.test.ts` with the shape of the live tenant (12
  active users, one verification campaign, five phases): small band, 4
  weeks, 14-day window, 7-day observation. No scheduler fix was needed.

## 11. Prompts 12–13 and the first audit (2026-08-27)

- **Waves, not phases in series** (`schedule.ts`): day 0 holds foundation
  work and creates every new policy in report-only; one shared observation
  window; enforcement waves follow phase order; done steps take no time;
  blocked steps move after their blocker. Pace presets `PACES` (fast /
  standard / cautious) live in `constants.ts`.
- **Blockers are typed** (`Blocker` in `types.ts`): a step, a Setup question,
  a readiness threshold, or evidence — rendered by name with a link. The
  §6 "operator without a satisfied What-If check" gate was never built; the
  operator gets an evidence sentence instead.
- **Phase 8 removed**: ad-hoc goals take the phase their facts imply and a
  generated plain title.
- **Adjust steps edit the tenant's policy** (name, id, state; PATCH), never a
  second policy named after the baseline.
- **Naming**: new policies follow the tenant's prefix and separator.
- Only the break-glass drill exists as a recurring step; there is no
  re-scan-cadence step.
- `Step` carries `whyAttribution, blockers, impact, safeToday, highCare,
  comms, learn, includesOperator, operatorSafe, operatorNote, operatorWhatIf,
  naming` beyond §1.
