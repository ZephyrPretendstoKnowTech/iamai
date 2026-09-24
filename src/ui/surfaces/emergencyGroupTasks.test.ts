import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { exclusionsGroupIdToVerify } from '../../mapping/safetyChoice.ts'
import type { StepVarContext } from './stepVars.ts'
import { emergencyGroupTasksOf } from './emergencyGroupTasks.ts'

function projection() {
  const value = structuredClone(fixture('small'))
  const groupId = exclusionsGroupIdToVerify(value.mapping)!
  const group = value.groups.get(groupId)!
  const objectId = 'service-principal-1'
  value.groups.set(groupId, {
    ...group,
    memberIds: [...group.memberIds, objectId],
    memberCount: group.memberCount + 1,
    directMembers: 'complete',
    directMemberIds: [...(group.directMemberIds ?? group.memberIds), objectId],
    directMemberObjects: [{ id: objectId, displayName: 'Emergency automation', userPrincipalName: null, kind: 'servicePrincipal' }],
  })
  const run = runFixture(value)
  const step = run.steps.find(row => row.id === 's-prereq-exclusion-group')!
  const ctx: StepVarContext = { snapshot: value.snapshot, mapping: value.mapping, nameOf: id => run.input.names!.label(id), signature: 'IT', operatorId: value.operatorId, now: value.snapshot.asOf, groups: value.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
  return emergencyGroupTasksOf(step, ctx)
}

function projectValue(value: ReturnType<typeof fixture>) {
  const run = runFixture(value)
  const step = run.steps.find(row => row.id === 's-prereq-exclusion-group')!
  const ctx: StepVarContext = { snapshot: value.snapshot, mapping: value.mapping, nameOf: id => run.input.names!.label(id), signature: 'IT', operatorId: value.operatorId, now: value.snapshot.asOf, groups: value.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
  return emergencyGroupTasksOf(step, ctx)
}

test('saved-group membership uses complete direct evidence and names unexpected non-user objects', () => {
  const task = projection().tasks.find(row => row.id === 'manage-emergency-membership')!
  assert.equal(task.required, true)
  assert.match(task.steps.join('\n'), /Emergency automation · servicePrincipal · service-principal-1/)
})

test('unread direct membership remains an evidence gap rather than an empty group', () => {
  const value = structuredClone(fixture('small'))
  const groupId = exclusionsGroupIdToVerify(value.mapping)!
  value.groups.set(groupId, { ...value.groups.get(groupId)!, directMembers: 'unknown', directMemberIds: [], directMemberObjects: [] })
  const run = runFixture(value)
  const step = run.steps.find(row => row.id === 's-prereq-exclusion-group')!
  const ctx: StepVarContext = { snapshot: value.snapshot, mapping: value.mapping, nameOf: id => run.input.names!.label(id), signature: 'IT', operatorId: value.operatorId, now: value.snapshot.asOf, groups: value.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
  const projected = emergencyGroupTasksOf(step, ctx)
  const task = projected.tasks.find(row => row.id === 'manage-emergency-membership')!
  assert.equal(projected.tasks.length, 4)
  assert.equal(task.required, false)
  assert.equal(task.evidence, null)
})

test('uncertain policy evidence does not become a required tenant-change task', () => {
  const value = structuredClone(fixture('small'))
  const groupId = exclusionsGroupIdToVerify(value.mapping)!
  const rows = value.snapshot.config.caPolicies.rows as Record<string, any>[]
  for (const row of rows) {
    row.conditions ??= {}
    row.conditions.users ??= {}
    row.conditions.users.excludeGroups = [groupId]
  }
  if (rows[0]) delete rows[0].conditions.users.excludeGroups
  const run = runFixture(value)
  const step = run.steps.find(row => row.id === 's-prereq-exclusion-group')!
  const ctx: StepVarContext = { snapshot: value.snapshot, mapping: value.mapping, nameOf: id => run.input.names!.label(id), signature: 'IT', operatorId: value.operatorId, now: value.snapshot.asOf, groups: value.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
  const task = emergencyGroupTasksOf(step, ctx).tasks.find(row => row.id === 'configure-policy-exclusions')!
  assert.equal(task.required, false)
  assert.equal(task.evidence, null)
})

test('new-group procedure discovers the group before selecting it, which saves it', () => {
  const create = projection().tasks.find(row => row.id === 'create-exclusions-group')!
  const text = create.steps.join('\n')
  // Create, scan to discover it, then select the new group: the single-choice
  // list saves the choice (owner, 2026-09-23: no Save beside a picker).
  const discover = text.indexOf('Scan to update the plan')
  const select = text.indexOf('Select the new group')
  assert.ok(discover >= 0 && select > discover)
  // The task ends on selecting the new group (27e265ef).
  assert.match(text.slice(select), /^Select the new group under \*\*Exclusions group\*\*\.$/)
  assert.doesNotMatch(text, /\*\*Save\*\*/)
})

test('a saved unsuitable group projects one concise correction from the real findings', () => {
  const value = structuredClone(fixture('small'))
  const groupId = exclusionsGroupIdToVerify(value.mapping)!
  value.groups.set(groupId, { ...value.groups.get(groupId)!, groupTypes: ['DynamicMembership'], membershipRule: 'user.department -eq "test"', assignedLicenseSkuIds: ['license-one'] })
  const tasks = projectValue(value).tasks.filter(row => row.readinessKey === 'group-choice' && row.required)
  assert.equal(tasks.length, 1)
  assert.equal(tasks[0].readinessTitle, 'Use a suitable exclusions group')
  assert.deepEqual(tasks[0].facts, [
    { label: 'Mismatch', value: 'This group uses dynamic membership.' },
    { label: 'Mismatch', value: 'This group has assigned licenses.' },
  ])
  assert.equal(tasks[0].readinessDirection, 'Choose a dedicated assigned security group, or follow Create an emergency exclusions group in Implementation Tasks.')
})

test('no saved group exposes only one group-choice action', () => {
  const value = structuredClone(fixture('small'))
  value.mapping.records = {}
  value.groups = new Map()
  const tasks = projectValue(value).tasks.filter(row => row.readinessKey === 'group-choice' && row.required)
  assert.equal(tasks.length, 1)
})

test('Step 2 projects concise readiness copy and separate member rows in remove-before-add order', () => {
  const projected = projection()
  const membership = projected.tasks.find(row => row.id === 'manage-emergency-membership')!
  assert.equal(membership.readinessTitle, 'Remove unexpected members')
  assert.match(membership.readinessDirection ?? '', /Implementation Tasks/)
  assert.equal(membership.facts?.[0]?.label, 'Remove')
  assert.equal(membership.facts?.every(row => !row.value.includes(', ')), true)
})

