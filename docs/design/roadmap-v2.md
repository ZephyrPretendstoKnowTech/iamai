# Design: roadmap v2 — the plan as the product

**Status:** ready to implement (prompts 24 and 25).
**Why now:** everything else in IAMAI exists to produce this page. It is currently a
correct list of changes in a sensible order. It is not yet a plan a stranger could hand to
a change board, execute over six weeks, and be measured against. This document is the gap.

## 0. What "bulletproof" means

Five tests. A roadmap is bulletproof when it passes all five for a tenant of any size:

1. **Executable.** Every step can be carried out by a competent admin with no further
   research: the exact object to create or change, the exact values, in the portal's own
   words, with nothing left as an exercise.
2. **Safe.** No step can be executed in the order given and lock anyone out, including the
   operator, the break-glass accounts, and any service account the tenant depends on.
3. **Sequenced for reality.** Dependencies are real dependencies, rings are real rings, and
   the dates account for the human work (registration, comms, approvals), not just the
   clicks.
4. **Trackable.** After any change, a re-scan can say what was done, when, by which step,
   and whether it worked, without the user telling it anything.
5. **Scale-honest.** The same plan shape works at 12 users and at 25,000, with populations
   expressed in ways that stay useful (cohorts and counts, not name lists) and durations
   that reflect the size of the human work.

Today IAMAI passes 1 and partly 2. This document addresses 2 through 5.

## 1. Rings: the missing backbone

Real rollouts do not flip a policy for everyone. They go: pilot (a handful of willing
people), ring 1 (IT and early adopters), ring 2 (a department or two), then everyone, with
a pause and a check between each. IAMAI currently models one enforcement event per policy.
That is fine for 12 users and wrong for 300.

Model:

```
Step {
  rings: Ring[]            // ordered; small tenants get 2, large get 4
  currentRing: number
}
Ring {
  index, name              // "Pilot", "Ring 1 - IT", "Ring 2 - Sales and Ops", "Everyone"
  targeting: { kind: 'group'|'all', groupName?: string, memberCount: number }
  entryCriteria: string[]  // what must be true to start this ring
  exitCriteria: string[]   // what must be true to move on
  soakDays: number
  plannedStart, plannedEnd
  actualStart?, actualEnd? // filled by re-scan evidence (§5)
}
```

Ring count and size by tenant band:

| Active users | Rings | Pilot | Ring 1 | Ring 2 | Everyone | Soak per ring |
|---|---|---|---|---|---|---|
| ≤ 30 | 2 | 2 to 3 people | — | — | rest | 3 days |
| 31 to 300 | 3 | 5 people | IT plus 10% | — | rest | 5 days |
| 301 to 3,000 | 4 | 5 people | IT plus 5% | one department | rest | 7 days |
| > 3,000 | 4 | 10 people | IT plus 2% | two departments | rest | 7 to 10 days |

Ring membership is proposed, never invented: the plan names a group to create
("Core - Pilot - MFA enforcement") and gives a suggested member list drawn from readiness
data (verified users first, one admin, never a break-glass account, spread across
departments where `department` exists). The user creates the group; IAMAI never writes.

Rings apply only to steps that can hurt someone: grant requirements, device requirements,
session controls, geo blocks. Prerequisites, report-only creation, and verification steps
have a single ring.

## 2. Sequencing that reflects reality

Current model: phases → waves → dates. Missing pieces:

- **Hard dependencies** (a step cannot start): named location exists before geo policy;
  exclusion group exists before any policy that excludes it; pilot group exists before its
  ring 1; break-glass verified before the first block policy; registration campaign
  complete before MFA enforcement; Intune enrollment coverage before compliant-device
  grant; auth strength object exists before a policy requiring it.
- **Soft dependencies** (a step should not start): two steps that would prompt the same
  population in the same week; more than one high-disruption step per ring; any step whose
  affected population overlaps an in-flight ring by more than 50%.
- **Calendar reality**: no enforcement on Fridays or the day before a holiday (holiday list
  is out of scope; Friday is not), no more than N enforcement events per week (2 for small,
  3 for mid, 5 for large), and an explicit "change freeze" input the user can set.
- **Policy count**: Entra caps Conditional Access policies per tenant. The plan states how
  many policies exist, how many it adds, and warns when the total approaches the cap,
  suggesting consolidation candidates.
- **Naming collisions**: a proposed name that already exists in the tenant gets a suffix
  and a note.

Ordering within a wave stays risk-ordered (value × (6 − disruption)), but the wave itself
is built by the dependency graph, and every date is derived from the graph plus the band's
soak and campaign lengths. The Overview states the critical path: "the plan is 6 weeks
because MFA registration for 214 people takes 4 weeks; everything else fits inside it."

## 3. Populations at scale

At 12 users a name list is perfect. At 5,000 it is noise and a privacy liability.

Rules:
- Under 25 affected users: name them all.
- 25 to 500: show counts by cohort (department, licence, activity, MFA state, device
  state), the 10 riskiest by name (no method, admin, never signed in), and a CSV export.
- Over 500: cohorts and percentages only, the 10 riskiest by name, CSV export, and a note
  that the export is generated in the browser.

Every population statement carries its basis: "1,284 of 4,930 enabled users (26%), of whom
318 have no MFA method". Never a bare percentage.

Targeting advice scales too: at small size the plan says "add these three people to the
pilot group"; at large size it says "create the pilot group and add 10 people matching this
filter", with the filter expressed in Entra's own terms.

## 4. Step content: what a step must contain

A step is complete when it answers, in this order and in the product voice:

1. **What changes** in one sentence a non-technical manager understands.
2. **Why it matters**, one paragraph, with a Microsoft Learn link.
3. **Who it touches** per §3, with the operator's own exposure called out.
4. **What could go wrong**, concretely: the failure modes for this control (for a device
   grant: unmanaged personal machines, kiosks, contractors; for geo: travel, VPN egress,
   roaming; for legacy block: printers, scanners, SMTP relays, line-of-business apps), each
   with the evidence from this tenant that says whether it applies here.
5. **Prerequisites**, each linked to its step.
6. **The change**: portal path, exact values in portal words, the JSON, and a PowerShell
   equivalent. For a change to an existing policy: current value → new value, field by
   field, nothing else touched.
7. **Ring plan**: the rings, their targeting, dates, soak, and criteria.
8. **How to verify**: what to look at, where, and what "good" looks like — report-only
   insights, sign-in log filters (with the exact filter), the affected cohort's success
   rate.
9. **Exit criteria** per ring, measurable, with the numbers filled in for this tenant.
10. **Rollback**: the exact reversal, including the previous policy body stored in the plan
    file so the user can restore it byte for byte, and the expected time to take effect.
11. **Comms**: the announcement for this goal and this ring, dated, with the self-service
    link, and a version for the help desk ("what people will call about, and what to say").
12. **Owner and scheduled date**: editable, stored in the plan, exported to calendar.

## 5. Execution tracking and the journey

The plan must know what has actually happened, from evidence, not from checkboxes.

Detection on every re-scan:
- A policy carrying the step's `[IAMAI:planId:stepId]` description tag: matched directly.
- Otherwise, a policy matching the step's intent fingerprint: matched with a note ("created
  outside the plan, matched by what it does").
- The policy's `createdDateTime` and `modifiedDateTime` give the actual dates: created,
  moved to report-only, enforced, modified after enforcement.
- Report-only results from sign-in records give the soak evidence: days observed, sign-ins
  seen, failures and interruptions by user.
- Removal or disablement of a previously-done step is a regression and reopens it.

Derived per step: `actualStart`, `actualEnd` per ring, `daysInReportOnly`,
`evidenceQuality` (enough sign-ins or not), and a state history with dates and the evidence
that justified each transition. The user is never asked "did you do this?"

**Progress map** (new tab, becomes the default view once a plan is under way):
- A journey band: Planned → In report-only → Soaking → Ready to enforce → Enforced →
  Verified, with each step as a dot moving left to right, coloured by ring.
- A calendar strip: what was actually done each week versus what was planned, so slippage
  is visible rather than recomputed silently.
- Headline: "Started Sep 2. 11 of 31 steps enforced, 4 soaking, 2 slipped by more than a
  week. At the current pace, finished by Nov 3 (planned Oct 20)."
- Per-step: planned versus actual dates, and for slipped steps, the reason if it is
  knowable (blocked by a prerequisite, readiness below threshold, no evidence yet).
- A "what changed since last scan" list: policies created, modified, enabled, disabled,
  exclusion groups that grew, admins added, break-glass last-used. Every entry says whether
  it was part of the plan or not — unplanned changes are the drift signal.

**Re-plan, not re-generate.** When the tenant changes, the plan updates in place: step ids
stay stable, done steps stay done with their evidence, new gaps become new steps appended
to the right wave, and the plan file's history records every revision. The user must never
lose the record of what they did because the baseline was updated or a scan changed a
number.

## 6. Plan file v2

Adds: rings with planned and actual dates; owner and scheduled date per step; state
history with evidence; the previous body for every change step; the baseline pin and the
plan revision; checkpoints as already designed; user edits (skips with reasons, reorders,
custom dates) that survive re-planning. Schema version bump with a migration from v1, and
a test that loads a v1 file and produces an equivalent v2 plan.

## 7. Proving it works for tenants we do not have

This is the part that cannot wait for a customer. Build synthetic tenant fixtures and
assert plan properties against them, in `src/roadmap/fixtures/`:

| Fixture | Shape | What it must prove |
|---|---|---|
| `micro` | 8 users, 1 admin, no P1, security defaults on | Plan is the free-tier ladder; no CA steps; no crash on missing data |
| `small` | 28 users (24 active), 2 admins, P1, 3 policies | No rings (report-only then everyone), 4 weeks; the same-people rule sets the length |
| `getiamai` | 13 users, 4 active, 9 never signed in, 1 admin, P1, no policies | 4 weeks at most, no registration window on the critical path, the 9 dormant accounts as Wave 0 housekeeping |
| `mid` | 280 users (248 active), 14 admins, mixed P1/P2, 11 policies, 3 legacy-auth service accounts | Pilot of 5 then everyone, 8 weeks (the 20-working-day registration window then the same-people chain), service accounts surfaced before the legacy block |
| `large` | 4,900 users (4,171 active), 60 admins, hybrid, Intune partial, 40 policies | 4 rings, 12 weeks (two change windows a week set it), cohort populations only, no name lists, policy-count warning |
| `huge` | 25,000 users (21,331 active), 300 admins, 120 policies, multi-geo | 14 weeks: two windows a week, four 7-day rings, two high-disruption steps that cannot share a window; policy cap warning; renders under 400 ms |
| `messy` | Per-user MFA enforced, security defaults on with CA policies present, 20 disabled policies, 6 report-only, break-glass with SMS only, exclusion group of 400 | 6 weeks; conflicts detected and ordered first; no step proposes something the tenant blocks; policy-count warning at 43 |
| `midflight` | Half the plan already applied, two steps applied out of order, one enforced policy later disabled | 5 weeks; progress map correct, regression reopened, no duplicate steps |
| `hostile` | No sign-in evidence, 403 on registration report, no device data (36 active) | Every step still produced, readiness unknown, criteria adjusted; 34 days (5 weeks by rounding): with nothing in the zero class, MFA, device and session changes chain one soak apart |

Lengths are what the schedule rules (target-state §9) compute for each shape, never
targets: the small band lands at or under 4 weeks, the mid band at or under 8, the
large fixture at 12; `huge` is above the 500-user ceiling this product is for and
computes to 14. The binding constraint is the one sentence the plan itself writes
(`schedule.derivation.criticalPath`), asserted per fixture in properties.test.ts.

Assertions to run over every fixture (property tests, not snapshots):
- No step's execution can strand the operator or a break-glass account (simulate each step
  against the account's known methods and device state).
- Every step's prerequisites appear earlier in the schedule.
- No two high-disruption steps overlap the same ring window for the same population.
- Every date is derivable from the graph; no hard-coded durations.
- Every population statement's numbers sum correctly against the fixture.
- Rendering time under 200 ms for the Steps tab at every size.
- Plan file round-trips with every number preserved.

## 8. What this changes about the Roadmap page

Tabs become: **Progress** (default once started) · Plan (the waves and steps) ·
Danger areas · Schedule (calendar and owners) · Export.
Overview merges into Progress. Timeline becomes Schedule with owners, editable dates, ICS
export, and the critical-path sentence.
