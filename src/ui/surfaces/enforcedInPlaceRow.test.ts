// A policy the tenant already enforces, delivering its goal, never reads On
// Hold · Not supported. Demo week two: the tenant's own "Core - Block - Device
// code flow" is On and delivers Block Device Code Sign-in, and the scan
// completes the step: no Direction answer and no workflow test stays open on
// it (walk list 2.x item 1; 4.x item 3). Nothing tells the person to scan again
// to rebuild it. Read the way the Plan reads it (testing/stepSnapshots.ts) and
// through the one implementation answer (roadmap/operations.ts policyResult).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture, withEmergencyAccessSettled } from '../../roadmap/fixtures/run.ts'
import { policyResult, unavailableReason } from '../../roadmap/operations.ts'
import { driftOutcomeOf } from '../../roadmap/tracking.ts'
import { stepSnapshotsOf } from '../../testing/stepSnapshots.ts'

const DC = 's-goal-block-device-code'

test('demo week two: the enforced Block Device Code Sign-in is in place, asks for no rebuild, and the scan completes it', () => {
  const f = withEmergencyAccessSettled(fixture('demo-week2'))
  const step = runFixture(f, {}, null, f.snapshot.asOf).steps.find((s) => s.id === DC)
  assert.ok(step)
  assert.equal(step.state.lifecycle, 'enforced', 'the premise: the tenant already enforces it')
  assert.ok(step.satisfiedBy?.sufficient, 'the premise: a tenant policy delivers the goal')
  assert.equal(step.unsavedInputs, undefined, 'the step asks a question of its own')
  assert.equal(step.manualReview, undefined, 'the step asks for a workflow record')
  assert.equal(step.status, 'done', 'the scan does not complete it')
  assert.equal(unavailableReason(step), null)
  assert.notEqual(policyResult(step).kind, 'unavailable')
  assert.equal(driftOutcomeOf(step), null, 'nothing it owns has drifted')
  const snap = stepSnapshotsOf('demo-week2')[DC]
  assert.equal(snap.fact, 'Enforced')
  assert.notEqual(snap.bar, 'Not supported')
  assert.ok(!snap.tiles.some((t) => t.state === 'Not supported' || t.state === 'Unavailable'), JSON.stringify(snap.tiles))
  assert.notEqual(snap.reason, 'until a scan rebuilds this step')
})
