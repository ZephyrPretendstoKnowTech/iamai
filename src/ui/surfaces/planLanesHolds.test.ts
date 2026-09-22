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
import { laneViewOf, prerequisiteLabelFor, readinessBlockersOf, waveStartOf } from './planBoard.ts'
import { stepBodyOf } from './stepBody.ts'
import { planDates } from './stepVars.ts'
import { setDisplayTimeZone } from '../../copy/dates.ts'
import { directionStepsAnswering } from '../../roadmap/direction.ts'
import { directionWords } from '../../content/content.ts'
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

test('decision → the decision kind: Ready · Decision, never a hold', () => {
  const step = cleanPolicy()
  step.state = { ...step.state, condition: 'needs-decision' }
  assert.equal(holdOf(step)?.kind, 'decision')
  assert.equal(observe(step).kind, 'decision')
  assert.equal(label(readingOf(step)), 'Ready · Decision')
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

test('readiness → an evidence gate on enforce: a started policy waits On Hold with the threshold as what it waits on; its report-only create is not gated', () => {
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
  assert.equal(label(started), 'On Hold · evidence:evidence:readiness:mfa-readiness')
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
  assert.deepEqual(o.waitsOn, [], 'the dependency catalogue already owns the enforcement edge; the observation must not duplicate it')
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

// ---------------------------------------------------------------------------
// One wait, said once (docs/plans/step-redundancy-analysis.md finding 3).
// ---------------------------------------------------------------------------

type Tile = { label: string; value: string }

/** The opened step's Readiness tiles on a fixture, by step id, with the plan that drew them. */
function tilesOf(name: 'demo'): { tiles: Map<string, Tile[]>; idOfTitle: Map<string, string> } {
  setDisplayTimeZone('UTC')
  try {
    const f = fixture(name)
    const r = runFixture(f, {}, null, f.snapshot.asOf)
    const readings = laneReadings(r.steps, [])
    const titleOf = (id: string): string | null => r.steps.find((x) => x.id === id)?.title ?? null
    const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot)
    const prerequisiteLabel = prerequisiteLabelFor(readings)
    const tiles = new Map<string, Tile[]>()
    for (const step of r.steps) {
      const reading = readings.get(step.id)
      if (!reading) continue
      const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: step.reportOnlyAt ?? null, scheduledOn: waveStartOf(step), groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming }
      const body = stepBodyOf(step, ctx, { lane: laneViewOf(reading, titleOf), blockers: readinessBlockersOf(reading, titleOf), prerequisiteLabel })
      tiles.set(step.id, [...body.readiness.tiles, ...body.readiness.satisfied].map((t) => ({ label: String(t.label), value: String(t.value) })))
    }
    return { tiles, idOfTitle: new Map(r.steps.map((x) => [x.title, x.id])) }
  } finally {
    setDisplayTimeZone(null)
  }
}

test('a step never states a Direction wait the prerequisite beside it already carries', () => {
  const { tiles, idOfTitle } = tilesOf('demo')
  // The card's heading is what is being waited on; its check is that thing's
  // state (owner, 2026-09-20; quality audit 2.4).
  const line = (t: Tile): string => `${t.label}: ${t.value}`

  // The registration step said the trusted network three times: the step that
  // makes it, a numeric gate repeating that step's name, and the answer behind
  // both. It says it once now, as the step a person can go and do.
  const registration = tiles.get('s-goal-register-info-protected')!
  assert.deepEqual(registration.filter((t) => /Trusted Network|Sign In From/.test(t.label)).map(line), ['Define the Trusted Network: Prerequisite \u00b7 To do'])

  // Six tiles of which four were two facts doubled; four now, each its own fact.
  assert.deepEqual(tiles.get('s-goal-service-accounts-trusted-network')!.map(line), [
    'Affected people: Not established',
    'Define the Trusted Network: Prerequisite \u00b7 To do',
    'Create or Correct Service Accounts Group: Prerequisite \u00b7 To do',
    'Prepare Emergency Access Accounts: Prerequisite \u00b7 To do',
  ])

  // The rule behind both, over every step of the fixture: where a prerequisite
  // tile names a step whose question moved to Direction, no tile beside it
  // states that Direction step as well.
  for (const [id, list] of tiles) {
    const relayed = new Set(list.flatMap((t) => (t.value.startsWith('Prerequisite') ? [...directionStepsAnswering(idOfTitle.get(t.label) ?? '')] : [])))
    for (const t of list.filter((x) => x.label === directionWords.waiting)) {
      assert.equal(relayed.has(idOfTitle.get(t.value) ?? ''), false, `${id} states "${t.value}" beside the prerequisite that already carries it`)
    }
  }
})

test('every held or queued row names what it is waiting for, and never just repeats its badge', () => {
  // The collapsed row's badge is one word by design: `laneLabelOf` appends the
  // lane tail only on Ready, and `compactLane` in StepSections.tsx strips
  // `On Hold · After ` from the badge if one gets through. So before this, a
  // held row said "On Hold" and named nothing — fifteen rows of one plan
  // waiting on an unanswered Direction question and eleven on one named step,
  // all reading the same two words. An administrator who reads that, goes to
  // the portal and deploys anyway has been told he cannot and not told what to
  // do first. `waitingForOf` is the row's line, and it is `holdLabelOf`.
  const boards = (['small', 'mid', 'midflight', 'large'] as const).map((name) => {
    const run = runFixture(fixture(name))
    const titleOf = (id: string): string | null => run.steps.find((s) => s.id === id)?.title ?? null
    return { name, held: [...laneReadings(run.steps)].filter(([, r]) => r.lane === 'On Hold' || r.lane === 'Up Next').map(([id, r]) => ({ id, view: laneViewOf(r, titleOf) })) }
  })

  // The invariant, over every fixture: the badge is not the whole row. A held
  // row that names nothing is the defect, whatever kind of thing holds it.
  for (const { name, held } of boards) {
    assert.ok(held.length > 0, `${name}: the premise — the fixture holds something`)
    for (const { id, view } of held) {
      assert.ok(view.label === 'On Hold' || view.label === 'Up Next', `${name}/${id}: the badge stopped being the bare lane, so this test is reading the wrong thing`)
      assert.ok(view.waitingFor, `${name}/${id}: a held row that names nothing`)
      assert.notEqual(view.waitingFor, view.label, `${name}/${id}: the row's reason repeats its badge`)
    }
  }

  // The three shapes a hold takes, said the three ways a person can act on.
  const named = new Map(boards.find((b) => b.name === 'mid')!.held.map(({ id, view }) => [id, view.waitingFor]))
  // A healthy prerequisite names the step to go and do, by its title.
  assert.equal(named.get('s-ladder-operator-passkey'), 'After Configure Passkey Authentication')
  // A Direction question nobody has answered names the answer, not the step asking it.
  assert.equal(named.get('s-goal-geo-restriction'), directionWords.waiting)
  // A hold that is a fact about the tenant names the fact.
  assert.equal(named.get('s-goal-service-accounts-trusted-network'), 'Baseline references an unmapped group')
  assert.equal(named.get('s-goal-guests-mfa'), 'Not supported')
})

// A row that is finished and still short of an answer.
//
// `s-goal-block-legacy-auth` reads status `done`, lifecycle `enforced` and
// planState "In place", and the lane engine keeps it in Ready - Decision
// because a conditional input has no saved answer (lanes.ts isComplete, U28).
// Three readings of one step on one screen, and the answer that was actually
// missing named in none of them.
test('a finished row short of an answer names the answer', () => {
  const run = runFixture(fixture('mid'))
  const step = run.steps.find((s) => s.id === 's-goal-block-legacy-auth')
  assert.ok(step, 'the premise: mid plans the legacy-auth step')
  assert.equal(step.status, 'done', 'the premise: the step is finished')
  assert.deepEqual(step.unsavedInputs, ['Mail-sending devices'], 'the premise: one input has no saved answer')

  const titleOf = (id: string): string | null => run.steps.find((s) => s.id === id)?.title ?? null
  const view = laneViewOf(laneReadings(run.steps).get(step.id)!, titleOf)
  assert.equal(view.label, 'Ready · Decision', 'the premise: the engine keeps it out of Completed')
  assert.equal(view.waitingFor, 'Waiting on your answer: Mail-sending devices')

  // And never in place of a real hold: a row something holds says what holds
  // it, whatever else it is short of.
  const guests = run.steps.find((s) => s.id === 's-goal-guests-mfa')!
  assert.ok((guests.unsavedInputs ?? []).length > 0, 'the premise: this row is short of an answer too')
  assert.equal(laneViewOf(laneReadings(run.steps).get(guests.id)!, titleOf).waitingFor, 'Not supported')
})
