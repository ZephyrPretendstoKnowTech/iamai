// Cycle 5 (review 4 queue 6): the shared-devices JSON is the policy's own request.
//
// `json.people-patches` is a reference-only template with no request: the patches go to
// several people policies, which no single Graph request carries. Composed into the
// create and into the people-policy-exclusions correction, it withheld the whole JSON
// channel in every case: degraded on the patches binding while they were unresolved, and
// invalid ("a JSON body with no request") once they were. The create POST and the
// conditions PATCH were never offered. The people-policy exclusions stay the Entra step
// that says to make them.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import registry from './registry.generated.json' with { type: 'json' }
import type { CompiledPackage } from './protocol.ts'
import { CHANGED_FIELDS_BINDING } from './protocol.ts'
import { projectImplementation } from './project.ts'

const PKG = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages['s-shared-devices']
/** Sample ids, never a tenant's. */
const ID = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const PATCHES = [{ policyId: ID(40), displayName: 'Sample people MFA', excludeUsers: [ID(11)] }]
const bindings = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  'tenant.displayName': 'Sample tenant',
  'policy.target.displayName': 'Sample shared devices',
  'policy.target.includeUsers': [ID(11)],
  'policy.target.excludeGroups': [ID(1)],
  'policy.target.trustedLocationId': ID(21),
  'policy.current.id': ID(3),
  'policy.current.state': 'enabled',
  ...extra,
})

for (const patches of [undefined, PATCHES]) {
  const which = patches ? 'with the people-policy patches resolved' : 'before the people-policy patches resolve'

  test(`s-shared-devices ${which}: the create's JSON is the policy's own POST, and Entra still names the people-policy exclusions`, () => {
    const p = projectImplementation(PKG, 'missing', bindings({ 'peoplePolicies.resolvedPatches': patches }))
    const json = p.channels.find((c) => c.channel === 'json')
    assert.ok(json, JSON.stringify(p.degraded ?? p.hold))
    assert.deepEqual(json.blocks, ['json.create'])
    assert.equal(json.requests.length, 1)
    assert.equal(json.requests[0].method, 'POST')
    assert.equal((JSON.parse(json.text) as { displayName: string }).displayName, 'Sample shared devices')
    assert.equal(p.degraded?.some((d) => d.channel === 'json') ?? false, false, JSON.stringify(p.degraded))
    assert.ok(p.channels.find((c) => c.channel === 'entra')?.blocks.includes('entra.people-exclusions'))
  })
}

test('s-shared-devices with the patches resolved: a users correction offers its conditions PATCH beside the people-policy Entra step', () => {
  const p = projectImplementation(PKG, 'partial', bindings({ 'peoplePolicies.resolvedPatches': PATCHES, 'policy.current.semanticMismatches': ['users.shared-devices'], [CHANGED_FIELDS_BINDING]: ['conditions.users.includeUsers'] }))
  const json = p.channels.find((c) => c.channel === 'json')
  assert.ok(json, JSON.stringify(p.degraded ?? p.hold))
  assert.deepEqual(json.blocks, ['json.correct.conditions'])
  assert.deepEqual(json.requests, [{ method: 'PATCH', endpoint: `https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/${ID(3)}` }])
  assert.ok(p.channels.find((c) => c.channel === 'entra')?.blocks.includes('entra.people-exclusions'))
})

test('no projection composes the reference-only people-policy patches into a JSON channel', () => {
  const meta = JSON.stringify(PKG.meta.projection)
  assert.equal(meta.includes('json.people-patches'), false)
})
