// The campaign's "Turn on without them for now" list (roadmap/followUp.ts,
// owner decision 9, 2026-09-22).
//
// Prepare Your Team for MFA counted as finished only when every active person
// was ready, and the graph holds every policy that asks for a method behind it.
// One person on leave until November held Require MFA for All Users, the admin
// policy and the risk policies alike. The owner: "without holding security for
// the whole org up for just one person who might not be in for another month."
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { applyStepDecisions } from './decisions.ts'
import { CAMPAIGN_STEP_ID, MFA_FOLLOW_UP_KEY, WAITS_ON_CAMPAIGN } from './followUp.ts'
import { laneReadings } from '../ui/surfaces/planLanes.ts'
import type { Step } from './types.ts'

/** A fixture whose campaign is open: ten of thirty people not ready. */
const base = (): Fixture => curatedFixture('demo')

function marking(f: Fixture, ids: string[], provenance: 'detected' | 'confirmed' = 'confirmed'): Fixture {
  return { ...f, mapping: applyStepDecisions(f.mapping, { [MFA_FOLLOW_UP_KEY]: { picked: ids, at: f.snapshot.asOf } }, provenance) }
}

const campaignOf = (steps: readonly Step[]): Step => {
  const c = steps.find((s) => s.id === CAMPAIGN_STEP_ID)
  assert.ok(c, 'the campaign left the plan')
  return c
}

test('the premise: the campaign is open, and nothing is turned on without anybody', () => {
  const run = runFixture(base())
  const c = campaignOf(run.steps)
  assert.notEqual(c.status, 'done')
  assert.ok((c.preparation?.missingIds.length ?? 0) > 1, 'the fixture has people who are not ready')
  assert.equal(c.preparation?.followUpIds, undefined)
  assert.ok(run.steps.every((s) => s.turnOnWithout === undefined))
})

test('marking everyone not ready finishes the campaign, and the board stops holding its policies on it', () => {
  const missing = campaignOf(runFixture(base()).steps).preparation!.missingIds
  // The support list confirmed as well, as a person finishing the campaign would: an unsaved one keeps it short of Completed on its own (roadmap/answers.ts).
  const f = marking(base(), missing)
  const run = runFixture({ ...f, mapping: applyStepDecisions(f.mapping, { [CAMPAIGN_STEP_ID]: { picked: [], at: f.snapshot.asOf } }) })
  const c = campaignOf(run.steps)
  assert.equal(c.status, 'done')
  assert.deepEqual(c.preparation?.followUpIds, missing)
  assert.deepEqual(c.turnOnWithout, missing)
  const readings = laneReadings(run.steps)
  assert.equal(readings.get(CAMPAIGN_STEP_ID)?.lane, 'Completed')
  for (const s of run.steps.filter((x) => WAITS_ON_CAMPAIGN.has(x.id))) {
    const waits = (readings.get(s.id)?.blockers ?? []).filter((b) => b.id === CAMPAIGN_STEP_ID)
    assert.deepEqual(waits, [], `${s.id} still waits on the campaign`)
  }
})

test('each policy that waited on the campaign names the marked people its policy reaches', () => {
  const missing = campaignOf(runFixture(base()).steps).preparation!.missingIds
  const run = runFixture(marking(base(), missing))
  const waiting = run.steps.filter((s) => WAITS_ON_CAMPAIGN.has(s.id))
  assert.ok(waiting.length > 0)
  for (const s of waiting) {
    assert.ok((s.turnOnWithout?.length ?? 0) > 0, `${s.id} names nobody`)
    assert.ok(s.turnOnWithout!.every((id) => missing.includes(id)), `${s.id} names somebody nobody marked`)
  }
  // A policy that reaches only some of them names only those: the admin policy, its admins.
  const admin = run.steps.find((s) => s.id === 's-goal-admins-phishing-resistant')
  if (admin?.methodPreparation) assert.ok(admin.turnOnWithout!.every((id) => admin.methodPreparation!.ids.includes(id)))
})

test('one person left unmarked keeps the campaign open', () => {
  const missing = campaignOf(runFixture(base()).steps).preparation!.missingIds
  const run = runFixture(marking(base(), missing.slice(1)))
  const c = campaignOf(run.steps)
  assert.notEqual(c.status, 'done')
  // Still named: the people are marked whether or not the campaign is finished.
  assert.deepEqual(c.preparation?.followUpIds, missing.slice(1))
})

test('only a Save marks anybody: a detected decision marks nobody', () => {
  const missing = campaignOf(runFixture(base()).steps).preparation!.missingIds
  const f = marking(base(), missing, 'detected')
  assert.equal(f.mapping.mfaFollowUpIds, undefined)
  assert.notEqual(campaignOf(runFixture(f).steps).status, 'done')
})

test('the policies keep their own readiness thresholds: marking people does not open the 90% gate', () => {
  const missing = campaignOf(runFixture(base()).steps).preparation!.missingIds
  const before = runFixture(base()).steps.find((s) => s.id === 's-goal-mfa-all-users')
  const after = runFixture(marking(base(), missing)).steps.find((s) => s.id === 's-goal-mfa-all-users')
  assert.ok(before?.action.readinessGate, 'the premise: the MFA policy is held on its threshold')
  assert.deepEqual(after?.action.readinessGate?.value, before?.action.readinessGate?.value)
  assert.equal(after?.action.readinessGate?.threshold, '90%')
})

test('somebody marked who has since become ready is no longer turned on without', () => {
  const c = campaignOf(runFixture(base()).steps)
  const ready = c.preparation!.readyIds[0]
  const run = runFixture(marking(base(), [ready, ...c.preparation!.missingIds]))
  assert.ok(!campaignOf(run.steps).preparation?.followUpIds?.includes(ready))
})
