// The active baseline everywhere (v2.0 prep, Phase A item 4): a step's lines,
// the partner question and the author credit read the curated baseline the plan
// uses, never Jon's by default. Jon's plan reads exactly as before.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { DEFAULT_BASELINE, curatedOf } from './registry.ts'
import { pinnedPackage } from './pinned.ts'
import { PINNED_GOAL_MAP, policiesForGoal } from '../roadmap/goalMap.ts'
import { pairBaselineNames, strengthForGoal } from '../ui/surfaces/stepPortal.ts'

test('the pinned package names its curated baseline; an upload names none and reads the default', () => {
  assert.equal(pinnedPackage().curatedId, 'jhope188')
  assert.equal(curatedOf(pinnedPackage()), DEFAULT_BASELINE)
  assert.equal(curatedOf({}), DEFAULT_BASELINE, 'an upload: the default answers, as it always has')
  assert.equal(curatedOf({ curatedId: 'not-shipped' }), DEFAULT_BASELINE)
})

test("each goal step carries its baseline's own policies for the goal, Jon's on Jon's plan", () => {
  const r = runFixture(fixture('demo'))
  const goalSteps = r.steps.filter((s) => s.goalId && s.id.startsWith('s-goal-'))
  assert.ok(goalSteps.length > 10)
  for (const s of goalSteps) {
    const expected = policiesForGoal(PINNED_GOAL_MAP, DEFAULT_BASELINE.pinned.policies as never, s.goalId).map((p) => (p as { displayName: string }).displayName)
    assert.deepEqual((s.baselinePolicies ?? []).map((p) => p.displayName), expected, s.id)
  }
  // The lines read from the step: the same answer as the default lookup on Jon's plan.
  const guests = goalSteps.find((s) => s.goalId === 'guests-mfa')!
  assert.equal(strengthForGoal('guests-mfa', guests.baselinePolicies), strengthForGoal('guests-mfa'))
  assert.deepEqual(pairBaselineNames('guests-mfa', guests.baselinePolicies), pairBaselineNames('guests-mfa'))
})

test("a step whose baseline is another reads that baseline's policies, not Jon's", () => {
  const other = [
    { displayName: 'CA100-Guests-Grant-MFA', grantControls: { authenticationStrength: { displayName: 'Another strength' } } },
    { displayName: 'CA101-Guests-Grant-MFA-B', grantControls: {} },
  ]
  assert.equal(strengthForGoal('guests-mfa', other), 'Another strength')
  assert.deepEqual(pairBaselineNames('guests-mfa', other), ['CA100-Guests-Grant-MFA', 'CA101-Guests-Grant-MFA-B'])
  assert.notEqual(strengthForGoal('guests-mfa', other), strengthForGoal('guests-mfa'))
})
