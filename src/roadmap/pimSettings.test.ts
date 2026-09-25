// Require MFA at Every Role Activation's PIM role settings (owner, 2026-09-25):
// the scan reads each eligible role's activation rule, and the step names the
// roles whose activation does not yet require its authentication context.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectPimRoleSettings } from '../graph/collect/collectors.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import { eligibleRoleIds, pimPolicyIdsOf, pimRolesToSet } from './pimSettings.ts'

const GA = '62e90394-69f5-4237-9190-012177145e10'
const EXCHANGE = '29232cdf-9323-42fd-ade2-1d097af3e4de'
const ctx = { tokens: { get: () => 't', refresh: async () => 't' }, signal: new AbortController().signal }
async function withFetch<T>(fetcher: typeof fetch, work: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch
  globalThis.fetch = fetcher
  try { return await work() } finally { globalThis.fetch = original }
}
const rule = (isEnabled: boolean, claimValue: string | null) => ({ '@odata.type': '#microsoft.graph.unifiedRoleManagementPolicyAuthenticationContextRule', id: 'AuthenticationContext_EndUser_Assignment', isEnabled, claimValue })
const assignment = (roleId: string, auth: unknown) => ({ value: [{ policyId: `Directory_${roleId}`, roleDefinitionId: roleId, policy: { id: `Directory_${roleId}`, rules: [{ id: 'Expiration_EndUser_Assignment' }, auth] } }] })

test('the scan reads each eligible role one request at a time, and keeps the context its activation requires', async () => {
  const urls: string[] = []
  const rows = await withFetch(async (url) => {
    urls.push(decodeURIComponent(String(url)))
    return String(url).includes(GA) ? new Response(JSON.stringify(assignment(GA, rule(true, 'c1')))) : new Response(JSON.stringify(assignment(EXCHANGE, rule(false, null))))
  }, () => collectPimRoleSettings(ctx, [GA, EXCHANGE]))
  assert.equal(urls.length, 2, 'one request per role, as Microsoft documents the expand')
  assert.ok(urls.every((u) => u.includes("/policies/roleManagementPolicyAssignments?$filter=scopeId eq '/' and scopeType eq 'DirectoryRole' and roleDefinitionId eq '") && u.endsWith('&$expand=policy($expand=rules)')), urls.join('\n'))
  assert.deepEqual(rows, [
    { roleDefinitionId: GA, policyId: `Directory_${GA}`, contextRequired: 'c1' },
    { roleDefinitionId: EXCHANGE, policyId: `Directory_${EXCHANGE}`, contextRequired: null },
  ])
})

test('a role whose read fails is left out, so it reads as still to set', async () => {
  const rows = await withFetch(async (url) => (String(url).includes(GA) ? new Response('{}', { status: 403 }) : new Response(JSON.stringify(assignment(EXCHANGE, rule(true, 'c1'))))), () => collectPimRoleSettings(ctx, [GA, EXCHANGE]))
  assert.deepEqual(rows.map((r) => r.roleDefinitionId), [EXCHANGE])
})

test('the roles to set are the eligible roles whose activation does not require the context, a role never read among them', () => {
  const snapshot = {
    config: {} as TenantSnapshot['config'],
    roles: { active: {}, eligible: { u1: [GA], u2: [GA, EXCHANGE] } },
    pimRoleSettings: [{ roleDefinitionId: GA, policyId: 'p-ga', contextRequired: 'C1' }],
  } as Pick<TenantSnapshot, 'config' | 'roles' | 'pimRoleSettings'>
  assert.deepEqual(eligibleRoleIds(snapshot), [EXCHANGE, GA].sort())
  // Global Administrator requires c1 (compared without case); Exchange Administrator was never read.
  assert.deepEqual(pimRolesToSet(snapshot, 'c1'), [EXCHANGE])
  // Against another context, both are still to set.
  assert.deepEqual(pimRolesToSet(snapshot, 'c7'), [EXCHANGE, GA].sort())
  // The policy ids are those the scan read; an unread role has none to name.
  assert.deepEqual(pimPolicyIdsOf(snapshot, [GA, EXCHANGE]), ['p-ga'])
  // Nobody eligible: nothing to set.
  assert.deepEqual(pimRolesToSet({ ...snapshot, roles: { active: {}, eligible: {} } }, 'c1'), [])
})
