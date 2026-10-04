// Phase 2c (owner, 2026-09-24): two of Jon's P2 policies join the plan.
// - RiskyUsers-RegisterSecurityInfo is its own step, Block Risky Users From
//   Registering Sign-in Methods, after Remediate High-Risk Users.
// - EAM High-Risk Users is Remediate High-Risk Users' second policy where the
//   tenant uses an external MFA provider (coverage/companions.ts); without one it
//   is off the plan and the population it targets is left out of the first policy.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, withExternalMfa } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { pinnedPackage } from '../baseline/pinned.ts'
import { PINNED_GOAL_MAP } from './goalMap.ts'
import { STEP_GROUPS } from './stepGroups.ts'

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
