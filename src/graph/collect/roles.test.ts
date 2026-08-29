import { test } from 'node:test'
import assert from 'node:assert/strict'
import { COLLECTOR_REGISTRY } from './registry.ts'
import { ROLE_FOR_SCOPE, READ_EVERYTHING_ROLE, collectorForSource, rolesForSource, scopesForSource, isPrivilegeDenial } from './roles.ts'
import { ACCESS } from '../../copy/access.ts'

test('every scope in the registry maps to a role', () => {
  const missing: string[] = []
  for (const spec of COLLECTOR_REGISTRY) for (const scope of spec.scopes) if (!ROLE_FOR_SCOPE[scope]) missing.push(`${spec.name}: ${scope}`)
  assert.deepEqual(missing, [], `scopes with no role mapping:\n${missing.join('\n')}`)
})

test('Global Reader covers every scope: one role is the whole ask', () => {
  for (const [scope, roles] of Object.entries(ROLE_FOR_SCOPE)) {
    const covered = roles.least === READ_EVERYTHING_ROLE || roles.also.includes(READ_EVERYTHING_ROLE)
    assert.equal(covered, true, `${scope} is not granted by ${READ_EVERYTHING_ROLE}`)
  }
})

test('no role named is a role that can write to Conditional Access', () => {
  // Administrator roles appear only as alternatives an operator may already
  // hold; the least-privilege answer is always a reader role.
  const least = new Set(Object.values(ROLE_FOR_SCOPE).map((r) => r.least))
  for (const role of least) assert.match(role, /Reader|Readers/, `${role} is offered as the least-privilege role`)
})

test('config and lane sources resolve to their collector', () => {
  assert.equal(collectorForSource('config:caPolicies')?.name, 'CA policies')
  assert.equal(collectorForSource('signInEvidence')?.name, 'Sign-in logs')
  assert.equal(collectorForSource('registrationDetails')?.name, 'Registration details')
  assert.equal(collectorForSource('nothing:here'), null)
  assert.deepEqual(scopesForSource('config:roleAssignments'), ['RoleManagement.Read.Directory'])
})

test('a source needing two scopes names the least role for each', () => {
  // Users needs the directory and the audit log; both roles are the ask.
  assert.deepEqual(rolesForSource('users').least, ['Directory Readers', 'Reports Reader'])
  assert.deepEqual(rolesForSource('config:caPolicies').least, ['Security Reader'])
  assert.deepEqual(rolesForSource('nothing:here').least, [])
})

test('a licence reason is never read as a missing role', () => {
  assert.equal(isPrivilegeDenial('not available on this licence (needs Entra ID P1)'), false)
  assert.equal(isPrivilegeDenial('Insufficient privileges to complete the operation.'), true)
  assert.equal(isPrivilegeDenial('access denied (403)'), true)
  assert.equal(isPrivilegeDenial('Authorization_RequestDenied'), true)
  assert.equal(isPrivilegeDenial('request timed out'), false)
  assert.equal(isPrivilegeDenial(null), false)
})

test('the sentence names a role, never a raw error', () => {
  const s = ACCESS.needsRole(rolesForSource('config:caPolicies').least)
  assert.match(s, /Security Reader/)
  assert.match(s, new RegExp(READ_EVERYTHING_ROLE))
  assert.match(ACCESS.needsRole([]), new RegExp(READ_EVERYTHING_ROLE))
  assert.match(ACCESS.needsRole(['Directory Readers', 'Reports Reader']), /Directory Readers and Reports Reader/)
})
