import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectConfigSection, deriveRoles } from '../graph/collect/collectors.ts'
import { fixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { permanentGlobalAdministratorState } from './rules.ts'
import { emergencyAccountTasksOf } from '../ui/surfaces/emergencyAccountTasks.ts'

const GA = '62e90394-69f5-4237-9190-012177145e10'
// Microsoft Graph v1.0 unifiedRoleAssignmentScheduleInstance has no status:
// https://learn.microsoft.com/graph/api/resources/unifiedroleassignmentscheduleinstance
const instance = (id: string): Record<string, unknown> => ({
  id: 'instance-1', principalId: id, roleDefinitionId: GA,
  directoryScopeId: '/', appScopeId: null, assignmentType: 'Assigned',
  memberType: 'Direct', startDateTime: null,
  endDateTime: null, roleAssignmentOriginId: 'assignment-1',
  roleAssignmentScheduleId: 'schedule-1',
})

test('documented Graph instance survives collection and completes the GA tile check without status', async () => {
  const f = structuredClone(fixture('demo-week2'))
  const id = f.mapping.breakGlassUserIds[0]
  const raw = instance(id)
  const before = globalThis.fetch
  globalThis.fetch = async input => {
    assert.match(String(input), /\/v1.0\/roleManagement\/directory\/roleAssignmentScheduleInstances\?/)
    return new Response(JSON.stringify({ value: [raw] }), { status: 200 })
  }
  try {
    f.snapshot.config.roleAssignmentSchedules = await collectConfigSection({
      tokens: { get: () => 'synthetic', refresh: async () => 'synthetic' },
      signal: new AbortController().signal,
    }, 'roleAssignmentSchedules')
  } finally { globalThis.fetch = before }
  f.snapshot.config.roleAssignments = { status: 'ok', reason: null, rows: [
    { id: 'assignment-1', principalId: id, roleDefinitionId: GA, directoryScopeId: '/' },
  ] }
  f.snapshot.roles = deriveRoles(f.snapshot.config.roleAssignments.rows, [])
  assert.deepEqual(f.snapshot.config.roleAssignmentSchedules.rows, [raw])
  assert.equal(permanentGlobalAdministratorState(f.snapshot, [], id), true)
  const run = runFixture(f)
  const projected = emergencyAccountTasksOf(run.steps.find(s => s.id === 's-prereq-break-glass')!, {
    snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, nameOf: value => value,
    now: f.snapshot.asOf, signature: 'IT', operatorId: f.operatorId,
  })
  const tile = projected.accounts.find(a => a.accountId === id)!
  assert.ok(tile.completed.includes('Permanent, active Global Administrator'))
  assert.notEqual(tile.title, 'Global Administrator assignment could not be verified')
})

test('instance contract preserves permanence boundaries without a fabricated status field', () => {
  const f = structuredClone(fixture('demo-week2'))
  const id = f.mapping.breakGlassUserIds[0]
  const base = instance(id)
  f.snapshot.roles.active[id] = [GA]
  const check = (row: Record<string, unknown>, expected: boolean | null, label: string) => {
    f.snapshot.config.roleAssignmentSchedules = { status: 'ok', reason: null, rows: [row] }
    assert.equal(permanentGlobalAdministratorState(f.snapshot, [], id), expected, label)
  }
  check(base, true, 'permanent Assigned instance')
  check({ ...base, startDateTime: '2020-01-01T00:00:00Z' }, true, 'explicit past start')
  check({ ...base, endDateTime: '2099-01-01T00:00:00Z' }, false, 'null start does not remove expiry')
  check({ ...base, assignmentType: 'Activated' }, false, 'null start does not make activation permanent')
  check({ ...base, assignmentType: 'Activated', startDateTime: '2020-01-01T00:00:00Z', endDateTime: '2099-01-01T00:00:00Z' }, false, 'PIM activation')
  check({ ...base, startDateTime: '2020-01-01T00:00:00Z', endDateTime: '2099-01-01T00:00:00Z' }, false, 'time limited assignment')
  check({ ...base, startDateTime: '2099-01-01T00:00:00Z' }, false, 'future assignment')
  check({ ...base, startDateTime: '2020-01-01T00:00:00Z', endDateTime: '2021-01-01T00:00:00Z' }, false, 'expired assignment')
  check({ ...base, directoryScopeId: '/administrativeUnits/unit' }, null, 'wrong scope')
  for (const key of ['startDateTime', 'endDateTime', 'assignmentType']) {
    const missing = { ...base }; delete missing[key]
    check(missing, null, 'missing ' + key)
  }
  check({ ...base, assignmentType: 'Unknown' }, null, 'unsupported assignment type')
  f.snapshot.config.roleAssignmentSchedules.rows = [{ ...base, endDateTime: '2021-01-01T00:00:00Z' }, base]
  assert.equal(permanentGlobalAdministratorState(f.snapshot, [], id), true, 'separate permanent assignment')
  f.snapshot.roles.active[id] = []
  f.snapshot.roles.eligible[id] = [GA]
  check(base, false, 'no current active assignment')
  f.snapshot.config.roleAssignmentSchedules.status = 'error'
  assert.equal(permanentGlobalAdministratorState(f.snapshot, [], id), null, 'failed collection')
})
