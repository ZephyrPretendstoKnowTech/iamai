// A policy the tenant already enforces, delivering its goal, never reads On
// Hold · Not supported. Demo week two: the tenant's own "Core - Block - Device
// code flow" is On and delivers Block Device Code Sign-in; what stays open is
// the Direction answer nobody saved (device code sign-in in use?) and the
// workflow test a person records. Neither is a policy IAMAI failed to build, so
// nothing tells the person to scan again to rebuild it. Read the way the Plan
// reads it (testing/stepSnapshots.ts) and through the one implementation answer
// (roadmap/operations.ts policyResult).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture, withEmergencyAccessSettled } from '../../roadmap/fixtures/run.ts'
import { isPreserved, policyResult, unavailableReason } from '../../roadmap/operations.ts'
import { driftOutcomeOf } from '../../roadmap/tracking.ts'
import { stepSnapshotsOf } from '../../testing/stepSnapshots.ts'
import { applyStepDecisions } from '../../roadmap/decisions.ts'
import { laneViewFor } from './planBoard.ts'
import { badgeLabel, stepContract } from './stepContract.ts'

const DC = 's-goal-block-device-code'

test('demo week two: the enforced Block Device Code Sign-in is in place, reads Ready · Decision, and asks for no rebuild', () => {
  // With Establish Emergency Access complete (roadmap/foundations.ts) and the
  // Direction left open, which is the unsaved answer this case is about.
  const f = withEmergencyAccessSettled(fixture('demo-week2'))
  const step = runFixture(f, {}, null, f.snapshot.asOf).steps.find((s) => s.id === DC)
  assert.ok(step)
  assert.equal(step.state.lifecycle, 'enforced', 'the premise: the tenant already enforces it')
  assert.ok(step.satisfiedBy?.sufficient, 'the premise: a tenant policy delivers the goal')
  assert.deepEqual(step.unsavedInputs, ['Device code sign-in'], 'the premise: the Direction answer is unsaved')
  assert.equal(policyResult(step).kind, 'not-policy', 'nothing for IAMAI to write, and not a policy it cannot build')
  assert.equal(unavailableReason(step), null)
  assert.equal(isPreserved(step), false, 'not finished either: the workflow test is not recorded')
  assert.equal(driftOutcomeOf(step), null, 'nothing it owns has drifted')
  const snap = stepSnapshotsOf('demo-week2')[DC]
  assert.equal(snap.fact, 'Enforced')
  assert.equal(snap.badge, 'Ready · Decision', 'the open Direction answer is the next thing')
  assert.notEqual(snap.bar, 'Not supported')
  assert.ok(!snap.tiles.some((t) => t.state === 'Not supported' || t.state === 'Unavailable'), JSON.stringify(snap.tiles))
  assert.notEqual(snap.reason, 'until a scan rebuilds this step')
})

test('demo week two answered: the same step asks for its workflow test, never a rescan to rebuild it', () => {
  const w = fixture('demo-week2')
  const f = { ...w, mapping: applyStepDecisions(w.mapping, w.decisions) }
  const run = runFixture(f, {}, null, f.snapshot.asOf)
  const step = run.steps.find((s) => s.id === DC)
  assert.ok(step)
  assert.equal(step.unsavedInputs, undefined, 'the premise: the answer is saved')
  const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => run.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, reportOnlyAt: null }
  const c = stepContract(step, ctx, undefined, laneViewFor(step, run.steps))
  assert.equal(badgeLabel(c), 'Ready · Review')
  assert.equal(c.whatToDo.kind, 'verify', c.whatToDo.text)
  assert.equal(c.implementation.offered, false, 'nothing to write')
  assert.equal(c.implementation.reason, null, 'and nothing IAMAI failed to build')
})
