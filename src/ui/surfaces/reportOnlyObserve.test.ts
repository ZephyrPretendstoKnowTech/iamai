// The canonical Plan case: Report-only / Observe (task 005).
//
// One real step on one real fixture — demo-week2 / s-goal-block-auth-transfer,
// "Block Authentication Transfer" — because it is the whole case at once: the
// plan deployed the policy two days ago and a scan found it in report-only
// (Foundation B), nothing is wrong with it (no blocker, no decision, no
// baseline conflict, no review condition), the policy already delivers the goal
// so there is no correction to make, and the window it has to be watched for has
// not closed. The only thing the step has left to submit is the enforcement, and
// nothing has earned that yet.
//
// Nothing here builds a Step. The fixture runs through the whole engine and the
// assertions read what a person would see: the frozen Step Contract, the row's
// date column, the four implementation channels, the export view the calendar
// entry, the prompt pack and the grounding bundle all speak from, and the
// calendar itself.
//
// What it exists to catch: the plan handing over {"state":"enabled"} while its
// own What to do says to wait; an enforcement date, wave or calendar entry
// standing in for a review milestone; observed days derived from the schedule
// or the clock instead of from the records; a step advancing to ready with a
// gate still open; and evidence nobody collected reported as zero failures or
// everybody seen.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures, fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { enforcesOnRun, implementationOffered, operationsOf, unavailableReason } from '../../roadmap/operations.ts'
import { enforcementTiming, enforcementUnearned } from '../../roadmap/forecast.ts'
import { artifactIdOf } from '../../roadmap/observation.ts'
import { nextMilestone } from '../../roadmap/lifecycle.ts'
import { readyWhen } from '../../derive/readyWhen.ts'
import { reached } from '../../derive/population.ts'
import { buildIcs } from '../../roadmap/ics.ts'
import { groundingBundle, stepContext } from '../../roadmap/prompts.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import type { Step } from '../../roadmap/types.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { stepContract } from './stepContract.ts'
import { stepExportView } from './stepExport.ts'
import { jsonOffered, policyJsonText, stepOperations } from './stepJson.ts'
import { powershellFor } from './stepPowerShell.ts'
import { stepPortalLines, portalNamesFor } from './stepPortal.ts'
import { rowWhen } from './rowWhen.ts'
import { statusOf } from './statusWord.ts'
import { stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'

/** The one canonical case, named here so a change to it is a change to this test. */
const FIXTURE = 'demo-week2'
const STEP_ID = 's-goal-block-auth-transfer'
/** The other week-two policy in report-only: its records are not this step's. */
const OTHER_ID = 's-goal-token-protection'

/** Words that would tell the operator to do something other than keep watching. */
const DOING = /\b(create|creating|change|changing|update|updating|enforce|enforcing|enable|submit|resolve|delete|remove)\b/i

type Case = {
  step: Step
  ctx: StepVarContext
  steps: Step[]
  snapshot: TenantSnapshot
  view: (s: Step) => ReturnType<typeof stepExportView>
  run: ReturnType<typeof runFixture>
}

/**
 * The canonical case, or the same fixture with one focused evidence change: the
 * records this policy was judged on removed, so the observation is unknown
 * rather than clean. Everything else about the tenant is untouched.
 */
function canonical(over: { noRecords?: boolean } = {}): Case {
  const f = fixture(FIXTURE)
  const snapshot = over.noRecords
    ? ({
        ...f.snapshot,
        evidencePolicyResults: (f.snapshot.evidencePolicyResults ?? []).filter((p) => !/Authentication transfer/i.test(String(p.displayName))),
      } as TenantSnapshot)
    : f.snapshot
  const r = over.noRecords ? runFixture({ ...f, snapshot }, { snapshot }) : runFixture(f)
  const step = r.steps.find((s) => s.id === STEP_ID)
  assert.ok(step, `${FIXTURE} no longer carries ${STEP_ID}`)
  const ctx: StepVarContext = {
    snapshot,
    mapping: f.mapping,
    nameOf: (id: string) => r.input.names!.label(id),
    signature: 'IT',
    operatorId: f.operatorId,
    now: snapshot.asOf,
    groups: f.groups,
    reportOnlyAt: r.schedule.reportOnlyAt[step.id] ?? null,
  }
  return { step, ctx, steps: r.steps, snapshot, view: (s: Step) => stepExportView(s, ctx), run: r }
}

/** The step's portal lines, as the screen and the exports both render them. */
function portalOf(step: Step, ctx: StepVarContext): string[] | null {
  const cs = contentStepFor(step) as Record<string, unknown> | undefined
  const ex = stepVars(step, ctx)
  return stepPortalLines(step, portalNamesFor(ctx, ex, String(cs?.title ?? step.title)))
}

// ---- 1. the case is real, and it is genuinely Report-only and Healthy ----

test('005.1: the canonical case is a deployed Conditional Access policy in Report-only, in good health', () => {
  const { step } = canonical()
  assert.equal(contentStepFor(step)?.kind, 'policy')
  // Foundation B, and only Foundation B, says where the policy is and how it is
  // doing. The two axes move independently and both are read here.
  assert.equal(step.state.lifecycle, 'report-only')
  assert.equal(step.state.condition, 'healthy', 'the canonical Observe case has no blocker, decision, conflict or review condition')
  assert.equal(step.state.satisfied, false)
  assert.equal(step.state.inPlace, false)
  assert.equal(step.state.setAside, false)
  assert.equal(step.status, 'in-report-only')
  assert.notEqual(step.state.lifecycle, 'ready-to-enforce', 'it has not earned enforcement')
  // Nothing holds it and nothing is wrong with it: no blocker to fix, no
  // unavailable reason, no review the observation raised.
  assert.deepEqual(step.blockers, [])
  assert.equal(unavailableReason(step), null)
  assert.equal(step.state.observation?.reviewRequired, false)
  assert.deepEqual(
    (step.tracking?.members ?? []).map((m) => m.reviewRequired),
    [false],
    'and no member of it wants a person to look',
  )
  // The row says the state without being opened, and its date column is the
  // review milestone rather than a rollout day.
  assert.equal(statusOf(step).word, 'Report-only')
  assert.equal(rowWhen(step), `ready ${absoluteDate(readyWhen(step)!.date)}`)
})

// ---- 2. the observation belongs to this deployed policy, and to no other ----

test('005.2: the observation is this step’s own deployed policy, and another policy’s records cannot stand for it', () => {
  const { step, steps } = canonical()
  assert.equal(step.state.members.length, 1, 'the canonical case is a single-policy goal')
  const m = step.state.members[0]
  const t = step.tracking!
  assert.ok(t.policyId, 'a deployed policy was matched')
  assert.equal(m.change.latest.artifact, artifactIdOf(t.policyId), 'the observation names the object the tracking matched')
  assert.equal(m.change.latest.state, 'report-only')
  assert.equal(t.state, 'enabledForReportingButNotEnforced')
  // The other week-two policy is a different object with different records, and
  // its numbers are nowhere in this step's.
  const other = steps.find((s) => s.id === OTHER_ID)!
  assert.notEqual(other.tracking?.policyId ?? null, t.policyId)
  assert.notEqual(other.tracking?.seenInScope, t.seenInScope, 'the two policies were seen for different people')
  assert.equal(t.members.length, 1)
  assert.equal(t.members[0].policyId, t.policyId, 'the member holds its own object, not the step’s idea of one')
})

// ---- 3. the clock is the records', not the calendar's ----

test('005.3: the observed days and the review date come from the evidence, not from the schedule or the clock', () => {
  const { step, ctx } = canonical()
  const t = step.tracking!
  const ready = readyWhen(step)!
  assert.equal(t.reportOnlyAtSource, 'sign-in-evidence', 'the day it entered report-only is a record, not a guess')
  assert.ok(t.daysInReportOnly > 0, 'days have been earned')
  assert.equal(ready.days, t.daysInReportOnly, 'one reading of the clock')
  assert.equal(ready.date, t.readyOn)
  const ex = stepVars(step, ctx) as Record<string, unknown>
  assert.equal(ex.readyOn, absoluteDate(t.readyOn!))
  assert.match(String(ex.evidenceGate), new RegExp(`${t.seenInScope} of ${t.activeInScope} active people seen in ${t.daysInReportOnly} days`))

  // Moving the rollout the schedule projected, and moving the surface's idea of
  // now, add no observed history: the numbers come from what a scan saw.
  const moved = structuredClone(step) as Step
  moved.rings = moved.rings.map((r) => ({ ...r, plannedStart: '2027-01-01T00:00:00.000Z', plannedEnd: '2027-01-08T00:00:00.000Z' }))
  if (moved.events) moved.events = { ...moved.events, enforce: { ...moved.events.enforce, at: '2027-01-01T00:00:00.000Z' } }
  const later = stepVars(moved, { ...ctx, now: '2027-06-01T00:00:00.000Z' }) as Record<string, unknown>
  assert.equal(later.evidenceGate, ex.evidenceGate, 'a later clock is not more observation')
  assert.equal(later.timeGate, ex.timeGate, 'and a later rollout is not a later review')
  assert.equal(later.readyOn, absoluteDate(t.readyOn!))
  assert.equal(readyWhen(moved)!.days, ready.days)
  assert.equal(moved.state.lifecycle, 'report-only', 'and none of it advances the lifecycle')

  // The evidence is what moves it: with this policy's records gone the same
  // fixture earns no days at all.
  const bare = canonical({ noRecords: true })
  assert.ok(bare.step.tracking!.daysInReportOnly < t.daysInReportOnly, 'no records, no earned window')
})

// ---- 4. the healthy claim is proven, not assumed ----

test('005.4: “no unresolved failures” is a count the records support, not the absence of records', () => {
  const { step } = canonical()
  const t = step.tracking!
  assert.equal(t.evidenceQuality, 'enough', 'enough records to judge on')
  assert.ok(t.signIns > 0, `records exist (${t.signIns})`)
  assert.equal(t.failures, 0)
  assert.deepEqual(t.failuresByUser, [])
  assert.ok(t.seenInScope !== null && t.activeInScope !== null, 'the policy’s own scope was settled, so the count is a count')
  assert.ok(t.seenInScope! > 0, 'people were actually seen under it')
})

// ---- 5. it is not ready, and a real gate says why ----

test('005.5: at least one observation gate is still open, so the step stays Report-only', () => {
  const { step, ctx } = canonical()
  const ready = readyWhen(step)!
  assert.equal(step.tracking!.readyNow, false, 'the evidence gate has not opened')
  assert.equal(ready.kind, 'on', 'and the time gate closes in the future')
  assert.ok(ready.seen! < ready.people!, `people in scope are still unseen (${ready.seen} of ${ready.people})`)
  assert.equal(step.state.lifecycle, 'report-only')
  assert.notEqual(step.status, 'ready-to-enforce')
  // Done when states the gates, so the operator can read what would clear it.
  const done = stepContract(step, ctx).doneWhen.join(' | ')
  assert.match(done, /in report-only since/i)
  assert.match(done, new RegExp(`${ready.seen} of ${ready.people}`))
})

// ---- 6. the next action is to keep watching ----

test('005.6: What to do is keep it in report-only, on the screen and in every artifact', () => {
  const { step, ctx, view } = canonical()
  const c = stepContract(step, ctx)
  const m = nextMilestone(step)
  assert.equal(m.kind, 'observe')
  assert.equal(c.milestone.kind, 'observe')
  assert.equal(c.whatToDo.kind, 'observe')
  assert.match(c.whatToDo.text, /report-only/i)
  assert.match(c.whatToDo.text, new RegExp(absoluteDate(readyWhen(step)!.date)))
  assert.doesNotMatch(c.whatToDo.text, DOING)
  // Nothing is presented as a blocker, because nothing is one.
  assert.deepEqual(c.fix, [])
  // The export, the calendar entry, the prompt pack and the grounding bundle all
  // speak from this view: its first line is the contract's own action, and it
  // carries no instructions for making a change.
  const v = view(step)
  assert.equal(v.whatToDo[0], c.whatToDo.text)
  assert.equal(v.whatToDo.length, 1, `no instructions beside it: ${JSON.stringify(v.whatToDo)}`)
})

// ---- 7. no implementation is handed over while the window is open ----

test('005.7: the four channels stand down — no portal change, no JSON, no PowerShell, no download', () => {
  const { step, ctx } = canonical()
  // Foundation A is unchanged and the frozen contract still reports its answer:
  // this is a policy the plan will write. Whether today is the day is Foundation
  // B's, and it says the enforcement has not been earned.
  assert.equal(implementationOffered(step), true, 'Foundation A offers the implementation')
  assert.equal(stepContract(step, ctx).implementation.offered, true, 'and the frozen contract reports it unchanged')
  const ops = operationsOf(step)
  assert.equal(ops.length, 1)
  assert.equal(ops[0].mode, 'update', 'the policy exists, so there is nothing to create')
  assert.equal(enforcesOnRun(ops[0]), true, 'and the one thing left to submit turns it on')
  assert.equal(enforcementUnearned(step), true)
  // So no channel offers it.
  assert.equal(jsonOffered(step), false)
  assert.deepEqual(stepOperations(step), [])
  assert.equal(portalOf(step, ctx), null, 'no portal instructions')
  assert.doesNotMatch(policyJsonText(step), /"state"\s*:\s*"enabled"/, 'nothing downloadable enforces the policy')
  const ps = powershellFor(stepOperations(step))
  assert.doesNotMatch(ps, /Update-MgIdentityConditionalAccessPolicy/)
  assert.doesNotMatch(ps, /New-MgIdentityConditionalAccessPolicy/, 'and no second policy either')
})

// ---- 8. no enforcement date, wave or calendar entry ----

test('005.8: the dates are the ones the policy has earned, and the calendar books the review, not the enforcement', () => {
  const { step, steps, view } = canonical()
  const timing = enforcementTiming(step)
  assert.equal(timing.basis, 'forecast', 'the schedule’s enforcement instant is a projection')
  const ready = readyWhen(step)!
  const v = view(step)
  assert.ok(v.dates, 'the step is dated')
  assert.match(v.dates!, /^Report-only since /)
  assert.match(v.dates!, new RegExp(`Review ${absoluteDate(ready.date)}`))
  assert.ok(!v.dates!.includes(absoluteDate(timing.at!)), `no enforcement date on the line: ${v.dates}`)
  assert.doesNotMatch(v.dates!, /^Announce /, 'and it is not the change-step line')
  // One calendar entry, on the review day, lasting the day — not the ring window
  // the schedule projected for an enforcement.
  const ics = buildIcs(steps, 'Tenant', 'plan-1', view)
  const entry = ics.split('BEGIN:VEVENT').find((b) => b.includes(`UID:plan-1-${step.id}@iamai`))
  assert.ok(entry, 'the step is in the calendar')
  assert.match(entry!, new RegExp(`DTSTART;VALUE=DATE:${ready.date.slice(0, 10).replace(/-/g, '')}`))
  assert.doesNotMatch(entry!, /Enable policy/i, 'and it is not a runbook for turning the policy on')
  assert.ok(!entry!.includes(absoluteDate(timing.at!)), 'nor does it name the enforcement day')
})

// ---- 9. the screen and the artifacts say one thing ----

test('005.9: screen, export, calendar, prompt pack and grounding bundle agree', () => {
  const { step, ctx, steps, snapshot, view, run } = canonical()
  const c = stepContract(step, ctx)
  const v = view(step)
  assert.equal(c.state.stage, 'Report-only')
  assert.equal(c.state.conditionLabel, 'Healthy')
  assert.notEqual(c.state.stage, c.state.conditionLabel, 'the two axes are said apart')
  // The prompt pack states the day as a target, never as a milestone something earned.
  const facts = stepContext(step, view)
  assert.match(facts, /Takes effect: .* at the earliest/, `the day is qualified: ${facts}`)
  assert.ok(facts.includes(c.whatToDo.text), 'and the action is the screen’s')
  // The grounding bundle carries the same lines and the same classification.
  const bundle = groundingBundle({ view, tenant: 'Tenant', snapshot, coverage: run.coverage, steps, schedule: run.schedule, redacted: false, generated: 'Sep 6, 2026', cleanup: [] }) as unknown as { plan: { steps: Record<string, unknown>[] } }
  const b = bundle.plan.steps.find((x) => x.id === step.id)!
  assert.equal(b.status, 'in-report-only')
  assert.deepEqual(b.enforcement, { basis: 'forecast', at: enforcementTiming(step).at })
  assert.deepEqual(b.whatToDo, v.whatToDo)
  assert.equal(b.dates, v.dates)
  assert.ok(!JSON.stringify(b).includes('"state": "enabled"'), 'no artifact carries the enforcing body')
  // Who this touches is Foundation A's reach, and it is a different fact from
  // how many of them the records have seen.
  const pop = reached(step)
  assert.ok(pop, 'the scope was settled')
  assert.equal(c.who?.known, true)
  assert.equal(step.tracking!.activeInScope, pop!.active, 'the policy’s scope is the step’s reach')
  assert.notEqual(step.tracking!.seenInScope, step.tracking!.activeInScope, 'observed is not the same number as in scope')
})

// ---- 10. unknown evidence is not clean evidence ----

test('005.10: with the records gone the step claims no clean window, no full observation and no readiness', () => {
  const { step, ctx, view } = canonical({ noRecords: true })
  const t = step.tracking!
  assert.equal(step.state.lifecycle, 'report-only', 'still report-only, and no further')
  assert.notEqual(t.evidenceQuality, 'enough', `the evidence is not enough to judge on (${t.evidenceQuality})`)
  assert.equal(t.signIns, 0, 'nothing was read')
  assert.equal(t.readyNow, false, 'so the evidence gate cannot open')
  assert.equal(readyWhen(step)!.kind, 'on', 'and the time gate is the only way through')
  assert.equal(t.seenInScope, 0, 'nobody was seen — not everybody')
  assert.ok(t.activeInScope! > 0, 'against a scope that is known')
  assert.equal(t.daysInReportOnly, 0, 'and no days are claimed for a window nothing watched')
  // The lines a person reads never turn that into a clean window.
  const done = stepContract(step, ctx).doneWhen.join(' | ')
  assert.match(done, new RegExp(`0 of ${t.activeInScope} active people`), `the zero is stated as a zero: ${done}`)
  assert.doesNotMatch(view(step).whatToDo.join(' | '), /Enable policy/i, 'and the enforcement is still withheld')
  assert.equal(jsonOffered(step), false)
})

// ---- 11. the whole path, on every fixture ----

test('005.11: no fixture hands over an enforcement while its policy is still in report-only', () => {
  let seen = 0
  for (const f of allFixtures()) {
    const r = runFixture(f)
    for (const step of r.steps) {
      if (step.state.lifecycle !== 'report-only') continue
      const ctx: StepVarContext = {
        snapshot: f.snapshot,
        mapping: f.mapping,
        nameOf: (id: string) => r.input.names!.label(id),
        signature: 'IT',
        operatorId: f.operatorId,
        now: f.snapshot.asOf,
        groups: f.groups,
        reportOnlyAt: r.schedule.reportOnlyAt[step.id] ?? null,
      }
      const where = `${f.name}/${step.id}`
      // Foundation B has not granted the enforcement, so nothing a person could
      // run submits it — in any channel, on any surface.
      for (const op of stepOperations(step)) assert.equal(enforcesOnRun(op), false, `${where}: a channel offers an operation that enforces the moment it is run`)
      assert.doesNotMatch(policyJsonText(step), /"state"\s*:\s*"enabled"/, `${where}: the JSON enforces it`)
      assert.doesNotMatch(powershellFor(stepOperations(step)), /"state": "enabled"/, `${where}: the PowerShell enforces it`)
      if (!enforcementUnearned(step)) continue
      seen += 1
      assert.equal(jsonOffered(step), false, `${where}: the JSON, PowerShell and download tabs are open`)
      assert.equal(portalOf(step, ctx), null, `${where}: the portal lines tell the operator to change it`)
      const v = stepExportView(step, ctx)
      assert.doesNotMatch(v.whatToDo.join(' | '), /Enable policy/i, `${where}: the export tells the operator to enforce it`)
      assert.equal(nextMilestone(step).kind, 'observe', `${where}: the next milestone is not observation`)
      if (v.dates) assert.doesNotMatch(v.dates, /^Announce /, `${where}: the Dates line promises a change`)
    }
  }
  assert.ok(seen >= 1, `the case is exercised on a real fixture (${seen})`)
})

// ---- 12. and the fixture is the one the case is named for ----

test('005.12: the canonical case is the demo tenant’s own week-two policy, deployed by the plan it belongs to', () => {
  const { step, snapshot } = canonical()
  const t = step.tracking!
  const row = (snapshot.config.caPolicies?.rows ?? []).find((p) => String((p as { id?: unknown }).id) === t.policyId) as Record<string, unknown> | undefined
  assert.ok(row, 'the policy is in the tenant the scan read')
  assert.match(String(row!.description ?? ''), /\[IAMAI:plan-demo-week2:s-goal-block-auth-transfer/, 'and it carries this plan’s tag for this step')
  assert.equal(row!.state, 'enabledForReportingButNotEnforced')
  assert.equal(t.matchedBy, 'tag')
})
