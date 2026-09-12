// A1a: every legacy hold (roadmap/holds.ts HoldKind) has an engine counterpart in
// the adapter's observation — one test per kind, each stating the legacy premise
// (holdOf) and the engine reading the same step gets. The legacy hold stays an
// input; the engine's lane is the judgment (RUN-CONTEXT-A decision 1).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import type { Step } from '../../roadmap/types.ts'
import { holdOf } from '../../roadmap/holds.ts'
import { unavailableReason } from '../../roadmap/operations.ts'
import { blockerStepId } from '../../roadmap/blockerSteps.ts'
import { observationDaysFor } from '../../roadmap/schedule.ts'
import { laneReadings, observe } from './planLanes.ts'
import type { LaneReading } from './planLanes.ts'

const run = runFixture(fixture('small'))

/** An open, writable policy step of the plan, cloned with nothing holding it, so a test can shape one hold. */
function cleanPolicy(): Step {
  const found = run.steps.find((x) => (x.kind === 'create' || x.kind === 'adjust') && x.status !== 'done' && x.status !== 'skipped'
    && (x.action.missing ?? []).length === 0 && unavailableReason(x) === null)
  assert.ok(found, 'the premise: small carries a writable open policy step')
  const s = structuredClone(found)
  s.blockers = []
  s.blockedBy = []
  s.state = { ...s.state, condition: 'healthy' }
  delete s.action.readinessGate
  delete s.action.escapeHatch
  assert.equal(holdOf(s), null, 'the premise: nothing holds the clean step')
  return s
}

/**
 * The step read by the engine over a plan where every other step is delivered, so
 * the reading depends on this step alone; `also` shapes the plan first.
 */
function readingOf(step: Step, also: (s: Step) => void = () => {}): LaneReading {
  const plan = run.steps.map((s) => (s.id === step.id ? step : structuredClone(s)))
  for (const s of plan) {
    if (s.id !== step.id) s.status = 'done'
    also(s)
  }
  const r = laneReadings(plan).get(step.id)
  assert.ok(r, `${step.id}: no reading`)
  assert.equal(r.fromEngine, true, `${step.id}: the graph knows the step`)
  return r
}

const label = (r: LaneReading): string => [r.lane, r.substatus, r.reason ? `${r.reason.kind}:${r.reason.id}` : null].filter(Boolean).join(' · ')

test('conflict → the sourceConflict blocker: On Hold', () => {
  const step = cleanPolicy()
  step.state = { ...step.state, condition: 'baseline-conflict', conflictSource: 'sourceConflict:test' }
  assert.equal(holdOf(step)?.kind, 'conflict')
  assert.ok(observe(step).blockers?.some((b) => b.kind === 'sourceConflict' && b.id === 'sourceConflict:test'))
  assert.equal(label(readingOf(step)), 'On Hold · sourceConflict:sourceConflict:test')
})

test('decision → the decision kind: Ready · Needs decision, never a hold', () => {
  const step = cleanPolicy()
  step.state = { ...step.state, condition: 'needs-decision' }
  assert.equal(holdOf(step)?.kind, 'decision')
  assert.equal(observe(step).kind, 'decision')
  assert.equal(label(readingOf(step)), 'Ready · Needs decision')
})

test('review → drift: Ready · Correct', () => {
  const step = cleanPolicy()
  step.state = { ...step.state, lifecycle: 'report-only', condition: 'review-required' }
  step.status = 'in-report-only'
  assert.equal(holdOf(step)?.kind, 'review')
  assert.equal(observe(step).drift, true)
  assert.equal(label(readingOf(step)), 'Ready · Correct')
})

test('unavailable → the unsupported blocker: On Hold', () => {
  const step = cleanPolicy()
  step.action = { ...step.action, unmatchedPair: true }
  assert.equal(holdOf(step)?.kind, 'unavailable')
  assert.ok(observe(step).blockers?.some((b) => b.kind === 'unsupported' && b.id === 'unmatched-pair'))
  assert.equal(label(readingOf(step)), 'On Hold · unsupported:unmatched-pair')
})

test('readiness → an evidence gate on enforce: a started policy reads Ready · Observing with the threshold as what it waits on; its report-only create is not gated', () => {
  const step = cleanPolicy()
  const binding = 'when MFA readiness reaches 90% (now 5%)'
  step.blockers = [{ kind: 'readiness', label: 'mfa-readiness', binding }]
  step.action = { ...step.action, readinessGate: { measure: 'MFA readiness', threshold: '90%', value: '5%' } }
  step.state = { ...step.state, lifecycle: 'report-only', condition: 'blocked' }
  step.status = 'in-report-only'
  assert.equal(holdOf(step)?.kind, 'readiness')
  const o = observe(step)
  assert.deepEqual(o.gates?.find((g) => g.id === 'evidence:readiness:mfa-readiness'), { id: 'evidence:readiness:mfa-readiness', satisfied: false, minDays: null, reason: binding })
  assert.deepEqual(o.blockers, [], 'a threshold is never a blocker')
  const started = readingOf(step)
  assert.equal(label(started), 'Ready · Observing')
  assert.equal(started.gates.find((g) => !g.satisfied)?.reason, binding, 'the threshold text is what the step waits on')
  assert.ok(started.gates.some((g) => g.id === 'evidence:observation' && g.minDays === observationDaysFor(step)), 'the window is the observation gate\'s time part')
  // The same threshold on a policy nobody has deployed gates nothing: the create lands in report-only.
  const unstarted = cleanPolicy()
  unstarted.blockers = step.blockers
  unstarted.action = step.action
  unstarted.state = { ...unstarted.state, lifecycle: 'not-deployed', condition: 'blocked' }
  assert.equal(holdOf(unstarted)?.kind, 'readiness')
  assert.equal(label(readingOf(unstarted)), 'Ready · Create')
})

test('prerequisite → a step edge: the emergency gate holds enforcement, a maker step gates the create, a Setup answer is a fact', () => {
  const step = cleanPolicy()
  const gate = blockerStepId('breakGlass')
  step.blockers = [{ kind: 'step', stepId: gate, label: 'after', held: true }]
  step.state = { ...step.state, condition: 'blocked' }
  assert.equal(holdOf(step)?.kind, 'prerequisite')
  const wake = (s: Step): void => { if (s.id === gate) s.status = 'ready' }
  const plan = run.steps.map((s) => (s.id === step.id ? step : structuredClone(s)))
  for (const s of plan) wake(s)
  const o = observe(step, new Map(plan.map((s) => [s.id, s])))
  assert.deepEqual(o.waitsOn, [{ step: gate, action: 'enforce', milestone: 'complete' }], 'the gate holds enforcement, never the report-only preparation (A3 B3)')
  assert.deepEqual(o.blockers, [])
  const r = readingOf(step, wake)
  assert.equal(label(r), 'Ready · Create', 'a wait on enforcement does not gate the create')
  // A maker step the plan carries gates the action that needs its object (§8.4): healthy queued work.
  const maker = cleanPolicy()
  // A graph step nothing gates this policy on, so the wait is the plan's own and not the graph's.
  const makerStep = 's-check-dormant-accounts'
  maker.blockers = [{ kind: 'step', stepId: makerStep, label: 'create-object' }]
  const wakeMaker = (s: Step): void => { if (s.id === makerStep) s.status = 'ready' }
  const withMaker = run.steps.map((s) => structuredClone(s))
  for (const s of withMaker) wakeMaker(s)
  assert.deepEqual(observe(maker, new Map(withMaker.map((s) => [s.id, s]))).waitsOn, [{ step: makerStep, action: 'create', milestone: 'complete' }])
  const queued = readingOf(maker, wakeMaker)
  assert.equal(queued.lane, 'Up Next', label(queued))
  assert.equal(queued.reason?.id, makerStep)
  // A Setup answer nobody has given is a tenant fact (§15).
  const setup = cleanPolicy()
  setup.blockers = [{ kind: 'setup', questionNumber: 3, label: 'setup' }]
  setup.state = { ...setup.state, condition: 'blocked' }
  assert.equal(holdOf(setup)?.kind, 'prerequisite')
  assert.deepEqual(observe(setup).blockers, [{ kind: 'fact', id: 'setup:3' }])
  assert.equal(label(readingOf(setup)), 'On Hold · fact:setup:3')
})

test('evidence → the observation gate: records that do not clear the window keep the policy Ready · Observing, with the records as what it waits on', () => {
  const step = cleanPolicy()
  step.state = { ...step.state, lifecycle: 'report-only' }
  step.status = 'in-report-only'
  step.tracking = {
    state: 'enabledForReportingButNotEnforced', readyOn: '2026-09-01T00:00:00.000Z', noticedAt: '2026-09-10T00:00:00.000Z', readyNow: false,
    daysInReportOnly: 9, failures: 2, seenInScope: 5, activeInScope: 5, windowRead: true, evidenceStrategy: 'records',
  } as unknown as Step['tracking']
  assert.equal(holdOf(step)?.kind, 'evidence')
  const gate = observe(step).gates?.find((g) => g.id === 'evidence:observation')
  assert.ok(gate && !gate.satisfied)
  assert.equal(gate.minDays, observationDaysFor(step))
  assert.equal(typeof gate.reason, 'string', 'the records are the reason')
  const r = readingOf(step)
  assert.equal(label(r), 'Ready · Observing')
  assert.deepEqual(r.gates.filter((g) => !g.satisfied).map((g) => g.id), ['evidence:observation'])
})
