// The canonical Plan case: Report-only / Review required (task 006).
//
// Task 005 proved the healthy half of report-only: a policy the plan deployed,
// watched, with nothing wrong and nothing to submit but the enforcement it has
// not earned. This is the same step three days later, after somebody in the
// tenant changed the policy to something the plan did not ask for. Foundation B
// classifies that as evidence a person has to look at (`reviewRequired`), and
// the whole of this file is about what that must and must not do:
//
//   * the policy stays in Report-only. "Review required" is a condition, and it
//     never becomes a fifth stage.
//   * the step does not advance, and no enforcement action, date, wave, export
//     line or calendar entry appears while it is unresolved.
//   * the issue belongs to the exact policy member it was observed on. Another
//     policy's evidence cannot hold this step, or clear it.
//   * a new event is not a review on its own: an expected move and a rename are
//     both recorded and neither holds anything.
//   * evidence already known harmful stays on the blocked/remediation path and
//     is never softened to "have a look".
//   * a review does not erase history. The window restarts only where Foundation
//     B says the change invalidated it, and where it does the screen shows the
//     new count rather than the old one.
//   * nothing tells the operator to resubmit a policy nobody asked to change.
//
// Every case here runs two real scans of one fixture through the whole engine —
// the first scan's record is what the second one reads — and then asserts what a
// person would see: the frozen Step Contract, the row, the four implementation
// channels, the export view every artifact speaks from, the prompt pack, the
// grounding bundle and the calendar.
//
// Nothing here builds a Step, and nothing here calls an observation helper and
// assembles the result by hand.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { SOLE_MEMBER, observationsOf } from '../../roadmap/tracking.ts'
import { observationsFrom } from '../../roadmap/observation.ts'
import type { StepObservationRecord } from '../../roadmap/observation.ts'
import { heldForReview, nextMilestone } from '../../roadmap/lifecycle.ts'
import { enforcesOnRun, implementationOffered, policyHold, unavailableReason } from '../../roadmap/operations.ts'
import { enforcementTiming, enforcementUnearned, statedEnforcement } from '../../roadmap/forecast.ts'
import { readyWhen } from '../../derive/readyWhen.ts'
import { buildIcs } from '../../roadmap/ics.ts'
import { groundingBundle, stepContext } from '../../roadmap/prompts.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import type { Step } from '../../roadmap/types.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { stepContract } from './stepContract.ts'
import { copyBoxes, stepExportView, stepLines } from './stepExport.ts'
import { jsonOffered, policyJsonText, stepOperations } from './stepJson.ts'
import { powershellFor } from './stepPowerShell.ts'
import { portalNamesFor, stepPortalLines } from './stepPortal.ts'
import { stepInstructions } from './stepInstructions.ts'
import { rowReason, rowWhen } from './rowWhen.ts'
import { statusOf } from './statusWord.ts'
import { stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'

/** The one canonical case, named here so a change to it is a change to this test. */
const FIXTURE = 'demo-week2'
const STEP_ID = 's-goal-block-auth-transfer'
/** The other week-two policy in report-only: its evidence is not this step's. */
const OTHER_ID = 's-goal-token-protection'
const DAY = 86_400_000
/** An account somebody excluded from the policy by hand between the two scans. */
const BY_HAND = '11111111-2222-4333-8444-555555555555'
/** Words that would tell the operator to change the tenant rather than look at what changed. */
const DOING = /\b(create|creating|enforce|enforcing|enable|enabling|submit|resubmit|turn (?:it|the policy) on|delete)\b/i

type Row = Record<string, unknown>

type Case = {
  step: Step
  ctx: StepVarContext
  steps: Step[]
  snapshot: TenantSnapshot
  run: ReturnType<typeof runFixture>
  view: (s: Step) => ReturnType<typeof stepExportView>
}

/**
 * The first scan of the sequence: the demo tenant's own week-two plan, whose
 * "Block Authentication Transfer" policy the scan finds already deployed in
 * report-only. What it leaves behind is the plan record — the one history a
 * regeneration cannot repeat (roadmap/observation.ts) — and every case below
 * reads it as the next scan.
 */
function firstScan(): { run: ReturnType<typeof runFixture>; step: Step; record: Record<string, StepObservationRecord>; policyId: string } {
  const run = runFixture(fixture(FIXTURE))
  const step = run.steps.find((s) => s.id === STEP_ID)
  assert.ok(step, `${FIXTURE} no longer carries ${STEP_ID}`)
  assert.equal(step.state.lifecycle, 'report-only', 'the sequence starts from a policy already deployed and being watched')
  assert.equal(step.state.condition, 'healthy', 'and from nothing being wrong with it')
  assert.ok(step.tracking?.policyId, 'the scan matched a deployed object')
  return { run, step, record: observationsOf(run.steps), policyId: step.tracking!.policyId! }
}

/**
 * The same tenant `days` later, with one policy row edited the way a person in
 * the tenant would have edited it, read against what the first scan recorded.
 *
 * `record` is the first scan's own record unless a case narrows it; nothing here
 * writes an observation. The run goes through the one `applyProgress` the app
 * runs, so the schedule, the forecast and the state reasons are the ones a
 * person would be looking at.
 */
function laterScan(over: { edit?: (row: Row) => void; on?: string; days?: number; record?: (rec: Record<string, StepObservationRecord>) => Record<string, StepObservationRecord>; stepId?: string } = {}): Case {
  const f = fixture(FIXTURE)
  const first = firstScan()
  const target = over.on ?? first.policyId
  const asOf = new Date(Date.parse(f.snapshot.asOf) + (over.days ?? 3) * DAY).toISOString()
  const rows = ((f.snapshot.config.caPolicies?.rows ?? []) as Row[]).map((r) => {
    if (r.id !== target || !over.edit) return r
    const copy = structuredClone(r)
    over.edit(copy)
    return copy
  })
  const snapshot = { ...f.snapshot, asOf, config: { ...f.snapshot.config, caPolicies: { ...f.snapshot.config.caPolicies!, rows } } } as TenantSnapshot
  const record = over.record ? over.record(first.record) : first.record
  const run = runFixture({ ...f, snapshot }, { snapshot }, record)
  const step = run.steps.find((s) => s.id === (over.stepId ?? STEP_ID))
  assert.ok(step, `${over.stepId ?? STEP_ID} left the plan`)
  const ctx: StepVarContext = {
    snapshot,
    mapping: f.mapping,
    nameOf: (id: string) => run.input.names!.label(id),
    signature: 'IT',
    operatorId: f.operatorId,
    now: snapshot.asOf,
    groups: f.groups,
    reportOnlyAt: run.schedule.reportOnlyAt[step.id] ?? null,
  }
  return { step, ctx, steps: run.steps, snapshot, run, view: (s: Step) => stepExportView(s, ctx) }
}

/** The tenant-side edit the canonical case is about: somebody excluded an account nobody asked to exclude. */
const excludeByHand = (row: Row): void => {
  const users = (row.conditions as Record<string, Row>).users
  ;(row.conditions as Record<string, unknown>).users = { ...users, excludeUsers: [...((users.excludeUsers as string[]) ?? []), BY_HAND] }
}

/** The canonical case: the deployed policy materially changed to something the plan did not ask for. */
const canonical = (): Case => laterScan({ edit: excludeByHand })

/** The same three days with nobody touching the policy: the control the gates would otherwise carry through. */
const untouched = (): Case => laterScan()

/** The step's portal lines, as the screen and the exports both render them. */
function portalOf(step: Step, ctx: StepVarContext): string[] | null {
  const cs = contentStepFor(step) as Record<string, unknown> | undefined
  const ex = stepVars(step, ctx)
  return stepPortalLines(step, portalNamesFor(ctx, ex, String(cs?.title ?? step.title)))
}

/** What the opened step would put under What to do (stepInstructions.ts), read once. */
function instructionsOf(step: Step, ctx: StepVarContext): ReturnType<typeof stepInstructions> {
  const cs = contentStepFor(step) as Record<string, unknown> | undefined
  const ex = stepVars(step, ctx) as Record<string, unknown>
  return stepInstructions(step, cs, ex, portalNamesFor(ctx, ex, String(cs?.title ?? step.title)))
}

/** Every sentence about this step that reaches a person or another tool. */
function everythingSaid(c: Case): string {
  const v = c.view(c.step)
  const bundle = groundingBundle({ view: c.view, tenant: 'Tenant', snapshot: c.snapshot, coverage: c.run.coverage, steps: c.run.steps, schedule: c.run.schedule, redacted: false, generated: 'Sep 6, 2026', cleanup: [] }) as unknown as { plan: { steps: Record<string, unknown>[] } }
  return [
    ...v.whatToDo,
    ...v.doneWhen,
    v.dates ?? '',
    rowWhen(c.step),
    rowReason(c.step) ?? '',
    ...stepLines(c.step, c.ctx),
    stepContext(c.step, c.view),
    JSON.stringify(bundle.plan.steps.find((s) => s.id === c.step.id) ?? {}),
    buildIcs(c.run.steps, 'Tenant', 'plan-006', c.view)
      .split('BEGIN:VEVENT')
      .find((x) => x.includes(`-${c.step.id}@iamai`)) ?? '',
    ...copyBoxes(c.step, c.ctx).map((b) => b.text),
  ].join(' | ')
}

// ---- 1. the case is real, and it is Report-only with a condition on it ----

test('006.1: a later scan finds the deployed policy changed to something the plan did not ask for, and the step is Report-only · Review required', () => {
  const { step } = canonical()
  assert.equal(contentStepFor(step)?.kind, 'policy')
  // Both axes, from Foundation B and nowhere else. The stage did not move and
  // the condition did.
  assert.equal(step.state.lifecycle, 'report-only')
  assert.equal(step.state.condition, 'review-required')
  assert.equal(step.status, 'in-report-only', 'the projected word is still the report-only one')
  assert.equal(step.state.satisfied, false)
  assert.equal(step.state.setAside, false)
  // "Review required" is not a stage, and nothing invented one to hold it.
  assert.notEqual(step.state.lifecycle, 'ready-to-enforce')
  assert.notEqual(step.state.lifecycle, 'not-deployed')
  assert.notEqual(step.state.lifecycle, 'enforced')
  assert.equal(statusOf(step).word, 'Report-only', 'the row word is the stage, never the condition')
  // The condition came from the observation, which came from two scans.
  const obs = step.state.observation!
  assert.equal(obs.reviewRequired, true)
  assert.equal(obs.expected, false, 'a change nobody submitted is not called expected')
  assert.equal(obs.changed, 'semantics', 'what moved is what the policy means')
  assert.ok(obs.prior, 'there is an earlier scan behind it')
  assert.equal(obs.prior!.firstSeenAt, fixture(FIXTURE).snapshot.asOf, 'and it is the first scan of this sequence')
  assert.equal(heldForReview(step), true)
})

// ---- 2. the evidence belongs to the exact policy member ----

test('006.2: the review is this member’s own observation, and another policy’s change cannot hold or clear it', () => {
  const c = canonical()
  assert.equal(c.step.state.members.length, 1, 'the canonical case is a single-policy goal')
  const m = c.step.state.members[0]
  assert.equal(m.key, SOLE_MEMBER)
  assert.equal(m.change.reviewRequired, true)
  assert.deepEqual(
    (c.step.tracking?.members ?? []).map((x) => x.reviewRequired),
    [true],
    'the tracking carries the member’s own answer',
  )
  // The other week-two policy is untouched, and it is not in review.
  const other = c.steps.find((s) => s.id === OTHER_ID)!
  assert.notEqual(other.tracking?.policyId, c.step.tracking?.policyId)
  assert.equal(other.state.condition, 'healthy', 'this step’s change did not reach the policy beside it')
  assert.equal(heldForReview(other), false)

  // And the other way round: change the *other* policy and this step is
  // untouched. One member's evidence is one member's.
  const first = firstScan()
  const otherId = first.run.steps.find((s) => s.id === OTHER_ID)!.tracking!.policyId!
  assert.notEqual(otherId, first.policyId)
  const elsewhere = laterScan({ edit: excludeByHand, on: otherId })
  assert.equal(elsewhere.step.state.condition, 'healthy', 'another policy’s change put this step into review')
  assert.equal(heldForReview(elsewhere.step), false)
  const moved = elsewhere.steps.find((s) => s.id === OTHER_ID)!
  assert.equal(moved.state.condition, 'review-required', 'and the step whose policy did change is the one held')
  assert.equal(moved.state.lifecycle, 'report-only')
})

// ---- 3. a new event is not a review on its own ----

test('006.3: an expected move and a rename are both recorded, and neither is Review required merely for being new', () => {
  // A rename is a new sighting of the same policy: the record moves on and
  // nothing else does, because a fingerprint is of what a policy *means*.
  const renamed = laterScan({ edit: (row) => (row.displayName = `${String(row.displayName)} (renamed)`) })
  const r = renamed.step.state.observation!
  assert.ok(r.prior, 'the rename is read against the earlier scan')
  assert.equal(r.latest.lastSeenAt, renamed.snapshot.asOf, 'the sighting is recorded')
  assert.equal(r.reviewRequired, false, 'a rename is not a change to what the policy means')
  assert.equal(renamed.step.state.condition, 'healthy')
  assert.equal(heldForReview(renamed.step), false)

  // A move the plan is rolling towards — the policy turned on — is a new event
  // too, and an expected one. It is recorded, the lifecycle continues under the
  // gates that already existed, and no review is raised for its novelty.
  const enforced = laterScan({ edit: (row) => (row.state = 'enabled') })
  const e = enforced.step.state.observation!
  assert.equal(e.changed, 'state')
  assert.equal(e.expected, true, 'a forward move along the lifecycle is what the plan asked for')
  assert.equal(e.reviewRequired, false)
  assert.notEqual(enforced.step.state.condition, 'review-required', 'an expected event does not hold the step')
  assert.equal(heldForReview(enforced.step), false)
  assert.equal(enforced.step.state.lifecycle, 'enforced', 'and the lifecycle moved on')
})

// ---- 4. evidence already known harmful is not softened to "have a look" ----

test('006.4: a change that reaches the emergency access accounts stays on the blocked path and is never Review required', () => {
  // The same tenant-side edit, taken far enough to be harmful rather than
  // unexplained: the exclusions the policy carried are gone, so its final scope
  // reaches both emergency access accounts (Foundation A).
  const unsafe = laterScan({
    edit: (row) => {
      const users = (row.conditions as Record<string, Row>).users
      ;(row.conditions as Record<string, unknown>).users = { ...users, excludeGroups: [], excludeUsers: [] }
    },
  })
  const step = unsafe.step
  // Foundation B still saw a change nobody asked for — that is not in question.
  assert.equal(step.state.observation?.reviewRequired, true)
  // But what is *known* about it outranks what has to be looked at: the step is
  // blocked, and the answer every channel reads is the emergency one.
  assert.equal(step.state.condition, 'blocked')
  assert.notEqual(step.state.condition, 'review-required')
  assert.equal(unavailableReason(step), 'unsafe-emergency-access')
  assert.equal(heldForReview(step), false, 'a confirmed-unsafe policy is not merely held for a look')
  assert.equal(implementationOffered(step), false)
  const c = stepContract(step, unsafe.ctx)
  assert.equal(c.whatToDo.kind, 'resolve')
  assert.notEqual(c.whatToDo.text, nextMilestone(canonical().step).label, 'the unsafe step gives the review action instead of its own')
  assert.match(c.whatToDo.text, /emergency access/i)
  assert.deepEqual(c.implementation, { offered: false, reason: 'unsafe-emergency-access', hold: null, because: c.whatToDo.text })
})

// ---- 5. a review does not reset the clock; a material change does ----

test('006.5: three more days of the same policy keep their window, and a materially changed policy shows the new count rather than the old', () => {
  // Nobody touched it: the window carries, and the days are the days.
  const kept = untouched()
  assert.equal(kept.step.state.observation?.continuity, 'continues')
  assert.equal(kept.step.tracking?.daysInReportOnly, 5, 'a new scan does not restart a window on its own')

  // The material change did restart it, and it is Foundation B that says so.
  const c = canonical()
  const obs = c.step.state.observation!
  assert.equal(obs.continuity, 'reset', 'the frozen model invalidated the earlier evidence')
  assert.equal(obs.latest.firstSeenAt, c.snapshot.asOf, 'the policy deployed now has been watched since this scan')
  assert.equal(c.step.tracking?.daysInReportOnly, 0)
  // So the screen shows the new count, and the old one appears nowhere.
  const ready = readyWhen(c.step)!
  assert.equal(ready.days, 0)
  const said = everythingSaid(c)
  assert.ok(!said.includes(absoluteDate(obs.prior!.firstSeenAt)), `the old window’s day is still being counted: ${said}`)
  assert.ok(said.includes(absoluteDate(c.snapshot.asOf)), 'and the day the policy has actually been watched from is stated')
})

// ---- 6. advancement is held even where every other gate passes ----

test('006.6: an unresolved review holds the step at Report-only even when the observation window and the records would carry it', () => {
  // A plan record that does not name the object it watched — a file saved before
  // artifact identity was recorded — still holds the fingerprint it watched, so
  // a later scan can see the policy was rewritten. Microsoft's own evidence for
  // this object is admissible in that case, so the *time gate is met*: five days
  // in report-only, the window closed on Aug 29. Nothing but the review is left
  // to hold it, and it does.
  const c = laterScan({
    edit: excludeByHand,
    record: (rec) => {
      const raw = JSON.parse(JSON.stringify({ observations: rec })) as { observations: Record<string, { members: Record<string, Record<string, unknown>> }> }
      delete raw.observations[STEP_ID].members[SOLE_MEMBER].artifact
      return observationsFrom(raw)
    },
  })
  const t = c.step.tracking!
  assert.equal(c.step.state.observation?.reviewRequired, true)
  assert.ok(t.daysInReportOnly >= 3, `the window is satisfied (${t.daysInReportOnly} days)`)
  assert.ok(t.readyOn !== null && Date.parse(t.readyOn) <= Date.parse(c.snapshot.asOf), 'and the time gate has passed')
  assert.deepEqual(
    (t.members ?? []).map((m) => m.ready),
    [false],
    'the member is ready on nothing while its policy is not what was watched',
  )
  assert.equal(c.step.state.lifecycle, 'report-only', 'so the step did not advance')
  assert.notEqual(c.step.status, 'ready-to-enforce')
  assert.equal(c.step.events, null, 'and nothing dated an enforcement for it')
  // The same window with nothing wrong does carry the step through: the hold is
  // the review and not the arithmetic.
  const control = untouched()
  assert.equal(control.step.state.lifecycle, 'ready-to-enforce', 'the control proves the gates would otherwise have advanced it')
  assert.equal(control.step.state.condition, 'healthy')
})

// ---- 7. unknown is not expected, and not clean ----

test('006.7: evidence the record cannot attribute stays unknown, and nothing downstream calls it expected or clean', () => {
  const c = laterScan({
    edit: excludeByHand,
    record: (rec) => {
      const raw = JSON.parse(JSON.stringify({ observations: rec })) as { observations: Record<string, { members: Record<string, Record<string, unknown>> }> }
      delete raw.observations[STEP_ID].members[SOLE_MEMBER].artifact
      return observationsFrom(raw)
    },
  })
  const obs = c.step.state.observation!
  assert.equal(obs.continuity, 'unknown', 'the record cannot say which object it was watching')
  assert.equal(obs.expected, false, 'so nothing about the change can be shown to be what the plan asked for')
  assert.equal(obs.reviewRequired, true)
  assert.equal(c.step.state.condition, 'review-required', 'and unknown is not quietly resolved into healthy')
  assert.equal(heldForReview(c.step), true)
  assert.deepEqual(statedEnforcement(c.step), { basis: 'unearned', at: null })
})

// ---- 8. no enforcement anywhere while the review is unresolved ----

test('006.8: while the review is unresolved there is no enforcing operation, date, wave or calendar entry, on any surface', () => {
  const c = canonical()
  const { step, run } = c
  assert.equal(enforcementUnearned(step), true)
  assert.deepEqual(statedEnforcement(step), { basis: 'unearned', at: null })
  assert.equal(step.events, null, 'the step carries no enforce event')
  assert.equal(run.schedule.waveOf[step.id], undefined, 'and no enforcement wave carries it')
  for (const w of run.schedule.waves) assert.ok(!w.stepIds.includes(step.id), `enforcement wave ${w.wave} still carries it`)
  assert.equal(step.comms, null, 'no dated announcement survives on it')
  // Nothing a person could run enforces the moment it is submitted.
  for (const op of stepOperations(step)) assert.equal(enforcesOnRun(op), false)
  assert.doesNotMatch(policyJsonText(step), /"state"\s*:\s*"enabled"/)
  // And no projected enforcement instant is stated as this step's date anywhere.
  const said = everythingSaid(c)
  for (const at of [enforcementTiming(step).at, run.schedule.forecastOnly?.[step.id]?.events?.enforce.at ?? null]) {
    if (at === null) continue
    assert.ok(!said.includes(absoluteDate(at)), `the enforcement day is stated as this step's date: ${said}`)
    assert.ok(!said.includes(`DATE:${at.slice(0, 10).replace(/-/g, '')}`), 'the calendar books the enforcement')
  }
  // The next milestone is the review, and it carries no date: nothing schedules
  // a person looking at something.
  const m = nextMilestone(step)
  assert.equal(m.kind, 'resolve')
  assert.equal(m.at, null)
  assert.equal(m.gatedBy, step.state.observation!.note, 'and it names what has to clear first')
  // The row's date column is the hold, not a day something may happen on.
  assert.equal(rowWhen(step), 'held until reviewed')
  assert.equal(rowReason(step), step.state.observation!.note, 'and the collapsed row carries what was seen')
  assert.ok(!rowWhen(step).includes(absoluteDate(readyWhen(step)!.date)), 'the row still offers the window’s date as this step’s next day')
})

// ---- 9. what the screen says ----

test('006.9: the Step Contract states the stage, the condition, what changed, what to fix and what to do', () => {
  const c = canonical()
  const contract = stepContract(c.step, c.ctx)
  // Both axes are stated, in words, and apart from one another.
  assert.equal(contract.state.lifecycle, 'report-only')
  assert.equal(contract.state.condition, 'review-required')
  assert.equal(contract.state.stage, 'Report-only')
  assert.equal(contract.state.conditionLabel, 'Review required')
  assert.notEqual(contract.state.stage, contract.state.conditionLabel, 'the condition never stands in for the stage')
  // What IAMAI found carries the evidence, in Foundation B's own words.
  assert.ok(
    contract.found.some((f) => f.text === c.step.state.observation!.note),
    `the finding does not report what changed: ${JSON.stringify(contract.found)}`,
  )
  // Fix before continuing names the policy that has to be looked at.
  assert.equal(contract.fix.length, 1)
  assert.equal(contract.fix[0].key, `review:${SOLE_MEMBER}`)
  assert.ok(contract.fix[0].text.includes(c.step.tracking!.policyName!), `the fix does not name the policy: ${contract.fix[0].text}`)
  assert.notEqual(contract.fix[0].text, c.step.state.observation!.note, 'and it is not the finding said twice')
  // What to do is to keep watching, look at the change and scan again — and it
  // is never an instruction to change the tenant.
  assert.equal(contract.whatToDo.kind, 'resolve')
  assert.match(contract.whatToDo.text, /report-only/i)
  assert.match(contract.whatToDo.text, /changed/i)
  assert.match(contract.whatToDo.text, /scan again/i)
  assert.doesNotMatch(contract.whatToDo.text, DOING, `What to do tells the operator to change the tenant: ${contract.whatToDo.text}`)
  // Done when leads with the review, and keeps the step's own gates behind it.
  assert.ok(contract.doneWhen.length > 1)
  assert.match(contract.doneWhen[0], /accounted for/i)
  assert.ok(
    contract.doneWhen.slice(1).some((l) => /^Time:/.test(l)),
    `the step’s own gates were dropped: ${JSON.stringify(contract.doneWhen)}`,
  )
  // The member line says the policy needs a look.
  assert.equal(contract.members.length, 1)
  assert.equal(contract.members[0].reviewRequired, true)
  // The Next line stays absent: Foundation B has no date for it, and What to do
  // is the same fact said better.
  assert.equal(contract.milestone.line, null)
})

// ---- 10. nothing asks the operator to resubmit a policy nobody asked to change ----

test('006.10: no portal, JSON or PowerShell instruction appears merely because the step is held', () => {
  const c = canonical()
  const { step, ctx } = c
  assert.equal(implementationOffered(step), false)
  assert.equal(unavailableReason(step), null, 'the policy is writable; it is simply not what today asks for')
  assert.equal(policyHold(step), 'observation-incomplete')
  assert.equal(jsonOffered(step), false)
  assert.deepEqual(stepOperations(step), [])
  assert.equal(portalOf(step, ctx), null)
  assert.doesNotMatch(powershellFor(stepOperations(step)), /New-MgIdentityConditionalAccessPolicy|Update-MgIdentityConditionalAccessPolicy/)
  const screen = instructionsOf(step, ctx)
  assert.equal(screen.held, true)
  assert.equal(screen.portal, null)
  assert.deepEqual(screen.before, [])
  assert.deepEqual(screen.steps, [])
  // And the export view's What to do is the review action alone.
  assert.deepEqual(c.view(step).whatToDo, [stepContract(step, ctx).whatToDo.text])
})

// ---- 11. the screen, the exports, the prompts and the calendar agree ----

test('006.11: every artifact says Report-only, held for review, review-and-scan-again, and none of them says ready to enforce', () => {
  const c = canonical()
  const v = c.view(c.step)
  const action = stepContract(c.step, c.ctx).whatToDo.text
  // The Dates line states the hold rather than a review day the window derived.
  assert.ok(v.dates, 'the step has a Dates line')
  assert.match(v.dates!, /Held until/i)
  assert.ok(!v.dates!.includes(absoluteDate(readyWhen(c.step)!.date)), `the Dates line still offers the window’s date: ${v.dates}`)
  // Done when carries the review in the artifacts too, not only on screen.
  assert.deepEqual(v.doneWhen, stepContract(c.step, c.ctx).doneWhen, 'the export’s completion is the screen’s')
  // The grounding bundle and the calendar entry say the same thing.
  const bundle = groundingBundle({ view: c.view, tenant: 'Tenant', snapshot: c.snapshot, coverage: c.run.coverage, steps: c.run.steps, schedule: c.run.schedule, redacted: false, generated: 'Sep 6, 2026', cleanup: [] }) as unknown as { plan: { steps: Record<string, unknown>[] } }
  const b = bundle.plan.steps.find((s) => s.id === c.step.id) as Record<string, unknown>
  assert.equal(b.status, 'in-report-only')
  assert.deepEqual(b.enforcement, { basis: 'unearned', at: null })
  assert.deepEqual(b.whatToDo, [action])
  assert.equal(b.dates, v.dates)
  const entry = buildIcs(c.run.steps, 'Tenant', 'plan-006', c.view)
    .split('BEGIN:VEVENT')
    .find((x) => x.includes(`-${c.step.id}@iamai`))
  assert.ok(entry, 'the step has a calendar entry')
  assert.match(entry!, /Held until/i, 'the calendar entry states the hold')
  assert.match(entry!, /DTSTART;VALUE=DATE:20260831/, 'and it is due the day IAMAI saw the change, not the day the window would have closed')
  // Nothing anywhere claims the step is ready, or tells anyone to enforce.
  const said = everythingSaid(c)
  assert.doesNotMatch(said, /ready to enforce/i, `an artifact claims the step is ready: ${said}`)
  assert.doesNotMatch(said, /no issues remain/i)
  // And no surface that answers "what next" offers the window's own date as this
  // step's next day. The date is still stated under Done when, where it is one of
  // the gates that has to hold rather than something about to happen.
  const readyDay = absoluteDate(readyWhen(c.step)!.date)
  const next = [v.dates ?? '', rowWhen(c.step), rowReason(c.step) ?? '', ...v.whatToDo, nextMilestone(c.step).label].join(' | ')
  assert.ok(!next.includes(readyDay), `the window's date is offered as this step's next day: ${next}`)
  assert.match(stepContext(c.step, c.view), /not yet dated/i, 'the prompt pack dates the change')
})

// ---- 12. the whole path, held together ----

test('006.12: the review condition survives the whole path, and every consumer reads it from Foundation B', () => {
  const c = canonical()
  const control = untouched()
  // Two runs of one tenant that differ by one tenant-side edit, and the whole
  // chain moves with it: observation → tracking → lifecycle/condition → the
  // frozen Step Contract → the row, the exports and the schedule.
  const pairs: [string, (x: Case) => unknown][] = [
    ['observation.reviewRequired', (x) => x.step.state.observation?.reviewRequired],
    ['condition', (x) => x.step.state.condition],
    ['lifecycle', (x) => x.step.state.lifecycle],
    ['heldForReview', (x) => heldForReview(x.step)],
    ['milestone.kind', (x) => nextMilestone(x.step).kind],
    ['rowWhen', (x) => rowWhen(x.step)],
    ['contract.whatToDo', (x) => stepContract(x.step, x.ctx).whatToDo.text],
    ['contract.fix', (x) => stepContract(x.step, x.ctx).fix.length],
    ['dates', (x) => x.view(x.step).dates],
    ['events', (x) => x.step.events !== null],
  ]
  for (const [what, read] of pairs) assert.notDeepEqual(read(c), read(control), `${what} did not move with the evidence`)
  // The control is the healthy end of the same path, so a change that collapsed
  // the two would fail here as well as above.
  assert.equal(heldForReview(control.step), false)
  assert.equal(control.view(control.step).dates?.includes('Held until'), false)
  assert.equal(control.step.events !== null, true, 'the healthy control does earn an enforcement')
  assert.equal(nextMilestone(control.step).kind, 'enforce')
})
