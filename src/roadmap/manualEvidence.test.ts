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

test('scoped records survive decoding and generic history never becomes successful test evidence', () => {
  const { f, step } = setup('s-goal-guests-mfa')
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
  {
    const { f, step } = setup('s-goal-guests-mfa')
    const record = recordFor(step, f)
    f.snapshot.config.caPolicies = { status: 'error', rows: [], reason: 'Unavailable' }
    apply(step, f, record)
    assert.equal(step.manualReview?.verification, 'unread')
    assert.deepEqual(step.manualReview?.record, record)
    assert.equal(step.state.satisfied, false)
  }

  // historical snapshots without optional configuration sections remain reviewable with unknown evidence
  {
    const { f, step } = setup('s-goal-guests-mfa')
    delete (f.snapshot.config as Partial<typeof f.snapshot.config>).authStrengths
    delete (f.snapshot.config as Partial<typeof f.snapshot.config>).crossTenantAccess
    applyManualReviews([step], f.snapshot, {}, f.mapping)
    assert.equal(step.manualReview?.verification, 'unread')
    assert.equal(step.state.satisfied, false)
  }
})

test('failed workflow or observed administrator separation defect cannot be overridden by a manual record', () => {
  const { f, step } = setup('s-goal-guests-mfa')
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

test('PIM manual proof identifies the actual policy context, tested role and linked configuration', () => {
  const { f, step } = setup('s-goal-pim-activation-reauth')
  step.satisfiedBy = { policies: ['pim'], sufficient: 'pim' }
  f.snapshot.config.caPolicies.rows = [{ id: 'pim', state: 'enabled', conditions: { applications: { includeAuthenticationContextClassReferences: ['c1'] } } }]
  const record = recordFor(step, f, { roleIds: ['role'], contextId: 'c2', configurationVerified: true })
  apply(step, f, record)
  assert.equal(step.state.satisfied, false)
  setState(step, { satisfied: true, inPlace: true })
  apply(step, f, { ...record, contextId: 'c1' })
  assert.equal(step.state.satisfied, true)
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

test('policy tracking preserves observed enforcement without completing an untested workflow', () => {
  const result = runFixture(curatedFixture('demo-week2'))
  for (const id of ['s-goal-guests-mfa']) {
    const step = result.steps.find(s => s.id === id)!
    assert.equal(step.state.lifecycle, 'enforced', `${id}: deployment remains observable`)
    assert.equal(step.manualReview?.confirmedAt, null)
    assert.equal(step.state.satisfied, false, `${id}: tracking cannot replace a workflow test`)
    assert.notEqual(step.status, 'done')
  }
  // Block Device Code Sign-in has no workflow test (walk list 4.x item 3): the
  // matching enforced policy completes it from the scan.
  const deviceCode = result.steps.find(s => s.id === 's-goal-block-device-code')!
  assert.equal(deviceCode.manualReview, undefined, 'Block Device Code Sign-in still asks for a workflow record')
  assert.equal(deviceCode.state.lifecycle, 'enforced')
  assert.equal(deviceCode.status, 'done', 'the enforced matching policy does not complete Block Device Code Sign-in')
})


test('a workflow step asks for the outcome and what IAMAI can check, and for no list of people', () => {
  // PIM's completion is counted per workflow, not per person
  // (`pendingAccountIds` is empty for every POLICY_WORKFLOWS step), so the
  // account picker gathered an answer nothing read. It is gone (owner,
  // 2026-09-20). What is left is checked against the tenant: an authentication
  // context the policies do not reference is a defect IAMAI raises.
  const { f, step } = setup('s-goal-pim-activation-reauth')
  step.population.ids = f.snapshot.users.map(user => user.id)
  applyManualReviews([step], f.snapshot, {}, f.mapping)
  const keys = step.manualReview!.fields!.map(field => field.key)
  assert.deepEqual(keys, ['contextId', 'configurationVerified', 'outcome', 'testedAt'])
  assert.equal(keys.includes('accountIds'), false, 'a list of people nothing reads')
  assert.deepEqual(step.manualReview!.pendingAccountIds, [])
  // The generic free text nothing reads is gone everywhere: `reference` was a
  // change-record box the product only printed back.
  for (const id of ['s-goal-pim-activation-reauth', 's-goal-block-legacy-auth', 's-check-separate-admin-accounts', 's-goal-guests-mfa']) {
    assert.equal(manualEvidenceFields(id).some(field => field.key === 'reference'), false, `${id} still asks for a change record`)
  }
  // One text field stays, because the owner put it there: the evidence a deleted
  // step used to ask for, folded onto the step that inherited its work
  // (step-redundancy-analysis finding 5). Block Legacy Authentication's mail route
  // is the sign-in records' now (walk list 4.x item 4), and asks for nothing.
  assert.equal(manualEvidenceFields('s-goal-guests-mfa').some(field => field.key === 'providerAccessPath'), true)
  assert.deepEqual(manualEvidenceFields('s-goal-block-legacy-auth'), [], 'Block Legacy Authentication still asks for a record')
})

