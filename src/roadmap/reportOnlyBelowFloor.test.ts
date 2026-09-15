// Cycle 2 (gap 4): a report-only policy of the goal's own that asks less than the
// goal's floor is the policy to correct, not a reason to create a second one.
//
// Coverage recorded no reason for it (a report-only candidate only counted the
// people it would cover at the floor, and below the floor that is nobody), so the
// goal read absent and the step proposed "Core - Require - …" beside it. The
// correction now carries the grant alone: the policy stays in report-only, and
// switching it on is still its own later step.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { actionableExclusionsGroupId, directoryEvidenceFromGroups } from '../mapping/safetyChoice.ts'

const GA = '62e90394-69f5-4237-9190-012177145e10'
const W = 'c0100000-0000-4000-8000-000000000009'
const PHISHING_RESISTANT = '00000000-0000-0000-0000-000000000004'

function planWith(state: string, grantControls: Record<string, unknown>) {
  const f = curatedFixture('demo-week2')
  const g = actionableExclusionsGroupId({ snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, directory: directoryEvidenceFromGroups(f.groups, 'complete') })
  assert.ok(g, 'the curated fixture has an actionable exclusions group')
  const row = { id: W, displayName: 'Policy W', state, conditions: { users: { includeRoles: [GA], excludeGroups: [g] }, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'] }, grantControls }
  const ca = f.snapshot.config.caPolicies!
  const snapshot = { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...ca, rows: [row] } } }
  const r = runFixture({ ...f, snapshot }, { snapshot } as never)
  const cov = r.coverage.results.find((x) => x.goal.id === 'admins-phishing-resistant')!
  const step = r.steps.find((x) => x.goalId === 'admins-phishing-resistant' && x.kind !== 'verify')!
  const ops = step.action.resolution?.policies ?? []
  return { cov, step, ops }
}

test('gap 4: a report-only admins policy asking plain MFA is corrected in place — grant only, still report-only, no create beside it', () => {
  const { cov, step, ops } = planWith('enabledForReportingButNotEnforced', { operator: 'OR', builtInControls: ['mfa'] })
  assert.equal(cov.status, 'partial')
  assert.deepEqual(cov.reasons.map((x) => x.kind), ['weaker-control'])
  assert.equal(step.kind, 'adjust')
  assert.deepEqual(ops.map((o) => o.mode), ['update'])
  assert.equal(ops[0].policyId, W)
  assert.deepEqual(Object.keys(ops[0].body), ['grantControls'], 'the correction carries the grant and nothing else — no state change')
  // The grant is the goal's own, the same one the enforced weak policy is corrected to.
  const enforced = planWith('enabled', { operator: 'OR', builtInControls: ['mfa'] })
  assert.deepEqual(ops[0].body.grantControls, enforced.ops[0].body.grantControls)
  assert.ok((ops[0].body.grantControls as { authenticationStrength?: { id?: string } }).authenticationStrength?.id, 'the corrected grant names an authentication strength')
  assert.deepEqual((step.action.changes ?? []).map((c) => c.field), ['Grant controls'])
  assert.ok(!ops.some((o) => o.mode === 'create'))
})

test('gap 4 control: a report-only admins policy that meets the floor gets no grant correction and no create', () => {
  const { cov, ops } = planWith('enabledForReportingButNotEnforced', { operator: 'OR', builtInControls: [], authenticationStrength: { id: PHISHING_RESISTANT } })
  assert.ok(!cov.reasons.some((x) => x.kind === 'weaker-control'), JSON.stringify(cov.reasons))
  assert.ok(!ops.some((o) => o.mode === 'create'), JSON.stringify(ops.map((o) => o.mode)))
  assert.ok(!ops.some((o) => 'grantControls' in o.body), 'a policy at the floor has no grant to correct')
})

test('gap 4 control: an enforced admins policy asking plain MFA is still the weak policy corrected by grant, as before', () => {
  const { cov, step, ops } = planWith('enabled', { operator: 'OR', builtInControls: ['mfa'] })
  assert.ok(cov.reasons.some((x) => x.kind === 'weaker-control'))
  assert.equal(step.kind, 'adjust')
  assert.deepEqual(ops.map((o) => [o.mode, o.policyId]), [['update', W]])
  assert.ok('grantControls' in ops[0].body)
  assert.ok(!('state' in ops[0].body), 'an enforced policy is not moved to report-only by its correction')
})
