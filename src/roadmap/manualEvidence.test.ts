import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, curatedFixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { manualEvidenceFields, applyManualReviews, manualBasis, scopeManualBasis, MANUAL_REVIEW_ID } from './manualWork.ts'
import { ownerConfirmationOf } from './decisions.ts'
import type { OwnerConfirmation } from './decisions.ts'
import type { Step } from './types.ts'
import { setState } from './lifecycle.ts'
import { cleanupRecord, withCleanupDone, isRecordedDrill, latestRecoveryTest, cleanupComplete } from './cleanupDone.ts'
import { observedContext, observedRecoveryRecords, recoveryCandidate } from './fixtures/recoveryRecords.ts'

const at = '2026-09-01T12:00:00Z'
function setup(id: string) {
  const f = fixture('demo')
  const step: Step = structuredClone(runFixture(f).steps[0])
  step.id = id
  step.population = { ...step.population, ids: [f.snapshot.users[0].id], activeIds: [f.snapshot.users[0].id] }
  setState(step, { satisfied: true, inPlace: true })
  return { f, step }
}
function recordFor(step: Step, f: ReturnType<typeof fixture>, over: Partial<OwnerConfirmation> = {}): OwnerConfirmation {
  const record = { at, basis: '', accountIds: [...step.population.ids], workflow: 'Payroll application from supported browser', outcome: 'passed' as const, testedAt: '2026-08-31', ...over }
  record.basis = scopeManualBasis(manualBasis(step, f.snapshot, f.mapping), record)
  return record
}
function apply(step: Step, f: ReturnType<typeof fixture>, record: OwnerConfirmation) {
  applyManualReviews([step], f.snapshot, { [step.id]: { [MANUAL_REVIEW_ID]: record } }, f.mapping)
}

// The policy steps record no workflow test (owner, 2026-09-25); the scoped
// record is the legacy-authentication review's.
const REVIEW = 's-ladder-legacy-auth-inventory'

test('scoped records survive decoding and generic history never becomes successful test evidence', () => {
  const { f, step } = setup(REVIEW)
  const record = recordFor(step, f)
  assert.deepEqual(ownerConfirmationOf(record), record)
  apply(step, f, { at, basis: record.basis })
  assert.equal(step.manualReview?.verification, 'historical')
  assert.equal(step.state.satisfied, false)
})

test('new guests are a pending delta on a guest review', () => {
  // (The shared-device review that followed All users policy changes left with its step in Phase 2a.)
  // new guests become a pending delta while the reviewed guest evidence stays current
  {
    const { f, step } = setup('s-ladder-guest-review')
    const guests = f.snapshot.users.filter(u => u.userType === 'guest')
    assert.ok(guests.length)
    step.population.ids = guests.map(u => u.id)
    const record = recordFor(step, f, { outcome: 'retained' })
    apply(step, f, record)
    assert.equal(step.state.satisfied, true)
    f.snapshot.users.push({ ...guests[0], id: 'new-guest', displayName: 'New guest' })
    apply(step, f, record)
    assert.equal(step.manualReview?.verification, 'current')
    assert.deepEqual(step.manualReview?.pendingAccountIds, ['new-guest'])
    assert.equal(step.state.satisfied, false)
    assert.deepEqual(step.manualReview?.record, record)
  }
})

test('failed collection or a historical snapshot without optional sections keeps the dated record and completes nothing', () => {
  // failed collection preserves the dated record without manufacturing a new configuration change
  const { f, step } = setup(REVIEW)
  const record = recordFor(step, f)
  f.snapshot.sources.signInEvidence = { status: 'error', rows: [], reason: 'Unavailable' } as never
  apply(step, f, record)
  assert.equal(step.manualReview?.verification, 'unread')
  assert.deepEqual(step.manualReview?.record, record)
  assert.equal(step.state.satisfied, false)
})

test('failed workflow or observed administrator separation defect cannot be overridden by a manual record', () => {
  const { f, step } = setup(REVIEW)
  apply(step, f, recordFor(step, f, { outcome: 'failed' }))
  assert.equal(step.state.satisfied, false)
  step.id = 's-ladder-admin-accounts-separate'
  setState(step, { satisfied: false, inPlace: false })
  apply(step, f, recordFor(step, f, { replacementAccountId: f.snapshot.users[1].id, roleIds: ['role'] }))
  assert.equal(step.state.satisfied, false)
})

test('a dated successful recovery test never exempts every same-day sign-in, and a later failed test supersedes it', () => {
  // a dated successful recovery test never exempts every same-day sign-in
  {
    const details = { accountIds: ['a'], outcome: 'passed' as const, timeZone: 'UTC' }
    let records = cleanupRecord(withCleanupDone([], 'drill', '2026-08-31', at, details)).records!
    assert.equal(latestRecoveryTest('a', records, at), null, 'a legacy Passed date has no qualifying event evidence')
    assert.equal(isRecordedDrill('2026-08-31T10:00:00Z', [], 'a', records), false)
    // The scan's own record of the one observed passkey sign-in (schema 2).
    const candidate = recoveryCandidate('a', '2026-08-31T10:00:00Z', 'tenant', 'event-a')
    records = cleanupRecord(observedRecoveryRecords({ tenantId: 'tenant', events: { a: candidate }, configurationObservedAt: '2026-08-31T09:00:00Z', at, candidateSetBasis: { a: '["key-a"]' } })).records!
    const context = observedContext(candidate, 'tenant', at, '["key-a"]')
    assert.equal(latestRecoveryTest('a', records, at, undefined, context), '2026-08-31T10:00:00Z')
    assert.equal(isRecordedDrill('2026-08-31T10:00:00Z', [], 'a', records, context), true)
    assert.equal(isRecordedDrill('2026-08-31T11:00:00Z', [], 'a', records, context), false)
    assert.equal(isRecordedDrill('2026-08-31T10:00:00Z', [], 'b', records, context), false)
    assert.equal(cleanupComplete({ kind: 'alerting', done: null }, { signInMonitoring: true }), false)
  }

  // a later failed recovery test supersedes the previous successful test
  {
    let checkpoints = withCleanupDone([], 'drill', '2026-08-29', '2026-08-30T12:00:00Z', { accountIds: ['a'], outcome: 'passed' })
    checkpoints = withCleanupDone(checkpoints, 'drill', '2026-08-31', at, { accountIds: ['a'], outcome: 'failed' })
    assert.equal(latestRecoveryTest('a', cleanupRecord(checkpoints).records!, at), null)
  }
})

test('recovery evidence reopens for replaced methods while harmless account names do not change its basis', async () => {
  const { recoveryAccountBasis } = await import('./cleanupDone.ts')
  const f = fixture('small')
  const id = f.mapping.breakGlassUserIds[0]
  const original = recoveryAccountBasis(f.snapshot, [id])[id]
  assert.ok(original)
  f.snapshot.users.find(u => u.id === id)!.displayName = 'Renamed emergency account'
  assert.equal(recoveryAccountBasis(f.snapshot, [id])[id], original)
  f.snapshot.authMethods[id] = [{ kind: 'fido2', aaGuid: '11111111-1111-1111-1111-111111111111' }]
  assert.notEqual(recoveryAccountBasis(f.snapshot, [id])[id], original)
})

test('consolidation retains completion through intended retirement and rename, but not replacement drift or loss', async () => {
  const { consolidationVerified, replacementPolicyBasis } = await import('./cleanupDone.ts')
  const policy = { id: 'replacement', displayName: 'New policy', state: 'enabled', conditions: { users: { includeUsers: ['All'] } }, grantControls: { builtInControls: ['mfa'] } }
  const record = { cleanup: 'consolidation' as const, at, date: '2026-08-31', outcome: 'passed' as const, replacementPolicyId: policy.id, retiredPolicyIds: ['retired'], coverageVerified: true, replacementBasis: replacementPolicyBasis(policy)! }
  assert.equal(consolidationVerified(record, [policy]), true)
  assert.equal(consolidationVerified(record, [{ ...policy, displayName: 'Renamed' }, { id: 'retired', state: 'disabled' }]), true)
  assert.equal(consolidationVerified(record, [{ ...policy, state: 'disabled' }]), false)
  assert.equal(consolidationVerified(record, [policy, { id: 'retired', state: 'enabled' }]), false)
  assert.equal(consolidationVerified(record, [{ ...policy, grantControls: { builtInControls: ['compliantDevice'] } }]), false)
  assert.equal(consolidationVerified(record, null), false)
})

test('an enforced policy finishes on what the scan reads, with no workflow record', () => {
  // Require MFA for Guests read Ready · Review over its enforced policies, waiting
  // on a test the person recorded; no step records one now (owner, 2026-09-25).
  // Its guest policy at the grant the baseline asks of every guest type
  // (phishing-resistant MFA meets Jon's Modern MFA + TAP; owner, 2026-09-25): as
  // shipped it asks only MFA, which delivers two of the six types.
  const f = structuredClone(curatedFixture('demo-week2'))
  for (const p of f.snapshot.config.caPolicies.rows as { conditions?: { users?: { includeUsers?: string[] } }; grantControls?: unknown }[]) {
    if (p.conditions?.users?.includeUsers?.includes('GuestsOrExternalUsers')) p.grantControls = { operator: 'OR', builtInControls: [], authenticationStrength: { id: '00000000-0000-0000-0000-000000000004' } }
  }
  const result = runFixture(f)
  const guests = result.steps.find(s => s.id === 's-goal-guests-mfa')!
  assert.equal(guests.state.lifecycle, 'enforced', 'the premise: deployment remains observable')
  assert.equal(guests.manualReview, undefined, 'Require MFA for Guests still asks for a workflow record')
  assert.equal(guests.status === 'done', guests.state.satisfied, 'done exactly when the scan finds its policies in place')
  // Block Device Code Sign-in has no workflow test (walk list 4.x item 3): the
  // matching enforced policy completes it from the scan.
  const deviceCode = result.steps.find(s => s.id === 's-goal-block-device-code')!
  assert.equal(deviceCode.manualReview, undefined, 'Block Device Code Sign-in still asks for a workflow record')
  assert.equal(deviceCode.state.lifecycle, 'enforced')
  assert.equal(deviceCode.status, 'done', 'the enforced matching policy does not complete Block Device Code Sign-in')
})


test('no policy step asks for a workflow record, and none asks for free text nothing reads', () => {
  // The step template bans Workflow Check, Outcome, Tested On and Save Check
  // (owner, 2026-09-25): the five policy steps that recorded a test ask for nothing.
  for (const id of ['s-goal-guests-mfa', 's-goal-pim-activation-reauth', 's-goal-user-risk-medium', 's-goal-intune-enrollment-reauth', 's-goal-service-accounts-trusted-network']) {
    assert.deepEqual(manualEvidenceFields(id), [], `${id} still asks for a workflow record`)
  }
  // The generic free text nothing reads is gone everywhere: `reference` was a
  // change-record box the product only printed back.
  for (const id of ['s-goal-pim-activation-reauth', 's-goal-block-legacy-auth', 's-check-separate-admin-accounts', 's-goal-guests-mfa']) {
    assert.equal(manualEvidenceFields(id).some(field => field.key === 'reference'), false, `${id} still asks for a change record`)
  }
  // Block Legacy Authentication's mail route is the sign-in records' (walk list 4.x item 4), and asks for nothing.
  assert.deepEqual(manualEvidenceFields('s-goal-block-legacy-auth'), [], 'Block Legacy Authentication still asks for a record')
})

