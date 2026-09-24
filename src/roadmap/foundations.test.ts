// The foundation gate (roadmap/foundations.ts; owner, 2026-09-19): no policy
// step reads Ready until Emergency Access and Direction are settled — Establish Emergency
// Access complete, and every Define Your Rollout Scope answer approved.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { runFixture, withDirectionApproved } from './fixtures/run.ts'
import { FOUNDATION_STEP_IDS, foundationsSettled, gateOnFoundations, isFoundationStep, unsettledFoundations } from './foundations.ts'
import { DIRECTION_BLOCKER } from './directionAnswers.ts'
import { FOUNDATION_WAIT, holdOf } from './holds.ts'
import { DIRECTION_GROUP, EMERGENCY_ACCESS_GROUP, membersOf } from './stepGroups.ts'
import { scheduleOf } from './stepSchedule.ts'
import { laneReadings } from '../ui/surfaces/planLanes.ts'
import type { Step } from './types.ts'

const POLICY: readonly Step['kind'][] = ['create', 'adjust', 'enforce']
const open = (s: Step): boolean => s.status !== 'done' && s.status !== 'skipped' && s.doesntApply == null
const policySteps = (steps: readonly Step[]): Step[] => steps.filter((s) => POLICY.includes(s.kind) && open(s))

test('the foundation is Emergency Access and Direction, Emergency Access first, and the gate leaves it and everything that is not a policy step alone', () => {
  // the foundation is Emergency Access and Direction, Emergency Access first
  {
    assert.deepEqual(FOUNDATION_STEP_IDS, [...membersOf(EMERGENCY_ACCESS_GROUP), ...membersOf(DIRECTION_GROUP)])
    for (const id of FOUNDATION_STEP_IDS) assert.equal(isFoundationStep(id), true, id)
    assert.equal(isFoundationStep('s-goal-admin-session'), false)
  }

  // the gate leaves the foundation itself, and everything that is not a policy step, alone
  {
    const r = runFixture(fixture('demo'))
    for (const step of r.steps) {
      if (POLICY.includes(step.kind) && !isFoundationStep(step.id)) continue
      assert.ok(!step.blockers.some((b) => b.label === FOUNDATION_WAIT), `${step.id} was gated`)
    }
    // Running it again adds nothing: the wait a step already carries is the one wait it has.
    const before = r.steps.map((s) => s.blockers.length)
    gateOnFoundations(r.steps)
    assert.deepEqual(r.steps.map((s) => s.blockers.length), before)
  }
})

test('demo first visit: neither group is settled, no policy step is Ready, and every gated policy step is held, undated, and names what it waits on', () => {
  // demo first visit: neither group is settled, and no policy step is Ready
  {
    const r = runFixture(fixture('demo'))
    assert.equal(foundationsSettled(r.steps), false)
    assert.deepEqual(
      unsettledFoundations(r.steps).map((s) => s.id),
      ['s-prereq-break-glass', 's-prereq-exclusion-group', 's-prereq-passkey-settings', 's-direction-use', 's-direction-accounts', 's-direction-devices'],
    )
    const readings = laneReadings(r.steps, [], r.input.mapping)
    const policy = policySteps(r.steps)
    assert.ok(policy.length > 10, 'the demo carries policy steps to gate')
    for (const step of policy) {
      const reading = readings.get(step.id)
      // A review is not a write (owner: review rows keep today's behaviour): an
      // unmatched pair asks a person to look, and there is nothing to deploy.
      if (reading?.substatus === 'Review') continue
      assert.notEqual(reading?.lane, 'Ready', `${step.id} reads Ready with the foundation unsettled`)
      assert.ok(reading?.lane === 'On Hold' || reading?.lane === 'Up Next', `${step.id} reads ${reading?.lane}`)
    }
    assert.equal(policy.filter((s) => readings.get(s.id)?.substatus === 'Create').length, 0, 'a policy offers its create with the foundation unsettled')
  }

  // demo first visit: a gated policy step is held, undated, and names what it waits on
  {
    const r = runFixture(fixture('demo'))
    const gate = unsettledFoundations(r.steps)[0]
    assert.equal(gate.id, 's-prereq-break-glass')
    for (const step of policySteps(r.steps)) {
      // A baseline that defines the policy two ways is its own hold, and a pair
      // IAMAI cannot match is a review: nothing about the foundation clears either,
      // so the gate leaves them alone.
      if (step.state.condition === 'baseline-conflict' || step.action.unmatchedPair) continue
      const wait = step.blockers.find((b) => b.kind === 'step' && b.label === FOUNDATION_WAIT)
      assert.ok(wait, `${step.id} carries no wait on the foundation`)
      assert.equal(wait.kind === 'step' && wait.stepId, gate.id)
      assert.equal(wait.binding, `after: ${gate.title}`)
      assert.notEqual(holdOf(step), null, `${step.id} is not held`)
      assert.equal(step.scheduled ? scheduleOf(step).at : null, null, `${step.id} carries a date while held`)
    }
  }
})

test('Emergency Access settled and Direction still open: the wait moves to the Direction step, and no policy is Ready', () => {
  const r = runFixture(fixture('demo-week2'))
  assert.deepEqual(unsettledFoundations(r.steps).map((s) => s.id), [...membersOf(DIRECTION_GROUP)])
  const readings = laneReadings(r.steps, [], r.input.mapping)
  for (const step of policySteps(r.steps)) {
    // A policy the tenant already enforces asks its Direction question where it
    // is (owner decision 3): the gate leaves it alone, as gateOnDirection does.
    if (readings.get(step.id)?.substatus === 'Review' || step.state.lifecycle === 'enforced') continue
    assert.notEqual(readings.get(step.id)?.lane, 'Ready', `${step.id} reads Ready with Direction unapproved`)
    if (step.state.condition === 'baseline-conflict') continue
    assert.ok(step.blockers.some((b) => b.kind === 'decision' && b.label === `${DIRECTION_BLOCKER}s-direction-use`), `${step.id} carries no wait on the Direction step`)
    assert.notEqual(holdOf(step), null, `${step.id} is not held`)
  }
})

test('both groups settled: policy steps become Ready, with dates', () => {
  const r = runFixture(withDirectionApproved(fixture('demo-week2')))
  assert.equal(foundationsSettled(r.steps), true)
  assert.deepEqual(unsettledFoundations(r.steps), [])
  const readings = laneReadings(r.steps, [], r.input.mapping)
  const ready = policySteps(r.steps).filter((s) => readings.get(s.id)?.lane === 'Ready')
  assert.ok(ready.length >= 5, `only ${ready.length} policy steps are Ready once the foundation is settled`)
  const created = ready.filter((s) => readings.get(s.id)?.substatus === 'Create')
  assert.ok(created.length > 0, 'no policy step offers its create')
  for (const step of created) assert.notEqual(step.scheduled ? scheduleOf(step).at : null, null, `${step.id} is Ready with no date`)
  // Nothing is left waiting on the foundation once it is settled.
  for (const step of r.steps) assert.ok(!step.blockers.some((b) => b.label === FOUNDATION_WAIT), `${step.id} still waits on the foundation`)
})
