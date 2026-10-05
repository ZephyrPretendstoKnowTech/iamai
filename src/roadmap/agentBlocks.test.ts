// Owner, 2026-10-04: Jon's two AGENT blocks, listed until now under In the
// baseline, not in this plan, are steps in Close the Doors Nobody Should Use.
// His export lost their agent targeting (it reads includeUsers None, All
// resources, block): the exporting SDK reads Conditional Access from Graph v1.0,
// and the agent fields exist only in beta. interpretation.json reads it back
// from his README intent plus Microsoft's documented beta shape, where the
// step's body is built; the pinned bodies stay as pinned.
//
//   * Block High-Risk AI Agents (Entra ID P2; agent risk is Preview): created in
//     Report-only through 3.8, then turned on like any block.
//   * Block AI Agents You Have Not Approved (P1): created in Report-only and left
//     there. IAMAI cannot read the tenant's agent identities, so it offers no
//     turn-on; the step completes once the policy exists, exact, in Report-only,
//     and keeps a "Before you turn it on" reference task.
//
// The plan reads the tenant's agent fields from beta beside the v1.0 policies,
// merged by id; a failed beta read leaves them unread and the steps neither
// done nor correcting. An agent policy reaches no person, so it takes no
// exclusions group and no emergency-access check is about it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, noExclusionsAnswer } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture, withFoundationSettled } from './fixtures/run.ts'
import { PINNED_GOAL_MAP } from './goalMap.ts'
import { stepIdForGoal } from './stepIds.ts'
import { groupOf } from './stepGroups.ts'
import { enforcesOnRun, implementationOffered, operationsOf } from './operations.ts'
import { resolveTenantPolicy, tenantObjectsOf } from './resolvePolicy.ts'
import { AGENT_TARGETING_UNREAD, BETA_CA_POLICIES, HIGH_RISK_AGENTS_GOAL, UNTRUSTED_AGENTS_GOAL, agentFieldsRead } from './agentBlocks.ts'
import interpretation from '../../baselines/jhope188-conditionalaccesspolicies.interpretation.json' with { type: 'json' }
import pinned from '../../baselines/jhope188-conditionalaccesspolicies.pinned.json' with { type: 'json' }
import { interpretPolicies, readInterpretation } from '../baseline/interpretation.ts'
import { pinnedPackage } from '../baseline/pinned.ts'
import type { CaPolicy } from '../baseline/types.ts'
import { notInPlanRows } from '../derive/notInPlan.ts'
import { notLicensedRows } from '../derive/notLicensed.ts'
import { goalMapInUse } from '../coverage/companions.ts'
import { collectConfigSection } from '../graph/collect/collectors.ts'
import { COLLECTOR_REGISTRY } from '../graph/collect/registry.ts'
import { GRAPH_SCOPES } from '../graph/scopes.ts'
import { exclusionsGroupPolicies, includesNoPerson } from '../validation/exclusionsGroupPolicies.ts'
import { stepBodyOf } from '../ui/surfaces/stepBody.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import type { Step } from './types.ts'

const HIGH = stepIdForGoal(HIGH_RISK_AGENTS_GOAL)
const UNTRUSTED = stepIdForGoal(UNTRUSTED_AGENTS_GOAL)
const HIGH_ID = '0ab1380f-3863-40a5-ab97-24250e1cf44e'
const UNTRUSTED_ID = '1d8beea4-2ea1-4758-8e22-d6310a60220a'
const HIGH_NAME = 'IAC - AGENT - BLOCK - HighRiskAgent'
const UNTRUSTED_NAME = 'IAC - AGENT - BLOCK - NonTrustedAgents'
const LEARN = ['https://learn.microsoft.com/entra/agent-id/disable-agent-identities', 'https://learn.microsoft.com/entra/identity/conditional-access/policy-autonomous-agents']

type Json = Record<string, any>

const stepOf = (steps: Step[], id: string): Step => {
  const s = steps.find((x) => x.id === id)
  assert.ok(s, `${id} is on the plan`)
  return s
}
const bodyOf = (s: Step): Json => {
  const op = s.action.resolution?.policies?.[0]
  assert.ok(op, `${s.id} has an operation`)
  return op.body as Json
}

/** mid, an Entra ID P2 tenant, with its foundation settled: both agent steps ready to create. */
const settled = (): Fixture => withFoundationSettled(fixture('mid'))

/**
 * The fixture with each agent step's own policy in the tenant, as 3.8 created
 * it, in `state`; `read` whether the scan's beta read of the agent fields
 * succeeded. `edit` changes each tenant row.
 */
function withAgentPolicies(f: Fixture, state: string, read: boolean, edit: (row: Json, id: string) => Json = (row) => row): Fixture {
  const r = runFixture(f)
  const snapshot = structuredClone(f.snapshot)
  const rows = snapshot.config.caPolicies!.rows as Json[]
  for (const [i, id] of [HIGH, UNTRUSTED].entries()) {
    const json = stepOf(r.steps, id).action.json
    assert.ok(json, `${id} hands over its body`)
    rows.push(edit({ ...(JSON.parse(json) as Json), id: `tenant-agent-${i}`, state, createdDateTime: '2026-01-01T00:00:00Z' }, id))
  }
  snapshot.config.caPolicies!.agentFields = read ? { status: 'ok', reason: null, httpStatus: 200 } : { status: 'error', reason: 'Request failed (500)', httpStatus: 500 }
  return { ...f, snapshot }
}

function ctxOf(f: Fixture, r: ReturnType<typeof runFixture>): StepVarContext {
  return { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming }
}

test('the interpretation reads both policies back from Jon’s README intent and Microsoft’s beta shape, the pinned bodies stay as pinned, and the goal map holds each under its own goal', () => {
  const read = readInterpretation(interpretation)
  const readings = read.policies ?? []
  assert.deepEqual(readings.map((r) => r.id).sort(), [HIGH_ID, UNTRUSTED_ID])
  for (const r of readings) {
    assert.equal(r.reading, 'agentReconstructed')
    assert.equal(r.basis, 'documented')
    assert.deepEqual(r.sources, LEARN, 'both Learn pages are cited')
    assert.match(r.evidence, /README/)
    assert.deepEqual(r.conditions.clientApplications, { includeAgentIdServicePrincipals: ['All'], excludeAgentIdServicePrincipals: [], agentIdServicePrincipalFilter: null })
  }
  assert.deepEqual(readings.find((r) => r.id === HIGH_ID)!.conditions.agentIdRiskLevels, ['high'])
  assert.equal('agentIdRiskLevels' in readings.find((r) => r.id === UNTRUSTED_ID)!.conditions, false, 'the untrusted-agents block names no risk')
  // Settled against the policies as published: a later change to either is read again.
  assert.deepEqual(interpretPolicies(read, pinned.policies as unknown as CaPolicy[]), { reviewRequired: [], stale: [] })
  const changed = (pinned.policies as unknown as CaPolicy[]).map((p) => (p.id === HIGH_ID ? { ...p, grantControls: { ...p.grantControls, builtInControls: ['mfa'] } } : p)) as CaPolicy[]
  assert.equal(interpretPolicies(read, changed).reviewRequired[0]?.id, HIGH_ID)
  // The pin is untouched: the export as fetched, targeting nothing.
  for (const id of [HIGH_ID, UNTRUSTED_ID]) {
    const p = (pinned.policies as unknown as Json[]).find((x) => x.id === id)!
    assert.deepEqual(p.conditions.users.includeUsers, ['None'])
    assert.equal(JSON.stringify(p).includes('AgentId'), false, `${id}: the pinned body carries no agent field`)
  }
  assert.deepEqual(PINNED_GOAL_MAP[HIGH_RISK_AGENTS_GOAL], [HIGH_ID])
  assert.deepEqual(PINNED_GOAL_MAP[UNTRUSTED_AGENTS_GOAL], [UNTRUSTED_ID])
  assert.equal(groupOf(HIGH)?.key, 'remaining-doors')
  assert.equal(groupOf(UNTRUSTED)?.key, 'remaining-doors')
})

test('both are created in Report-only with the beta body: every agent identity, all resources, block; high risk only on the high-risk one; no exclusions group; and 3.8 lists both', () => {
  const r = runFixture(settled())
  for (const id of [HIGH, UNTRUSTED]) {
    const s = stepOf(r.steps, id)
    assert.equal(s.kind, 'create')
    assert.equal(s.status, 'ready', `${id}: ${s.blockedReason}`)
    const body = bodyOf(s)
    assert.equal(body.displayName, id === HIGH ? HIGH_NAME : UNTRUSTED_NAME, 'Jon’s name')
    assert.equal(body.state, 'enabledForReportingButNotEnforced')
    assert.deepEqual(body.conditions.clientApplications.includeAgentIdServicePrincipals, ['All'])
    assert.deepEqual(body.conditions.clientApplications.excludeAgentIdServicePrincipals, [])
    assert.deepEqual(body.conditions.applications.includeApplications, ['All'])
    assert.deepEqual(body.grantControls.builtInControls, ['block'])
    assert.deepEqual(body.conditions.users.includeUsers, ['None'], 'no person')
    assert.deepEqual(body.conditions.users.excludeGroups, [], 'an agent policy cannot exclude a user group: no exclusions group')
  }
  // Each reconstructed field is traceable to the reading, not to Jon's export
  // (ResolvedPolicy.reconstructed); a policy no reading names carries none.
  const pkg = pinnedPackage().policies
  const resolved = (id: string) => resolveTenantPolicy(pkg.find((p) => p.id === id) as never, tenantObjectsOf({ records: {}, serviceAccountsGroupId: null, trustedLocationIds: [] }, null, 'g-exclusions'), 'goal', pkg)
  assert.deepEqual(resolved(HIGH_ID).reconstructed, ['conditions.agentIdRiskLevels', 'conditions.clientApplications.agentIdServicePrincipalFilter', 'conditions.clientApplications.excludeAgentIdServicePrincipals', 'conditions.clientApplications.includeAgentIdServicePrincipals'])
  assert.deepEqual(resolved(UNTRUSTED_ID).reconstructed, ['conditions.clientApplications.agentIdServicePrincipalFilter', 'conditions.clientApplications.excludeAgentIdServicePrincipals', 'conditions.clientApplications.includeAgentIdServicePrincipals'])
  assert.equal(resolved('a66e8427-e5e7-4072-bfd1-7e99db7a7dc4').reconstructed, undefined, 'Jon’s MFA for everyone is his own, field for field')
  assert.deepEqual(bodyOf(stepOf(r.steps, HIGH)).conditions.agentIdRiskLevels, ['high'])
  assert.equal('agentIdRiskLevels' in bodyOf(stepOf(r.steps, UNTRUSTED)).conditions, false)
  const batch = stepOf(r.steps, 's-create-report-only').reportOnlyBatch
  assert.ok(batch?.create.includes(HIGH) && batch.create.includes(UNTRUSTED), JSON.stringify(batch))
})

test('the step’s JSON and PowerShell hand over the beta endpoint; the portal procedure uses Microsoft’s own words', () => {
  const f = settled()
  const r = runFixture(f)
  for (const id of [HIGH, UNTRUSTED]) {
    const body = stepBodyOf(stepOf(r.steps, id), ctxOf(f, r))
    const ps = body.artifacts.find((a) => a.id === 'ps')!.text()
    assert.ok(ps.includes(`Invoke-MgGraphRequest -Method POST -Uri '${BETA_CA_POLICIES}'`), ps)
    assert.equal(BETA_CA_POLICIES, 'https://graph.microsoft.com/beta/identity/conditionalAccess/policies')
    assert.equal(ps.includes('New-MgIdentityConditionalAccessPolicy'), false, 'the v1.0 cmdlet drops the agent fields')
    const json = body.artifacts.find((a) => a.id === 'json')!
    assert.equal(json.note, `POST ${BETA_CA_POLICIES}`)
    assert.deepEqual(JSON.parse(json.text()).conditions.clientApplications.includeAgentIdServicePrincipals, ['All'])
    const create = body.emergencyAccountTasks!.tasks.find((t) => t.id === 'create')!
    assert.ok(create.steps.includes('Under **Users, agents or workload identities** → **What does this policy apply to?**, select **Agents**, include **All agent identities** and exclude **None**.'), create.steps.join('\n'))
    assert.equal(create.steps.some((l) => /exclusions group|Core - Exclusions/i.test(l)), false, 'no exclusions group')
  }
  const high = stepBodyOf(stepOf(r.steps, HIGH), ctxOf(f, r)).emergencyAccountTasks!.tasks.find((t) => t.id === 'create')!
  assert.ok(high.steps.includes('Under **Conditions → Agent risk (Preview)**, set **Configure** to **Yes** and select **High**.'), high.steps.join('\n'))
})

test('Block High-Risk AI Agents is turned on like any block after its report-only period', () => {
  const f = withAgentPolicies(settled(), 'enabledForReportingButNotEnforced', true)
  const r = runFixture(f)
  const s = stepOf(r.steps, HIGH)
  assert.equal(s.status, 'in-report-only')
  assert.ok(operationsOf(s).some((o) => enforcesOnRun(o)), 'the turn-on is offered')
  const turnOn = stepBodyOf(s, ctxOf(f, r)).emergencyAccountTasks!.tasks.find((t) => t.id === 'turn-on')
  assert.ok(turnOn?.required, 'Turn the policy on is its task')
  // On, exact: done.
  assert.equal(stepOf(runFixture(withAgentPolicies(settled(), 'enabled', true)).steps, HIGH).status, 'done')
})

test('Block AI Agents You Have Not Approved never offers a turn-on and completes once its policy exists, exact, in Report-only, approvals kept', () => {
  const f = settled()
  const ready = stepBodyOf(stepOf(runFixture(f).steps, UNTRUSTED), ctxOf(f, runFixture(f))).emergencyAccountTasks!.tasks
  assert.equal(ready.some((t) => t.id === 'turn-on'), false, 'no turn-on, even before it exists')
  const before = ready.find((t) => t.id === 'before-turn-on')!
  assert.equal(before.title, 'Before you turn it on')
  assert.equal(before.required, false, 'a reference, never required')
  assert.match(before.steps.join(' '), /cannot read your agent identities/)
  assert.match(before.steps.join(' '), /Users, agents or workload identities\*\* → \*\*Exclude\*\*/)
  assert.match(before.steps.join(' '), /custom security attribute/)
  assert.match(before.steps.join(' '), /Sign-in logs/)
  // In Report-only, exact: done, nothing to submit, and no turn-on.
  const ro = withAgentPolicies(f, 'enabledForReportingButNotEnforced', true)
  const rr = runFixture(ro)
  const done = stepOf(rr.steps, UNTRUSTED)
  assert.equal(done.status, 'done')
  assert.equal(done.state.lifecycle, 'report-only')
  assert.deepEqual(operationsOf(done), [])
  const tasks = stepBodyOf(done, ctxOf(ro, rr)).emergencyAccountTasks!.tasks
  assert.equal(tasks.some((t) => t.id === 'turn-on'), false)
  assert.ok(tasks.find((t) => t.id === 'before-turn-on'), 'the reference stays on the finished step')
  // The agents the tenant approved, excluded in its own policy, are its approvals: still exact, still done.
  const approved = withAgentPolicies(f, 'enabledForReportingButNotEnforced', true, (row, id) => (id === UNTRUSTED ? { ...row, conditions: { ...row.conditions, clientApplications: { ...row.conditions.clientApplications, excludeAgentIdServicePrincipals: ['0000a9e0-0000-4000-8000-0000000000a1'] } } } : row))
  assert.equal(stepOf(runFixture(approved).steps, UNTRUSTED).status, 'done')
  // Turned on by the operator after approving: done too.
  assert.equal(stepOf(runFixture(withAgentPolicies(f, 'enabled', true)).steps, UNTRUSTED).status, 'done')
  // Not exact (all resources narrowed to one app): a correction, never a turn-on.
  const narrowed = withAgentPolicies(f, 'enabledForReportingButNotEnforced', true, (row, id) => (id === UNTRUSTED ? { ...row, conditions: { ...row.conditions, applications: { ...row.conditions.applications, includeApplications: ['00000003-0000-0ff1-ce00-000000000000'] } } } : row))
  const corrected = stepOf(runFixture(narrowed).steps, UNTRUSTED)
  assert.notEqual(corrected.status, 'done')
  assert.equal(operationsOf(corrected).some((o) => enforcesOnRun(o)), false, 'no operation turns it on')
})

test('the beta read merges only the agent fields into the v1.0 rows, by id; a failed one leaves them unread and changes nothing', async () => {
  // The read is registered, under the permission the v1.0 read already holds: no new scope.
  const spec = COLLECTOR_REGISTRY.find((s) => s.name === 'CA policies agent targeting')
  assert.ok(spec, 'registered')
  assert.equal(spec.version, 'beta')
  assert.equal(spec.endpoint, '/identity/conditionalAccess/policies')
  assert.deepEqual(spec.scopes, ['Policy.Read.All'])
  assert.ok(GRAPH_SCOPES.includes('Policy.Read.All'))
  assert.equal(GRAPH_SCOPES.some((s) => /write/i.test(s)), false)
  const v1 = [
    { id: 'p-agent', displayName: 'Agent block', state: 'enabled', conditions: { users: { includeUsers: ['None'] }, applications: { includeApplications: ['All'] }, clientApplications: { includeServicePrincipals: [], excludeServicePrincipals: [] } }, grantControls: { operator: 'OR', builtInControls: ['block'] } },
    { id: 'p-people', displayName: 'MFA for everyone', state: 'enabled', conditions: { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'] }, clientApplications: null }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } },
  ]
  const beta = [
    // Beta answers more than the agent fields, and a different name: none of it is taken.
    { id: 'p-agent', displayName: 'Renamed in beta', state: 'disabled', conditions: { users: { includeUsers: ['None'] }, insiderRiskLevels: 'elevated', applications: { includeApplications: ['Office365'] }, clientApplications: { includeServicePrincipals: [], excludeServicePrincipals: [], includeAgentIdServicePrincipals: ['All'], excludeAgentIdServicePrincipals: ['agent-1'], agentIdServicePrincipalFilter: null }, agentIdRiskLevels: ['high'] }, grantControls: { operator: 'OR', builtInControls: ['block'] } },
    { id: 'p-people', displayName: 'MFA for everyone', state: 'enabled', conditions: { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'] }, clientApplications: { includeAgentIdServicePrincipals: [], excludeAgentIdServicePrincipals: [], agentIdServicePrincipalFilter: null }, agentIdRiskLevels: [] }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } },
  ]
  const requested: string[] = []
  const run = async (betaStatus: number) => {
    const original = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      requested.push(url)
      if (url.startsWith('https://graph.microsoft.com/beta/identity/conditionalAccess/policies')) return betaStatus === 200 ? new Response(JSON.stringify({ value: beta }), { status: 200 }) : new Response(JSON.stringify({ error: { code: 'Authorization_RequestDenied', message: 'Insufficient privileges' } }), { status: betaStatus })
      if (url.startsWith('https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies')) return new Response(JSON.stringify({ value: structuredClone(v1) }), { status: 200 })
      return new Response(JSON.stringify({ error: { message: `no route for ${url}` } }), { status: 404 })
    }) as typeof fetch
    try {
      return await collectConfigSection({ tokens: { get: () => 't', refresh: async () => 't' }, signal: new AbortController().signal } as never, 'caPolicies')
    } finally {
      globalThis.fetch = original
    }
  }
  const ok = await run(200)
  assert.ok(requested.some((u) => u.startsWith('https://graph.microsoft.com/beta/identity/conditionalAccess/policies')), 'the beta read is made')
  assert.equal(ok.status, 'ok')
  assert.deepEqual(ok.agentFields, { status: 'ok', reason: null, httpStatus: 200 })
  const [agent, people] = ok.rows as Json[]
  assert.deepEqual(agent, {
    ...v1[0],
    conditions: { ...v1[0].conditions, clientApplications: { includeServicePrincipals: [], excludeServicePrincipals: [], includeAgentIdServicePrincipals: ['All'], excludeAgentIdServicePrincipals: ['agent-1'] }, agentIdRiskLevels: ['high'] },
  }, 'only the agent fields; the name, state, resources and the insider risk stay v1.0’s')
  assert.deepEqual(people, v1[1], 'a policy that targets no agent is unchanged')
  assert.equal(agentFieldsRead({ config: { caPolicies: ok } } as never), true)
  // Refused: the v1.0 rows stand as read, and the agent fields are unread.
  const refused = await run(403)
  assert.equal(refused.status, 'ok', 'the policies are still read')
  assert.deepEqual(refused.rows, v1)
  assert.equal(refused.agentFields?.status, 'error')
  assert.equal(refused.agentFields?.httpStatus, 403)
  assert.equal(agentFieldsRead({ config: { caPolicies: refused } } as never), false)
})

test('a failed beta read leaves each step’s own policy’s agent targeting unread: neither done nor correcting, and nothing submitted', () => {
  for (const state of ['enabledForReportingButNotEnforced', 'enabled']) {
    const r = runFixture(withAgentPolicies(settled(), state, false))
    for (const id of [HIGH, UNTRUSTED]) {
      const s = stepOf(r.steps, id)
      assert.notEqual(s.status, 'done', `${id} (${state}): unread is never exact`)
      assert.ok(s.blockers.some((b) => b.label === AGENT_TARGETING_UNREAD), JSON.stringify(s.blockers))
      assert.deepEqual(operationsOf(s), [], `${id} (${state}): no correction, no turn-on, no create beside it`)
      assert.equal(s.blockedReason, 'until a scan can read which agents the policy targets')
    }
  }
  // A scan from before the read existed carries no agentFields: unread too.
  const old = withAgentPolicies(settled(), 'enabled', true)
  delete (old.snapshot.config.caPolicies as Json).agentFields
  assert.notEqual(stepOf(runFixture(old).steps, UNTRUSTED).status, 'done')
  // With no policy of its own there yet, an unread scan still hands over the create.
  const fresh = stepOf(runFixture(settled()).steps, HIGH)
  assert.equal(agentFieldsRead(settled().snapshot), false, 'the premise: the fixture records no agent read')
  assert.ok(operationsOf(fresh).some((o) => o.mode === 'create'))
})

test('no emergency or exclusions-group check fires on them: an agent policy reaches no person, and emergency accounts are people', () => {
  const r0 = runFixture(withAgentPolicies(settled(), 'enabled', true))
  const rows = (withAgentPolicies(settled(), 'enabled', true).snapshot.config.caPolicies!.rows as Json[]).filter((p) => String(p.id).startsWith('tenant-agent-'))
  assert.equal(rows.length, 2)
  for (const p of rows) assert.equal(includesNoPerson(p), true)
  assert.deepEqual(exclusionsGroupPolicies({ policies: rows, groupId: 'g-exclusions', accountIds: ['bg-1'], activeRoles: {}, membersOf: () => undefined }), [], 'neither needs the exclusions group')
  // The control: a policy that does reach people still needs it.
  const people = { id: 'p', displayName: 'People', state: 'enabled', conditions: { users: { includeUsers: ['All'], excludeGroups: [] } } }
  assert.equal(includesNoPerson(people), false)
  assert.equal(exclusionsGroupPolicies({ policies: [people], groupId: 'g-exclusions', accountIds: ['bg-1'], activeRoles: {}, membersOf: () => undefined })[0]?.outcome, 'fail')
  // Nothing of theirs names the exclusions group, but like every policy step they
  // hand nothing over until it is chosen: the foundation comes first.
  const unanswered = runFixture(noExclusionsAnswer(fixture('mid')), { mapping: noExclusionsAnswer(fixture('mid')).mapping })
  for (const id of [HIGH, UNTRUSTED]) {
    const s = stepOf(unanswered.steps, id)
    assert.equal(implementationOffered(s), false, `${id}: offered before the exclusions group is chosen`)
    assert.equal(s.action.json, null)
    assert.ok((s.action.missing ?? []).some((m) => m.token === '{exclusionsGroup}'), `${id}: waits on the exclusions group`)
  }
  // On the plan: both agent policies On without the exclusions group leave Establish Emergency Access as it was.
  const before = runFixture(settled())
  for (const id of ['s-prereq-exclusion-group', 's-prereq-break-glass']) {
    const a = stepOf(before.steps, id)
    const b = stepOf(r0.steps, id)
    assert.equal(b.status, a.status, id)
    const failing = (s: Step): string[] => (s.configurationFindings ?? []).flatMap((x) => (x.items ?? []).filter((i) => i.outcome !== 'pass').flatMap((i) => i.issueKeys ?? []))
    assert.deepEqual(failing(b), failing(a), `${id}: no new finding`)
    assert.equal(failing(b).some((k) => /excludedFromAllPolicies|excludedFromReportOnly|usedConsistently/.test(k)), false)
  }
})

test('without Entra ID P2 Block High-Risk AI Agents is a Not licensed row, the untrusted-agents block stays a step, and the footer lists neither', () => {
  const f = { ...fixture('demo'), baseline: pinnedPackage() }
  assert.equal(f.snapshot.capabilities.entraP2.enabled, false, 'the premise: no P2')
  const r = runFixture(f)
  assert.equal(r.steps.some((s) => s.id === HIGH), false)
  assert.ok(notLicensedRows(r.coverage, PINNED_GOAL_MAP).some((x) => x.title.includes('Block High-Risk AI Agents')))
  assert.ok(r.steps.some((s) => s.id === UNTRUSTED))
  const rows = notInPlanRows(f.baseline.policies, r.steps, r.coverage, goalMapInUse(PINNED_GOAL_MAP, f.snapshot))
  assert.equal(rows.some((x) => x.policy === HIGH_NAME || x.policy === UNTRUSTED_NAME), false, JSON.stringify(rows.map((x) => x.policy)))
  // Nor are they review rows any more: the reading makes them assessable.
  assert.equal(r.steps.some((s) => s.baselineReviewSource && /AGENT - BLOCK/.test(s.baselineReviewSource.name)), false)
  assert.equal(r.coverage.organisation.notAssessed.some((p) => /AGENT - BLOCK/.test(p.name)), false)
})
