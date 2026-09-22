// A policy this plan tagged that the tenant switched off (Jordan D6).
//
// The step's own words said "Core - Block - Device code flow is already in the
// tenant and switched off. Turning it back on is the change here, not a new
// policy". Around them: the board read "Ready · Create", AI Info said "IAMAI did
// not find Block Device Code Sign-in… The next action is to create it in
// Report-only" and stated the create's settings as the intended result, and a
// finding said "or follow the instructions below and leave it switched off" over
// no instructions. Following any of them makes a second policy. And "set Enable
// policy to On" was said whatever the plan's own prerequisites of enforcement
// were — turning it back on enforces it the moment it is saved.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture, withFoundationSettled, withRecoveryTested } from '../../roadmap/fixtures/run.ts'
import { pinnedPackage } from '../../baseline/pinned.ts'
import { switchedOffPolicy, unavailableReason } from '../../roadmap/operations.ts'
import { laneReadings } from './planLanes.ts'
import { laneViewOf, readinessBlockersOf } from './planBoard.ts'
import { stepBodyOf } from './stepBody.ts'
import type { StepVarContext } from './stepVars.ts'

const STEP = 's-goal-block-device-code'

function drawn(f: Fixture) {
  const r = runFixture(f)
  const step = r.steps.find((s) => s.id === STEP)
  assert.ok(step, 'the premise: the device-code step is on the plan')
  const reading = laneReadings(r.steps).get(STEP)
  assert.ok(reading)
  const titleOf = (id: string): string | null => r.steps.find((s) => s.id === id)?.title ?? null
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  const body = stepBodyOf(step, ctx, { lane: laneViewOf(reading, titleOf), blockers: readinessBlockersOf(reading, titleOf) })
  return { step, reading, body, text: body.artifacts.map((a) => a.text()).join('\n') }
}

/** midflight carries this plan's device-code policy, tagged and switched off; on the baseline the product ships. */
const settled = (): Fixture => withFoundationSettled({ ...fixture('midflight'), baseline: pinnedPackage() })

test('a switched-off tagged policy reads Correct on the board, and no channel builds a second one', () => {
  const { step, reading, body, text } = drawn(settled())
  assert.ok(switchedOffPolicy(step), 'the premise: the tenant holds the tagged policy, switched off')
  assert.equal(unavailableReason(step), 'switched-off')
  assert.equal(reading.substatus, 'Correct', `the board reads "${reading.lane} · ${reading.substatus}" over a policy that exists`)
  assert.doesNotMatch(text, /did not find|create it in Report-only|Policies → New policy/, 'a channel builds the policy the tenant already has')
  assert.equal(body.contract.found.some((f) => /follow the instructions below/.test(f.text)), false, 'a finding points at instructions the step does not give')
})

test('turning it back on waits for the plan\'s own prerequisites of enforcement, and is said once they are met', () => {
  const held = drawn(settled())
  assert.match(held.body.contract.whatToDo.text, /Turning it back on is the change here, not a new policy, and it waits until Verify Emergency Access is finished/)
  assert.doesNotMatch(held.body.contract.whatToDo.text, /set Enable policy to On/)
  // The recovery test recorded: nothing holds the turn-on, and the step says to make it.
  const tested = drawn(withRecoveryTested(settled()))
  assert.equal(tested.step.action.enforceWaitsOn, undefined, 'the premise: nothing the plan asks for first is outstanding')
  assert.match(tested.body.contract.whatToDo.text, /set Enable policy to On/)
})
