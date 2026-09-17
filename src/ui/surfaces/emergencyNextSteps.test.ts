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
  assert.equal(projection.tasks.some(task => /pre-change|recovery test/i.test(task.title + ' ' + task.steps.join(' '))), false)
  for (const task of projection.tasks.filter(task => task.id.startsWith('exclude-policy:'))) {
    assert.match(task.id, /^exclude-policy:.+/)
    assert.match(task.steps.join(' '), /Preserve all existing|Keep the policy mode/)
  }
  assert.equal(step.configurationFindings?.some(finding => finding.key === 'pre-change-recovery'), false)
  const demo = runFixture(fixture('demo'))
  assert.equal(laneReadings(demo.steps).get(step.id)?.substatus, 'Correct')
})

test('Step 3 exposes four readiness topics and uses the exact resolved task projection', () => {
  const { f, ctx } = context()
  const step = runFixture(f).steps.find(item => item.id === 's-prereq-passkey-settings')!
  assert.deepEqual(step.configurationFindings?.map(item => item.label), ['Method Availability', 'Storage and Attestation', 'Approved Authenticators', 'Existing Passkeys Affected'])
  const projection = emergencyPasskeyTasksOf(step, ctx)
  assert.ok(projection.tasks.every(task => task.steps.at(-1)?.includes('Scan to update the plan')))
  assert.ok((projection.approvedModels ?? []).some(model => model.name === 'Microsoft Authenticator — iOS'))
})

test('Step 4 task and machine projections remain read-only and identity-stable', () => {
  const phase = {
    accountIds: ['account-1'], accountUpnsById: { 'account-1': 'emergency@contoso.onmicrosoft.com' }, accountBasis: { 'account-1': 'basis' },
    configurationObservedAtByAccount: { 'account-1': '2026-09-15T10:00:00.000Z' }, recoveryCandidates: { 'account-1': [] },
    recoveryFindings: [{ key: 'recovery-configuration', label: 'Configuration', value: 'Verified', detail: '', outcome: 'pass' }],
    tenantId: 'tenant-1', snapshotObservedAt: '2026-09-16T10:00:00.000Z', rows: [], start: '2026-09-16', end: '2026-09-16', convention: null,
  } as unknown as CleanupPhase
  const tasks = emergencyVerificationTasksOf(phase).tasks
  assert.ok(tasks.some(task => task.title === 'Test emergency access' && task.targetUpn === 'emergency@contoso.onmicrosoft.com'))
  assert.ok(tasks.some(task => task.title === 'Record a failed attempt'))
  const script = emergencyVerificationPowerShell(phase)
  assert.match(script, /while \(\$next\)/)
  assert.doesNotMatch(script, /\b(?:POST|PATCH|DELETE)\b/)
  const json = JSON.parse(emergencyVerificationJson(phase))
  assert.equal(json.accounts[0].upn, 'emergency@contoso.onmicrosoft.com')
  assert.match(json.purpose, /not a Graph write payload/)
})
