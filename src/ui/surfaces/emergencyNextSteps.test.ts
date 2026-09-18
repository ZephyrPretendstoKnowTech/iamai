import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { emergencyGroupTasksOf } from './emergencyGroupTasks.ts'
import { emergencyPasskeyTasksOf } from './emergencyPasskeyTasks.ts'
import { emergencyVerificationJson, emergencyVerificationPowerShell, emergencyVerificationTasksOf } from './emergencyVerificationTasks.ts'
import { laneReadings } from './planLanes.ts'
import type { CleanupPhase } from '../../roadmap/cleanupPhase.ts'

function context() {
  const f = structuredClone(fixture('demo-week2'))
  return { f, ctx: { snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, nameOf: (id: string) => f.snapshot.users.find(user => user.id === id)?.displayName || id, now: f.snapshot.asOf, signature: 'IT', operatorId: f.operatorId } }
}

test('Step 2 projects exact member and policy work and never owns a pre-change test', () => {
  const { f, ctx } = context()
  const step = runFixture(f).steps.find(item => item.id === 's-prereq-exclusion-group')!
  const projection = emergencyGroupTasksOf(step, ctx)
  assert.deepEqual(projection.tasks.map(task => task.title), [
    'Create an emergency exclusions group',
    'Choose an existing exclusions group',
    'Manage emergency account membership',
    'Configure Conditional Access exclusions',
  ])
  assert.equal(projection.tasks.some(task => /pre-change|recovery test/i.test(task.title + ' ' + task.steps.join(' '))), false)
  const policyTask = projection.tasks.find(task => task.id === 'configure-policy-exclusions')!
  assert.ok(policyTask)
  assert.match(policyTask.steps.join(' '), /Preserve the policy mode, other exclusions and all unrelated settings/)
  assert.equal(step.configurationFindings?.some(finding => finding.key === 'pre-change-recovery'), false)
  const demo = runFixture(fixture('demo'))
  assert.equal(laneReadings(demo.steps).get(step.id)?.substatus, 'Correct')
})

test('Step 3 exposes the three contracted readiness topics and uses the exact resolved task projection', () => {
  const { f, ctx } = context()
  const step = runFixture(f).steps.find(item => item.id === 's-prereq-passkey-settings')!
  assert.deepEqual(step.configurationFindings?.map(item => item.label), ['Passkey Registration', 'Existing passkeys affected', 'Passkey Protections'])
  const projection = emergencyPasskeyTasksOf(step, ctx)
  assert.ok(projection.tasks.filter(task => task.id !== 'inspect-passkey-settings').every(task => task.steps.at(-1)?.includes('Scan to update the plan')))
  assert.doesNotMatch(projection.tasks.find(task => task.id === 'inspect-passkey-settings')!.steps.at(-1) ?? '', /Scan to update the plan/)
  assert.ok((projection.approvedModels ?? []).some(model => model.name === 'Microsoft Authenticator — iOS'))
})

test('unresolved passkey collection remains coverage work rather than a required inspection loop', () => {
  const { f, ctx } = context()
  f.snapshot.config.authMethodsPolicy = { status: 'error', reason: 'Read denied', rows: [] }
  const step = runFixture(f).steps.find(item => item.id === 's-prereq-passkey-settings')!
  const projection = emergencyPasskeyTasksOf(step, ctx)
  const inspect = projection.tasks.find(task => task.id === 'inspect-passkey-settings')!
  assert.equal(inspect.required, false)
  assert.equal(inspect.evidence, null)
  assert.doesNotMatch(inspect.steps.join(' '), /Scan to update the plan|scan again/i)
  assert.equal(projection.tasks.some(task => task.required), false)
})

test('Step 4 task and machine projections remain read-only and identity-stable', () => {
  const phase = {
    accountIds: ['account-1'], accountUpnsById: { 'account-1': 'emergency@contoso.onmicrosoft.com' }, accountBasis: { 'account-1': 'basis' },
    configurationObservedAtByAccount: { 'account-1': '2026-09-15T10:00:00.000Z' }, recoveryCandidates: { 'account-1': [] },
    recoveryFindings: [{ key: 'recovery-configuration', label: 'Configuration', value: 'Verified', detail: '', outcome: 'pass' }],
    tenantId: 'tenant-1', snapshotObservedAt: '2026-09-16T10:00:00.000Z', rows: [], start: '2026-09-16', end: '2026-09-16', convention: null,
  } as unknown as CleanupPhase
  const tasks = emergencyVerificationTasksOf(phase).tasks
  assert.deepEqual(tasks.map(task => task.title), ['Verify emergency sign-in', 'Troubleshoot emergency sign-in'])
  // The per-account list is the Sign-in Evidence tile's; the Implementation Task does not repeat it.
  assert.ok(tasks[0].readinessFacts?.some(fact => fact.label === 'emergency@contoso.onmicrosoft.com'))
  assert.equal(tasks[0].facts, undefined)
  assert.ok(tasks[0].steps.some(line => line.includes('Sign in as that emergency account using its prepared passkey.')))
  assert.ok(tasks[0].steps.some(line => line.includes('Wait 5–10 minutes')))
  assert.equal(tasks.flatMap(task => task.steps).some(line => /Start verification|Save verification|Passed|Failed/.test(line)), false)
  assert.ok(tasks[1].steps.some(line => line.includes('Sign-in logs')))
  const script = emergencyVerificationPowerShell(phase)
  assert.match(script, /while \(\$next\)/)
  assert.doesNotMatch(script, /\b(?:POST|PATCH|DELETE)\b/)
  const json = JSON.parse(emergencyVerificationJson(phase))
  assert.equal(json.accounts[0].upn, 'emergency@contoso.onmicrosoft.com')
  assert.match(json.purpose, /not a Graph write payload/)
})

test('a current passing final result does not ask the operator to record it again', () => {
  const phase = {
    accountIds: ['account-1'], accountUpnsById: { 'account-1': 'emergency@contoso.onmicrosoft.com' }, accountBasis: { 'account-1': 'basis' },
    configurationObservedAtByAccount: { 'account-1': '2026-09-15T10:00:00.000Z' },
    recoveryCandidates: { 'account-1': [{ qualifies: true, reason: null, candidate: { eventId: 'event-1', at: '2026-09-16T09:00:00.000Z' } }] },
    recoveryFindings: [
      { key: 'recovery-configuration', label: 'Configuration', value: 'Verified', detail: '', outcome: 'pass' },
      { key: 'recovery-sign-ins', label: 'Sign-in evidence', value: 'Verified', detail: '', outcome: 'pass', items: [{ accountId: 'account-1', subjectId: 'account-1', label: 'Passkey sign-in verified', value: 'Sep 16, 2026, 10:00 AM UTC', outcome: 'pass' }] },
      { key: 'recovery-confirmation', label: 'Verification', value: 'Passed', detail: '', outcome: 'pass', items: [{ accountId: 'account-1', subjectId: 'account-1', label: 'Result', value: 'Passed', outcome: 'pass' }] },
    ],
    tenantId: 'tenant-1', snapshotObservedAt: '2026-09-16T10:00:00.000Z', rows: [], start: '2026-09-16', end: '2026-09-16', convention: null,
  } as unknown as CleanupPhase
  const tasks = emergencyVerificationTasksOf(phase).tasks
  assert.equal(tasks.some(task => task.id === 'record-verification:account-1' && task.required), false)
})

test('verification PowerShell remains valid with no accounts or checkpoint', () => {
  const phase = { accountIds: [], rows: [], start: '2026-09-16', end: '2026-09-16', convention: null } as unknown as CleanupPhase
  const script = emergencyVerificationPowerShell(phase)
  assert.doesNotMatch(script, /\[DateTimeOffset\]''/)
  assert.match(script, /AddDays\(-30\)/)
  assert.match(script, /No emergency accounts are selected/)
})
