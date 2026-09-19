// Overnight review B3 (owner-approved 2026-09-19): one rule for which policies
// need the emergency exclusions group. Every applicable policy, Report-only
// included, needs it; Step 2's completion, its Policy exclusions tile and Step 4
// all read the same answer.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { EXCLUSIONS_RECORD_KEY } from '../mapping/safetyChoice.ts'
import { automaticRecoveryPreparationStates } from '../roadmap/cleanupDone.ts'
import { buildContext, reportFor } from './report.ts'
import { exclusionsGroupPolicies, groupLookup } from './exclusionsGroupPolicies.ts'

function tenantWith(policy: Record<string, unknown> | null) {
  const f = structuredClone(fixture('demo-week2'))
  if (policy) (f.snapshot.config.caPolicies.rows as Record<string, unknown>[]).push(policy)
  return f
}

function readings(f: ReturnType<typeof tenantWith>) {
  const run = runFixture(f)
  const groupId = f.mapping.records[EXCLUSIONS_RECORD_KEY]!.resolvedId!
  const groupFacts = [...f.groups.entries()].map(([id, g]) => ({ groupId: id, ...g }))
  const ctx = buildContext({ snapshot: f.snapshot, state: f.mapping, groupMembers: groupFacts, viability: run.viability })
  const report = reportFor('exclusionGroup', [groupFacts.find(g => g.groupId.toLowerCase() === groupId.toLowerCase()) ?? null], ctx)
  const rule = report.targets.flatMap(t => t.results).find(r => r.id === 'xg.usedConsistently')!
  const step2 = run.steps.find(s => s.id === 's-prereq-exclusion-group')!
  const tile = step2.configurationFindings!.find(finding => finding.key === 'group-policies')!
  const step4 = automaticRecoveryPreparationStates(f.snapshot, f.mapping, f.groups)
  return { groupId, rule, step2, tile, step4 }
}

const reportOnly = (id: string, users: Record<string, unknown>) => ({ id, displayName: `Report-only ${id}`, state: 'enabledForReportingButNotEnforced', conditions: { users: { includeUsers: [], includeGroups: [], includeRoles: [], excludeUsers: [], excludeGroups: [], ...users }, applications: { includeApplications: ['All'] } }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } })

test('the tenant as scanned: Step 2 is complete, its tile has nothing missing and Step 4 is ready', () => {
  const { rule, step2, tile, step4 } = readings(tenantWith(null))
  assert.equal(rule.outcome, 'pass')
  assert.equal(step2.status, 'done')
  assert.equal(tile.outcome, 'pass')
  assert.ok(Object.values(step4).every(state => state === 'ready'))
})

test('a Report-only policy reaching the emergency accounts without the group holds Step 2, its tile and Step 4 alike', () => {
  const { rule, step2, tile, step4 } = readings(tenantWith(reportOnly('ro-all', { includeUsers: ['All'] })))
  assert.equal(rule.outcome, 'fail', 'Step 2 completion no longer reads On policies only')
  assert.deepEqual((rule as { values?: { policies?: string[] } }).values?.policies, ['Report-only ro-all'])
  assert.notEqual(step2.status, 'done')
  const exclusion = tile.items!.find(item => item.subjectId === 'ro-all' && item.factLabel === 'Group exclusion')!
  assert.equal(exclusion.value, 'Missing')
  assert.equal(tile.items!.find(item => item.subjectId === 'ro-all' && item.factLabel === 'Mode')!.value, 'Report-only')
  assert.equal(tile.outcome, 'fail')
  assert.ok(Object.values(step4).every(state => state === 'incorrect'), 'Step 4 reads the same missing exclusion')
})

test('a policy that reaches no emergency account needs no exclusion in any of the three', () => {
  const f = tenantWith(null)
  const other = f.snapshot.users.find(u => !f.mapping.breakGlassUserIds.some(id => id.toLowerCase() === u.id.toLowerCase()))
  assert.ok(other, 'the fixture has a user who is not an emergency account')
  const g = tenantWith(reportOnly('ro-other', { includeUsers: [other.id] }))
  const { rule, step2, tile, step4 } = readings(g)
  assert.equal(rule.outcome, 'pass')
  assert.equal(step2.status, 'done')
  assert.equal(tile.items!.some(item => item.subjectId === 'ro-other'), false)
  assert.ok(Object.values(step4).every(state => state === 'ready'))
})

test('an unread targeted group is unknown, never a confirmed missing exclusion; an excluded group is a pass whatever the reach', () => {
  const f = tenantWith(null)
  const ids = f.mapping.breakGlassUserIds
  const groupId = f.mapping.records[EXCLUSIONS_RECORD_KEY]!.resolvedId!
  const input = (policy: Record<string, unknown>) => ({ policies: [policy], groupId, accountIds: ids, activeRoles: f.snapshot.roles.active, membersOf: groupLookup(f.groups) })
  assert.equal(exclusionsGroupPolicies(input(reportOnly('unread', { includeGroups: ['group-never-read'] })))[0].outcome, 'unknown')
  assert.equal(exclusionsGroupPolicies(input(reportOnly('excluded', { includeGroups: ['group-never-read'], excludeGroups: [groupId.toUpperCase()] })))[0].outcome, 'pass')
  assert.deepEqual(exclusionsGroupPolicies(input({ ...reportOnly('off', { includeUsers: ['All'] }), state: 'disabled' })), [], 'an Off policy denies nothing')
})
