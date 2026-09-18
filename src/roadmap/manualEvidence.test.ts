import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, curatedFixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { applyManualReviews, manualBasis, scopeManualBasis, MANUAL_REVIEW_ID } from './manualWork.ts'
import { ownerConfirmationOf } from './decisions.ts'
import type { OwnerConfirmation } from './decisions.ts'
import type { Step } from './types.ts'
import { setState } from './lifecycle.ts'
import { cleanupRecord, withCleanupDone, isRecordedDrill, latestRecoveryTest, cleanupComplete, RECOVERY_PREPARATION_WORKFLOW } from './cleanupDone.ts'

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
  const { f, step } = setup('s-shared-devices')
  const record = recordFor(step, f)
  assert.deepEqual(ownerConfirmationOf(record), record)
  apply(step, f, { at, basis: record.basis })
  assert.equal(step.manualReview?.verification, 'historical')
  assert.equal(step.state.satisfied, false)
})

test('shared account review follows All users policy changes but ignores explicitly excluded unrelated users', () => {
  const { f, step } = setup('s-shared-devices')
  f.snapshot.config.caPolicies.rows = [{ id: 'all', state: 'enabled', conditions: { users: { includeUsers: ['All'], excludeUsers: [] } } }, { id: 'other', state: 'enabled', conditions: { users: { includeUsers: ['All'], excludeUsers: step.population.ids } } }]
  const record = recordFor(step, f)
  apply(step, f, record)
  assert.equal(step.state.satisfied, true)
  ;(f.snapshot.config.caPolicies.rows[1] as any).grantControls = { builtInControls: ['block'] }
  apply(step, f, record)
  assert.equal(step.state.satisfied, true)
  ;(f.snapshot.config.caPolicies.rows[0] as any).grantControls = { builtInControls: ['block'] }
  apply(step, f, record)
  assert.equal(step.manualReview?.verification, 'changed')
  assert.equal(step.state.satisfied, false)
})

test('failed collection preserves the dated record without manufacturing a new configuration change', () => {
  const { f, step } = setup('s-shared-devices')
  const record = recordFor(step, f)
  f.snapshot.config.caPolicies = { status: 'error', rows: [], reason: 'Unavailable' }
  apply(step, f, record)
  assert.equal(step.manualReview?.verification, 'unread')
  assert.deepEqual(step.manualReview?.record, record)
  assert.equal(step.state.satisfied, false)
})

test('new guests become a pending delta while the reviewed guest evidence stays current', () => {
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
})

test('failed workflow or observed administrator separation defect cannot be overridden by a manual record', () => {
  const { f, step } = setup('s-question-partner')
  apply(step, f, recordFor(step, f, { outcome: 'failed' }))
  assert.equal(step.state.satisfied, false)
  step.id = 's-ladder-admin-accounts-separate'
  setState(step, { satisfied: false, inPlace: false })
  apply(step, f, recordFor(step, f, { replacementAccountId: f.snapshot.users[1].id, roleIds: ['role'] }))
  assert.equal(step.state.satisfied, false)
})

test('a dated successful recovery test never exempts every same-day sign-in', () => {
  const details = { accountIds: ['a'], outcome: 'passed' as const, timeZone: 'UTC' }
  let records = cleanupRecord(withCleanupDone([], 'drill', '2026-08-31', at, details)).records!
  assert.equal(latestRecoveryTest('a', records, at), null, 'a legacy Passed date has no qualifying event evidence')
  assert.equal(isRecordedDrill('2026-08-31T10:00:00Z', [], 'a', records), false)
  const configurationObservedAt = '2026-08-31T09:00:00Z'
  const evidence = { a: { schema: 1 as const, purpose: 'final' as const, tenantId: 'tenant', accountId: 'a', eventId: 'event-a', eventAt: '2026-08-31T10:00:00Z', appId: '797f4846-ba00-4fd7-ba43-dac1f8f63013', resourceId: '797f4846-ba00-4fd7-ba43-dac1f8f63013', method: 'Passkey (FIDO2)' as const, provenance: 'observed-sign-in' as const, recoveryConfirmed: true as const, credentialConfirmed: true as const, configurationObservedAt } }
  const candidate = { schema: 1 as const, eventId: 'event-a', userId: 'a', at: evidence.a.eventAt, success: true, isInteractive: true, appId: evidence.a.appId, resourceId: evidence.a.resourceId, app: 'Portal', resource: 'Azure management', method: 'Passkey (FIDO2)', freshMethod: true }
  let checkpoints = withCleanupDone([], 'drill', '2026-08-31', configurationObservedAt, { accountIds: ['a'], workflow: RECOVERY_PREPARATION_WORKFLOW, purpose: 'final' as const, tenantId: 'tenant', configurationObservedAt })
  checkpoints = withCleanupDone(checkpoints, 'drill', '2026-08-31', at, { ...details, purpose: 'final', recoveryEvidence: evidence, signInAtByAccount: { a: '2026-08-31T10:00:00Z' } })
  records = cleanupRecord(checkpoints).records!
  const context = { readings: [{ candidate, qualifies: true, reason: null }], tenantId: 'tenant', currentSnapshotObservedAt: at }
  assert.equal(latestRecoveryTest('a', records, at, undefined, context), '2026-08-31T12:00:00.000Z')
  assert.equal(isRecordedDrill('2026-08-31T10:00:00Z', [], 'a', records, context), true)
  assert.equal(isRecordedDrill('2026-08-31T11:00:00Z', [], 'a', records, context), false)
  assert.equal(isRecordedDrill('2026-08-31T10:00:00Z', [], 'b', records, context), false)
  assert.equal(cleanupComplete({ kind: 'alerting', done: null }, { signInMonitoring: true }), false)
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

test('a later failed recovery test supersedes the previous successful test', () => {
  let checkpoints = withCleanupDone([], 'drill', '2026-08-29', '2026-08-30T12:00:00Z', { accountIds: ['a'], outcome: 'passed' })
  checkpoints = withCleanupDone(checkpoints, 'drill', '2026-08-31', at, { accountIds: ['a'], outcome: 'failed' })
  assert.equal(latestRecoveryTest('a', cleanupRecord(checkpoints).records!, at), null)
})

test('the simplified policy steps complete from scanned configuration without a Workflow Check form', () => {
  for (const id of ['s-goal-token-protection', 's-goal-block-auth-transfer', 's-goal-user-risk']) {
    const {f, step} = setup(id)
    setState(step, {satisfied: true, inPlace: true})
    applyManualReviews([step], f.snapshot, {}, f.mapping)
    assert.equal(step.state.satisfied, true, id)
    assert.equal(step.manualReview, undefined, id)
    setState(step, {satisfied: false, inPlace: false})
    applyManualReviews([step], f.snapshot, {}, f.mapping)
    assert.equal(step.state.satisfied, false, 'removing a workflow form does not override a scan failure')
  }
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
  for (const id of ['s-goal-guests-mfa', 's-goal-block-device-code']) {
    const step = result.steps.find(s => s.id === id)!
    assert.equal(step.state.lifecycle, 'enforced', `${id}: deployment remains observable`)
    assert.equal(step.manualReview?.confirmedAt, null)
    assert.equal(step.state.satisfied, false, `${id}: tracking cannot replace a workflow test`)
    assert.notEqual(step.status, 'done')
  }
})

test('historical snapshots without optional configuration sections remain reviewable with unknown evidence', () => {
  const { f, step } = setup('s-goal-guests-mfa')
  delete (f.snapshot.config as Partial<typeof f.snapshot.config>).authStrengths
  delete (f.snapshot.config as Partial<typeof f.snapshot.config>).crossTenantAccess
  applyManualReviews([step], f.snapshot, {}, f.mapping)
  assert.equal(step.manualReview?.verification, 'unread')
  assert.equal(step.state.satisfied, false)
})


test('PIM workflow account choices show active or eligible role holders, and representative evidence does not require the All-users population', () => {
  const { f, step } = setup('s-goal-pim-activation-reauth')
  step.population.ids = f.snapshot.users.map(user => user.id)
  applyManualReviews([step], f.snapshot, {}, f.mapping)
  const choices = step.manualReview!.fields!.find(field => field.key === 'accountIds')!.options!
  assert.ok(choices.length > 0)
  assert.ok(choices.length < f.snapshot.users.length)
  for (const choice of choices) assert.ok((f.snapshot.roles.active[choice.value]?.length ?? 0) + (f.snapshot.roles.eligible[choice.value]?.length ?? 0) > 0)
  assert.deepEqual(step.manualReview!.pendingAccountIds, [])
})


test('free-tier emergency check reuses scoped recovery tests and does not offer a duplicate confirmation', async () => {
  const f = fixture('small')
  const step = structuredClone(runFixture(f).steps[0])
  step.id = 's-ladder-break-glass-accounts'
  step.population.ids = [...f.mapping.breakGlassUserIds]
  f.snapshot.config.securityDefaults = { status: 'ok', reason: null, rows: [{ isEnabled: true }] }
  f.snapshot.config.caPolicies = { status: 'disabled', rows: [], reason: 'Free tenant' }
  const { recoveryAccountBasis } = await import('./cleanupDone.ts')
  const accountBasis = recoveryAccountBasis(f.snapshot, step.population.ids, f.mapping, f.groups)
  assert.equal(Object.keys(accountBasis).length, step.population.ids.length)
  const eventAt = new Date(Date.parse(f.snapshot.asOf) - 3_600_000).toISOString()
  const configurationObservedAt = new Date(Date.parse(eventAt) - 3_600_000).toISOString()
  for (const [index, id] of step.population.ids.entries()) f.snapshot.signInEvidence[id] = { ...(f.snapshot.signInEvidence[id] ?? { signInCount: 1, lastSignIn: eventAt, lastMfaSuccess: null }), recoveryCandidates: [{ schema: 1, eventId: `free-tier-${index}`, userId: id, at: eventAt, success: true, isInteractive: true, appId: '797f4846-ba00-4fd7-ba43-dac1f8f63013', resourceId: '797f4846-ba00-4fd7-ba43-dac1f8f63013', app: 'Portal', resource: 'Azure management', method: 'Passkey (FIDO2)', freshMethod: true }] }
  const preparation = { cleanup: 'drill' as const, date: configurationObservedAt, at: configurationObservedAt, workflow: RECOVERY_PREPARATION_WORKFLOW, purpose: 'final' as const, tenantId: f.snapshot.tenantId, configurationObservedAt, accountIds: step.population.ids, accountBasis }
  const records = [preparation, ...step.population.ids.map((id, index) => ({ cleanup: 'drill' as const, date: f.snapshot.asOf, at: f.snapshot.asOf, outcome: 'passed' as const, purpose: 'final' as const, accountIds: [id], accountBasis, recoveryEvidence: { [id]: { schema: 1 as const, purpose: 'final' as const, tenantId: f.snapshot.tenantId, accountId: id, eventId: `free-tier-${index}`, eventAt, appId: '797f4846-ba00-4fd7-ba43-dac1f8f63013', resourceId: '797f4846-ba00-4fd7-ba43-dac1f8f63013', method: 'Passkey (FIDO2)' as const, provenance: 'observed-sign-in' as const, recoveryConfirmed: true as const, credentialConfirmed: true as const, configurationObservedAt } } }))]
  applyManualReviews([step], f.snapshot, {}, f.mapping, records, f.groups)
  assert.equal(step.manualReview, undefined)
  assert.equal(step.state.satisfied, true)
  const changed = records.map(r => ({ ...r, outcome: 'failed' as const }))
  applyManualReviews([step], f.snapshot, {}, f.mapping, changed, f.groups)
  assert.equal(step.state.satisfied, false)
  assert.equal(step.manualReview, undefined)
})


test('administrator separation requires an explicit dedicated-use review, including the canonical paid-tier step', () => {
  const { f, step } = setup('s-check-separate-admin-accounts')
  f.snapshot.config.pimEligibility = { status: 'ok', reason: null, rows: [] }
  for (const id of Object.keys(f.snapshot.roles.active)) if (!Array.isArray(f.snapshot.authMethods[id])) f.snapshot.authMethods[id] = []
  applyManualReviews([step], f.snapshot, {}, f.mapping)
  assert.equal(step.state.satisfied, false, 'absence of a mailbox or recent workload activity is not proof')
  assert.ok(step.population.ids.length > 0)
  const record = recordFor(step, f, { outcome: 'retained', workflow: 'Every listed privileged account is used only for administrative tasks' })
  apply(step, f, record)
  assert.equal(step.state.satisfied, true)
  f.snapshot.roles.eligible[step.population.ids[0]] = ['new-role']
  apply(step, f, record)
  assert.equal(step.state.satisfied, false, 'new relevant privileged scope needs review')
})
