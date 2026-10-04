// Phase 2c (owner, 2026-09-24): two of Jon's P2 policies join the plan.
// - RiskyUsers-RegisterSecurityInfo is its own step, Block Risky Users From
//   Registering Sign-in Methods, after Remediate High-Risk Users.
// - EAM High-Risk Users is Remediate High-Risk Users' second policy where the
//   tenant uses an external MFA provider (coverage/companions.ts); without one it
//   is off the plan and the population it targets is left out of the first policy.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, withExternalMfa } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture, withFoundationSettled, withRecoveryTested } from './fixtures/run.ts'
import { enforcesOnRun, policyResult, submitsEnforcement } from './operations.ts'
import { observationsOf } from './tracking.ts'
import { REPORT_ONLY_STEP_ID } from './reportOnlyBatch.ts'
import { pinnedPackage } from '../baseline/pinned.ts'
import { PINNED_GOAL_MAP } from './goalMap.ts'
import { STEP_GROUPS } from './stepGroups.ts'
import { externalAuthTargetsOf } from '../coverage/companions.ts'

const EAM_GROUP = '8d0564e5-ab28-4283-9a94-9883c581adde'
const mid = () => ({ ...fixture('mid'), baseline: pinnedPackage() })
const userRisk = (f: ReturnType<typeof mid>) => runFixture(f).steps.find((s) => s.id === 's-goal-user-risk')!

test('Block Risky Users From Registering Sign-in Methods is a step, from Jon’s policy, right after Remediate High-Risk Users', () => {
  assert.deepEqual(PINNED_GOAL_MAP['risky-users-register-block'], ['768858bd-a5ad-47de-8acb-5e815cde0857'])
  const step = runFixture(mid()).steps.find((s) => s.id === 's-goal-risky-users-register-block')
  assert.ok(step, 'on a P2 tenant’s plan')
  assert.deepEqual((step.action.resolution?.policies ?? []).map((p) => p.sourceName), ['IAC - P2 - GLOBAL - BLOCK - RiskyUsers - RegisterSecurityInfo'])
  const members = STEP_GROUPS.find((g) => g.key === 'extend-mfa')!.members
  assert.equal(members.indexOf('s-goal-risky-users-register-block'), members.indexOf('s-goal-user-risk') + 1)
})

test('no external MFA provider: Remediate High-Risk Users is one policy and the EAM population is left out, waiting on nothing', () => {
  const step = userRisk(mid())
  assert.deepEqual((step.action.resolution?.policies ?? []).map((p) => p.sourceName), ['IAC - P2 - GLOBAL - GRANT - High-Risk Users - Risk Remediation'])
  assert.equal(step.action.sourceReferences?.find((r) => r.id.toLowerCase() === EAM_GROUP)?.answer, 'omitted')
  assert.equal((step.action.missing ?? []).some((m) => m.token.toLowerCase() === EAM_GROUP), false)
})

test('an external MFA provider whose targets the scan did not read: the EAM policy is its second policy, and its population waits on a person’s mapping', () => {
  const step = userRisk(withExternalMfa(mid()))
  const names = [...(step.action.resolution?.policies ?? []), ...(step.action.planned?.policies ?? [])].map((p) => p.sourceName)
  assert.ok(names.includes('IAC - P2 - GLOBAL - GRANT - EAM - High-Risk Users - Risk Remediation'), names.join(' | '))
  assert.equal(step.action.sourceReferences?.find((r) => r.id.toLowerCase() === EAM_GROUP)?.answer, 'pending')
})

// T2-EAM (v1.1 D6): Jon's EAM group is whoever the tenant's own External
// authentication method targets, read from the scan; nobody is asked.
const EAM_TARGET = '0000eaa0-0000-4000-8000-0000000000e1'
type Users = { includeUsers?: string[]; includeGroups?: string[]; excludeGroups?: string[] }
const bodies = (step: ReturnType<typeof userRisk>) => new Map([...(step.action.resolution?.policies ?? []), ...(step.action.planned?.policies ?? [])].map((p) => [p.sourceName, ((p.pending ?? p.body) as { conditions?: { users?: Users } }).conditions?.users ?? {}]))
const EAM_POLICY = 'IAC - P2 - GLOBAL - GRANT - EAM - High-Risk Users - Risk Remediation'
const MAIN_POLICY = 'IAC - P2 - GLOBAL - GRANT - High-Risk Users - Risk Remediation'

test('T2-EAM: the scan’s reading of who the External authentication method targets: its groups, everyone, or nothing read', () => {
  assert.equal(externalAuthTargetsOf(mid().snapshot), null, 'no method enabled')
  assert.equal(externalAuthTargetsOf(withExternalMfa(mid()).snapshot), null, 'targets not read')
  assert.deepEqual(externalAuthTargetsOf(withExternalMfa(mid(), [EAM_TARGET.toUpperCase()]).snapshot), [EAM_TARGET])
  assert.deepEqual(externalAuthTargetsOf(withExternalMfa(mid(), ['all_users']).snapshot), ['all_users'])
})

test('T2-EAM: the method targets a group: the EAM policy includes it, its pair excludes it, and nothing waits on a mapping', () => {
  const step = userRisk(withExternalMfa(mid(), [EAM_TARGET]))
  const by = bodies(step)
  assert.deepEqual(by.get(EAM_POLICY)?.includeGroups, [EAM_TARGET])
  assert.ok(by.get(MAIN_POLICY)?.excludeGroups?.includes(EAM_TARGET), JSON.stringify(by.get(MAIN_POLICY)))
  assert.equal(step.action.sourceReferences?.some((r) => r.id.toLowerCase() === EAM_GROUP) ?? false, false, 'no question for the operator')
  assert.equal((step.action.missing ?? []).some((m) => m.token.toLowerCase() === EAM_GROUP), false)
  assert.equal(JSON.stringify([...by.values()]).toLowerCase().includes(EAM_GROUP), false, 'the author’s group is in no body')
})

test('T2-EAM: the method targets All users: the EAM policy is for All users, and its pair keeps everyone (Graph cannot exclude All users)', () => {
  const step = userRisk(withExternalMfa(mid(), ['all_users']))
  const by = bodies(step)
  assert.deepEqual(by.get(EAM_POLICY)?.includeUsers, ['All'])
  assert.deepEqual(by.get(EAM_POLICY)?.includeGroups ?? [], [])
  assert.deepEqual(by.get(MAIN_POLICY)?.includeUsers, ['All'])
  assert.equal(JSON.stringify([...by.values()]).toLowerCase().includes(EAM_GROUP), false)
  assert.equal(JSON.stringify([...by.values()]).includes('all_users'), false, 'Graph’s method-target id is never written into a policy')
  assert.equal(step.action.sourceReferences?.some((r) => r.id.toLowerCase() === EAM_GROUP) ?? false, false)
})

test('ENG-2: High-Risk Users in Report-only beside an absent EAM companion is never turned On; the companion is created, and the turn-on waits for both', () => {
  // No fixture reaches this: the settled mid tenant, an External authentication
  // method targeting a group the directory holds, and Jon's High-Risk Users
  // exactly as the plan writes it, created in Report-only yesterday. No EAM policy.
  const settled = withRecoveryTested(withFoundationSettled(mid()))
  const groups = new Map(settled.groups)
  groups.set(EAM_TARGET, { memberIds: [], memberCount: 0, sampled: false, directMembers: 'complete', directMemberIds: [], displayName: 'External MFA users', membershipRule: null, membershipRuleProcessingState: null, mailEnabled: false, securityEnabled: true, groupTypes: [], isAssignableToRole: false, assignedLicenseSkuIds: [] })
  const f0 = withExternalMfa({ ...settled, groups }, [EAM_TARGET])
  const first = runFixture(f0).steps.find((s) => s.id === 's-goal-user-risk')!
  const main = (first.action.resolution?.policies ?? []).find((o) => o.sourceName === MAIN_POLICY)
  assert.ok(main && main.mode === 'create', 'the premise: the plan creates both')
  const withRows = (f: Fixture, add: Record<string, unknown>[]): Fixture => {
    const snapshot = structuredClone(f.snapshot)
    ;(snapshot.config.caPolicies as { rows: unknown[] }).rows = [...(snapshot.config.caPolicies.rows as unknown[]), ...add]
    return { ...f, snapshot }
  }
  const day = new Date(Date.parse(f0.snapshot.asOf) - 86_400_000).toISOString()
  const f = withRows(f0, [{ ...structuredClone(main.body), id: 'named-main', state: 'enabledForReportingButNotEnforced', createdDateTime: day, modifiedDateTime: day }])
  const half = runFixture(f)
  const step = half.steps.find((s) => s.id === 's-goal-user-risk')!
  const ops = step.action.resolution?.policies ?? []
  assert.equal(step.state.lifecycle, 'not-deployed', 'the step reads its least advanced half')
  assert.equal(ops.some(submitsEnforcement), false, `a half turned On beside a create: ${JSON.stringify(ops.map((o) => [o.mode, o.sourceName, o.body.state ?? o.body]))}`)
  assert.equal(ops.some(enforcesOnRun), false, 'nothing the step submits enforces')
  assert.deepEqual(ops.map((o) => [o.mode, o.sourceName, (o.body as { state?: string }).state]), [['create', EAM_POLICY, 'enabledForReportingButNotEnforced']], 'the step creates the companion in Report-only, and nothing else')
  assert.equal(policyResult(step).kind, 'implementable', 'no empty update withholds the create')
  assert.deepEqual((step.action.pairMembers ?? []).map((h) => [h.name, h.policyId]), [[MAIN_POLICY, 'named-main'], [EAM_POLICY, null]], 'the half in Report-only is still tracked')
  assert.ok(half.steps.find((s) => s.id === REPORT_ONLY_STEP_ID)?.reportOnlyBatch?.create.includes('s-goal-user-risk'), '3.8 lists the companion’s create')
  // The companion created in Report-only as asked: the step is in its report-only week, and the turn-on waits for it.
  const eam = ops[0]
  const both = withRows(f, [{ ...structuredClone(eam.body), id: 'named-eam', state: 'enabledForReportingButNotEnforced', createdDateTime: f.snapshot.asOf, modifiedDateTime: f.snapshot.asOf }])
  const week = runFixture(both, {}, observationsOf(half.steps)).steps.find((s) => s.id === 's-goal-user-risk')!
  assert.equal(week.state.lifecycle, 'report-only')
  const result = policyResult(week)
  assert.equal(result.kind === 'held' && result.hold, 'observation-incomplete', 'the turn-on waits for the week')
  assert.deepEqual((result.kind === 'held' ? result.operations : []).map((o) => [o.mode, o.body]), [['update', { state: 'enabled' }], ['update', { state: 'enabled' }]], 'the switch is both halves, once the week is served')
})
