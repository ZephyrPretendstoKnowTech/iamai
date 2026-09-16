// Editorial batch B — the Cloud Sync applicability correction (owner-approved
// methodology, 2026-09-14).
//
// Microsoft documents workload Conditional Access for single-tenant service
// principals the tenant owns; Microsoft applications, multitenant applications and
// managed identities are outside that scope. A Directory Synchronization Accounts
// role holder and a Workload ID licence establish none of that, so the workload
// step holds on the unknown identity: it is never Ready to run, never Completed, and
// its words say what is not established rather than promising protection.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { laneReadings } from '../ui/surfaces/planLanes.ts'
import { stepBodyOf } from '../ui/surfaces/stepBody.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import { BLOCKED_REASON } from '../copy/reasons.ts'
import { DIR_SYNC_ROLE } from '../coverage/applicability.ts'
import { stepById } from '../content/content.ts'
import { syncIdentitySupportOf, workloadIdentitySupport } from './workloadIdentity.ts'
import { nextSafeAction } from './nextSafeAction.ts'

const WORKLOAD = 's-goal-workload-identity-block'
const TENANT = '11111111-2222-4333-8444-555555555555'
const OTHER_TENANT = '99999999-8888-4777-8666-555555555555'
const MICROSOFT = 'f8cdef31-a31e-4b4a-93e4-5f571e91255a'

const licensed = (f: Fixture): Fixture => ({ ...f, snapshot: { ...f.snapshot, capabilities: { ...f.snapshot.capabilities, workloadIdPremium: { enabled: true, seats: 25, consumed: 0 } } } })

test('a sync role holder with a Workload ID licence is not proof of support: the workload step holds on the unknown identity and hands over nothing to run', () => {
  const f = licensed(fixture('mid'))
  assert.ok(Object.values(f.snapshot.roles.active).some((roles) => roles.includes(DIR_SYNC_ROLE)), 'the premise: a Directory Synchronization Accounts role holder')
  assert.deepEqual(syncIdentitySupportOf(f.snapshot), { support: 'unknown' })
  const r = runFixture(f, { snapshot: f.snapshot } as never)
  const step = r.steps.find((s) => s.id === WORKLOAD)
  assert.ok(step, 'the step stays on the plan: its guidance is kept')
  assert.ok(step.blockers.some((b) => b.binding === BLOCKED_REASON.workloadIdentityUnknown), JSON.stringify(step.blockers))
  assert.notEqual(step.status, 'done')
  assert.equal(laneReadings(r.steps).get(WORKLOAD)?.lane, 'On Hold')

  const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups } as StepVarContext
  const body = stepBodyOf(step, ctx)
  assert.equal(nextSafeAction(step).enforceable, false, 'unknown support is never proof that workload protection can be enforced; useful guidance remains copyable')
  assert.equal(body.cs.why, stepById['workload-identity-block'].why)
  assert.match(String(body.cs.why), /^Review which identity performs synchronization before relying on a network restriction\./)
  assert.doesNotMatch(String(body.cs.why), /works from anywhere/)
  const ai = body.artifacts.find((a) => a.id === 'ai')
  if (ai && !ai.unavailable) {
    assert.match(ai.text(), /IAMAI has not established that this identity supports workload Conditional Access\./)
    assert.doesNotMatch(ai.text(), /No Cloud Sync in/)
  }
})

test('unknown identity evidence is never Completed: a tenant that already enforces a policy like the target keeps the step on hold, with that policy left as it is', () => {
  const f0 = licensed(fixture('mid'))
  const resolved = runFixture(f0, { snapshot: f0.snapshot } as never).steps.find((s) => s.id === WORKLOAD)!.action.resolution!.policies[0].body as Record<string, unknown>
  // The tenant's own enforced policy, with the resolved operation's settings: coverage reads the goal as delivered.
  const own = { ...resolved, id: 'aaaaaaaa-1111-4222-8333-444444444444', state: 'enabled', description: undefined, displayName: 'Tenant - Block - Workloads outside trusted locations' }
  const caPolicies = { ...f0.snapshot.config.caPolicies!, rows: [...f0.snapshot.config.caPolicies!.rows, own] }
  const f = { ...f0, snapshot: { ...f0.snapshot, config: { ...f0.snapshot.config, caPolicies } } } as Fixture
  const r = runFixture(f, { snapshot: f.snapshot } as never)
  assert.equal(r.coverage.results.find((x) => x.goal.id === 'workload-identity-block')?.verdict, 'inPlace', 'the premise: coverage reads the goal as delivered')
  const step = r.steps.find((s) => s.id === WORKLOAD)
  assert.ok(step)
  assert.notEqual(step.status, 'done')
  assert.equal(step.state.satisfied, false)
  assert.equal(laneReadings(r.steps).get(WORKLOAD)?.lane, 'On Hold')
  assert.ok(step.blockers.some((b) => b.binding === BLOCKED_REASON.workloadIdentityUnknown))
  assert.equal(step.action.resolution?.policies.some((p) => p.mode === 'update' && p.policyId === own.id) ?? false, false, 'nothing is written against the existing policy while support is unknown')
})

test('a multitenant, Microsoft-owned or managed identity is never supported; only a single-tenant application the tenant owns is, and partial evidence stays unknown', () => {
  assert.deepEqual(workloadIdentitySupport({ servicePrincipalType: 'Application', appOwnerOrganizationId: TENANT, signInAudience: 'AzureADMultipleOrgs' }, TENANT), { support: 'unsupported', because: 'multitenantApplication' })
  assert.deepEqual(workloadIdentitySupport({ servicePrincipalType: 'Application', appOwnerOrganizationId: OTHER_TENANT, signInAudience: 'AzureADMyOrg' }, TENANT), { support: 'unsupported', because: 'multitenantApplication' })
  assert.deepEqual(workloadIdentitySupport({ servicePrincipalType: 'Application', appOwnerOrganizationId: MICROSOFT }, TENANT), { support: 'unsupported', because: 'microsoftApplication' })
  assert.deepEqual(workloadIdentitySupport({ servicePrincipalType: 'ManagedIdentity' }, TENANT), { support: 'unsupported', because: 'managedIdentity' })
  assert.deepEqual(workloadIdentitySupport({ servicePrincipalType: 'Application', appOwnerOrganizationId: TENANT, signInAudience: 'AzureADMyOrg' }, TENANT), { support: 'supported' })
  assert.deepEqual(workloadIdentitySupport({ servicePrincipalType: 'Application' }, TENANT), { support: 'unknown' })
  assert.deepEqual(workloadIdentitySupport(null, TENANT), { support: 'unknown' })
})

test('the unknown and the unsupported identity have distinct explanations, and the facet reason claims no absence of Cloud Sync', () => {
  const small = licensed(fixture('small'))
  const reason = runFixture(small, { snapshot: small.snapshot } as never).coverage.results.find((x) => x.goal.id === 'workload-identity-block')?.applicability?.reason ?? ''
  assert.match(reason, /no directory synchronization account found/)
  assert.doesNotMatch(reason, /no Cloud Sync|Cloud Sync is not/i)
  assert.notEqual(BLOCKED_REASON.workloadIdentityUnknown, BLOCKED_REASON.workloadIdentityUnsupported)
})
